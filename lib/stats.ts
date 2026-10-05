export interface LinkStatRow {
  link_id: string;
  clicks: number;
  visitors: number;
  signups: number;
  activations: number;
}

export interface LinkMeta {
  id: string;
  channel: string;
  campaign: string | null;
}

export interface Totals {
  clicks: number;
  visitors: number;
  signups: number;
  activations: number;
}

export interface GroupRow extends Totals {
  key: string;
}

const zero = (): Totals => ({ clicks: 0, visitors: 0, signups: 0, activations: 0 });

function add(into: Totals, row: Totals) {
  into.clicks += row.clicks;
  into.visitors += row.visitors;
  into.signups += row.signups;
  into.activations += row.activations;
}

/** bigint columns arrive from PostgREST as numbers or strings; normalise once. */
export function normalizeStats(rows: readonly Record<string, unknown>[]): LinkStatRow[] {
  return rows.map((r) => ({
    link_id: String(r.link_id),
    clicks: Number(r.clicks ?? 0),
    visitors: Number(r.visitors ?? 0),
    signups: Number(r.signups ?? 0),
    activations: Number(r.activations ?? 0),
  }));
}

export function totalsOf(rows: readonly LinkStatRow[]): Totals {
  const t = zero();
  for (const r of rows) add(t, r);
  return t;
}

/**
 * Rolls per-link stats up by channel or campaign, busiest first.
 *
 * Visitors are summed across links, so someone who clicks two different links
 * is counted twice at the group level. Treat a group's visitors as an upper
 * bound, not a count of people.
 */
export function groupStats(
  rows: readonly LinkStatRow[],
  links: readonly LinkMeta[],
  by: "channel" | "campaign",
  noneLabel = "No campaign",
): GroupRow[] {
  const meta = new Map(links.map((l) => [l.id, l]));
  const groups = new Map<string, Totals>();
  for (const row of rows) {
    const link = meta.get(row.link_id);
    if (!link) continue;
    const key = by === "channel" ? link.channel : (link.campaign ?? noneLabel);
    let g = groups.get(key);
    if (!g) groups.set(key, (g = zero()));
    add(g, row);
  }
  return [...groups.entries()]
    .map(([key, t]) => ({ key, ...t }))
    .sort((a, b) => b.clicks - a.clicks || a.key.localeCompare(b.key));
}

/** "12.5%" style rate, or an en dash when there is nothing to divide by. */
export function rate(numerator: number, denominator: number): string {
  if (!denominator) return "–";
  const pct = (numerator / denominator) * 100;
  return `${pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

/** ISO timestamp for the start of a "last N days" window. */
export function sinceDaysAgo(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}
