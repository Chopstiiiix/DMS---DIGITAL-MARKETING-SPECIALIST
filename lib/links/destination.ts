/**
 * Destination URL rules for short links.
 *
 * Two jobs:
 *  1. validateDestination — a link may only point at https URLs on hosts the
 *     brand has allow-listed. Without this the redirector is an open redirect
 *     that borrows the brand's domain for phishing.
 *  2. buildRedirectUrl — attach campaign tags on the way out so the product
 *     (or the App Store) can attribute what happens next.
 */

const APP_STORE_HOSTS = new Set(["apps.apple.com", "itunes.apple.com"]);

/** Apple campaign tokens: up to 30 characters. */
export const APP_STORE_CT_MAX = 30;

export type DestinationCheck =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

export function hostAllowed(host: string, allowedHosts: readonly string[]): boolean {
  const h = host.toLowerCase();
  return allowedHosts.some((raw) => {
    const allowed = raw.trim().toLowerCase();
    if (!allowed) return false;
    return h === allowed || h.endsWith(`.${allowed}`);
  });
}

export function validateDestination(
  raw: string,
  allowedHosts: readonly string[],
): DestinationCheck {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "Not a valid URL." };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "Destination must start with https://." };
  if (url.username || url.password) return { ok: false, reason: "Destination must not contain credentials." };
  if (!hostAllowed(url.hostname, allowedHosts)) {
    return { ok: false, reason: `${url.hostname} is not an allowed destination for this brand.` };
  }
  return { ok: true, url };
}

export function isAppStoreUrl(url: URL): boolean {
  return APP_STORE_HOSTS.has(url.hostname.toLowerCase());
}

export interface LinkTags {
  /** Where the link is shared (instagram, email, …). Sent as utm_source. */
  channel: string;
  campaignSlug: string | null;
  linkSlug: string;
  pillar: string | null;
  clickId: string;
  appStorePt: string | null;
}

/** Campaign token sent to Apple: campaign slug if there is one, else the link slug. */
export function appStoreCampaignToken(tags: Pick<LinkTags, "campaignSlug" | "linkSlug">): string {
  return (tags.campaignSlug ?? tags.linkSlug).slice(0, APP_STORE_CT_MAX);
}

/**
 * Final URL the visitor is sent to.
 *
 * Web destinations get utm_* tags plus dms_click (the click id), which the
 * product stores at signup so the signup can be tied back to this exact click.
 * Parameters already present on the destination are never overwritten.
 *
 * App Store destinations get Apple's own campaign parameters instead; Apple
 * drops everything else, and only reports a campaign once it has 5+ installs.
 */
export function buildRedirectUrl(destination: string, tags: LinkTags): string {
  const url = new URL(destination);

  const setIfAbsent = (key: string, value: string | null) => {
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
  };

  if (isAppStoreUrl(url)) {
    setIfAbsent("ct", appStoreCampaignToken(tags));
    setIfAbsent("pt", tags.appStorePt);
    setIfAbsent("mt", "8");
    return url.toString();
  }

  setIfAbsent("utm_source", tags.channel);
  setIfAbsent("utm_medium", "dms");
  setIfAbsent("utm_campaign", tags.campaignSlug ?? tags.linkSlug);
  setIfAbsent("utm_content", tags.pillar ? `${tags.linkSlug}.${tags.pillar}` : tags.linkSlug);
  setIfAbsent("dms_click", tags.clickId);
  return url.toString();
}
