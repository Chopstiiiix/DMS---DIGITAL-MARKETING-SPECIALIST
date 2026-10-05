import type { Metadata } from "next";
import { headers } from "next/headers";
import { getContext, shortUrl } from "@/lib/context";
import { CHANNELS } from "@/lib/links/input";
import { normalizeStats, sinceDaysAgo } from "@/lib/stats";
import { NewLinkForm } from "./new-link-form";

export const metadata: Metadata = { title: "Links" };

interface LinkRow {
  id: string;
  slug: string;
  label: string;
  destination_url: string;
  channel: string;
  pillar: string | null;
  is_active: boolean;
  created_at: string;
  campaigns: { name: string } | { name: string }[] | null;
}

export default async function LinksPage() {
  const { supabase, brand } = await getContext();
  if (!brand) return null;

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const appOrigin = `${proto}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
  const linkBase = shortUrl(brand, "", appOrigin);

  const since = sinceDaysAgo(30);
  const [linksRes, campaignsRes, statsRes] = await Promise.all([
    supabase
      .from("links")
      .select("id, slug, label, destination_url, channel, pillar, is_active, created_at, campaigns(name)")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false }),
    supabase.from("campaigns").select("id, name").eq("brand_id", brand.id).order("name"),
    supabase.rpc("link_stats", { p_brand: brand.id, p_since: since }),
  ]);
  if (linksRes.error) throw new Error(`Could not load links: ${linksRes.error.message}`);
  if (campaignsRes.error) throw new Error(`Could not load campaigns: ${campaignsRes.error.message}`);
  if (statsRes.error) throw new Error(`Could not load stats: ${statsRes.error.message}`);

  const links = (linksRes.data ?? []) as LinkRow[];
  const clicks = new Map(
    normalizeStats((statsRes.data ?? []) as Record<string, unknown>[]).map((s) => [s.link_id, s.clicks]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Links</h1>
        <p className="mt-1 text-sm text-muted">
          One link per post, message or partner. Each click is logged, and the campaign tag is
          passed to the destination.
        </p>
      </div>

      <NewLinkForm
        channels={CHANNELS}
        campaigns={(campaignsRes.data ?? []) as { id: string; name: string }[]}
        defaultDestination={brand.default_destination}
        allowedHosts={brand.allowed_hosts}
        linkBase={linkBase}
      />

      <section className="card overflow-hidden">
        <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">
          All links <span className="font-normal text-muted">({links.length})</span>
        </h2>
        {links.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No links yet. Create the first one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem]">
              <thead>
                <tr className="border-b border-border">
                  <th className="th">Link</th>
                  <th className="th">Channel</th>
                  <th className="th">Campaign</th>
                  <th className="th num">Clicks, 30d</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => {
                  const campaign = Array.isArray(l.campaigns) ? l.campaigns[0] : l.campaigns;
                  return (
                    <tr key={l.id} className="border-b border-border last:border-0 align-top">
                      <td className="td">
                        <p className="font-medium">
                          {l.label}
                          {!l.is_active && <span className="ml-2 text-xs text-muted">(off)</span>}
                        </p>
                        <p className="mt-0.5 font-mono text-xs break-all select-all">
                          {shortUrl(brand, l.slug, appOrigin)}
                        </p>
                        <p className="mt-0.5 font-mono text-xs break-all text-muted">
                          → {l.destination_url}
                        </p>
                      </td>
                      <td className="td">
                        {l.channel}
                        {l.pillar && <span className="block text-xs text-muted">{l.pillar}</span>}
                      </td>
                      <td className="td">{campaign?.name ?? <span className="text-muted">–</span>}</td>
                      <td className="td num">{(clicks.get(l.id) ?? 0).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
