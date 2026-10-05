import type { Metadata } from "next";
import Link from "next/link";
import { getContext } from "@/lib/context";
import {
  groupStats,
  normalizeStats,
  rate,
  sinceDaysAgo,
  totalsOf,
  type GroupRow,
  type LinkMeta,
} from "@/lib/stats";

export const metadata: Metadata = { title: "Dashboard" };

const RANGES = [7, 30, 90] as const;

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function GroupTable({ title, heading, rows }: { title: string; heading: string; rows: GroupRow[] }) {
  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">No links yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem]">
            <thead>
              <tr className="border-b border-border">
                <th className="th">{heading}</th>
                <th className="th num">Clicks</th>
                <th className="th num">Signups</th>
                <th className="th num">Activated</th>
                <th className="th num">Click → activated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border last:border-0">
                  <td className="td font-medium">{r.key}</td>
                  <td className="td num">{r.clicks.toLocaleString()}</td>
                  <td className="td num">{r.signups.toLocaleString()}</td>
                  <td className="td num">{r.activations.toLocaleString()}</td>
                  <td className="td num text-muted">{rate(r.activations, r.clicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const requested = Number(Array.isArray(params.days) ? params.days[0] : params.days);
  const days = RANGES.includes(requested as (typeof RANGES)[number]) ? requested : 30;

  const { supabase, brand } = await getContext();
  if (!brand) return null;

  const since = sinceDaysAgo(days);

  const [statsRes, linksRes] = await Promise.all([
    supabase.rpc("link_stats", { p_brand: brand.id, p_since: since }),
    supabase.from("links").select("id, channel, campaigns(name)").eq("brand_id", brand.id),
  ]);
  if (statsRes.error) throw new Error(`Could not load stats: ${statsRes.error.message}`);
  if (linksRes.error) throw new Error(`Could not load links: ${linksRes.error.message}`);

  const stats = normalizeStats((statsRes.data ?? []) as Record<string, unknown>[]);
  const links: LinkMeta[] = (linksRes.data ?? []).map((l) => {
    const campaign = Array.isArray(l.campaigns) ? l.campaigns[0] : l.campaigns;
    return { id: l.id as string, channel: l.channel as string, campaign: campaign?.name ?? null };
  });

  const totals = totalsOf(stats);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            {brand.name}, last {days} days. Bot and link-preview traffic is excluded.
          </p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Date range">
          {RANGES.map((d) => (
            <Link
              key={d}
              href={d === 30 ? "/" : `/?days=${d}`}
              aria-current={d === days ? "true" : undefined}
              className={`btn-quiet ${d === days ? "border-accent text-accent" : ""}`}
            >
              {d}d
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Clicks" value={totals.clicks.toLocaleString()} />
        <StatTile label="Signups" value={totals.signups.toLocaleString()} hint={`${rate(totals.signups, totals.clicks)} of clicks`} />
        <StatTile label="Activated" value={totals.activations.toLocaleString()} hint={`${rate(totals.activations, totals.signups)} of signups`} />
        <StatTile label="Links" value={links.length.toLocaleString()} />
      </div>

      {totals.signups === 0 && (
        <p className="card px-4 py-3 text-sm text-muted">
          Signups and activations stay at zero until the product sync is connected for this brand.
          Clicks are counted from the moment a link is shared.
        </p>
      )}

      <GroupTable title="By channel" heading="Channel" rows={groupStats(stats, links, "channel")} />
      <GroupTable title="By campaign" heading="Campaign" rows={groupStats(stats, links, "campaign")} />
    </div>
  );
}
