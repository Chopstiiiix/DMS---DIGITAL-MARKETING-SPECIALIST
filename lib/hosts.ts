/**
 * One deployment serves two kinds of host:
 *  - the app itself (dashboard, login), and
 *  - each brand's short-link domain (e.g. go.spinmusic.uk), where every path
 *    is a short link.
 *
 * The proxy cannot look brands up in the database, so the rule is inverted:
 * a host is the app if it is local, a Vercel deployment URL, or listed in
 * APP_HOSTS. Anything else is treated as a link domain.
 */

export function hostnameOf(headers: Headers): string {
  const raw = headers.get("x-forwarded-host") ?? headers.get("host") ?? "";
  // Strip port; keep bracketed IPv6 intact.
  const host = raw.split(",")[0]!.trim().toLowerCase();
  if (host.startsWith("[")) return host.slice(0, host.indexOf("]") + 1);
  return host.split(":")[0]!;
}

export function isAppHost(host: string, appHostsEnv: string | undefined): boolean {
  const h = host.toLowerCase();
  if (!h) return true;
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") return true;
  if (h.endsWith(".vercel.app")) return true;
  const listed = (appHostsEnv ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return listed.includes(h);
}

/** Maps a path on a link domain to the redirect route. */
export function linkDomainRewritePath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 1 ? `/r/${segments[0]}` : "/r/_root";
}
