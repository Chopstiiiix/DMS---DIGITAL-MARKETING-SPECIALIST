import "server-only";
import postgres from "postgres";
import { spinDatabaseUrl } from "@/lib/env";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Spin → DMS funnel sync.
 *
 * Reads Spin's read-only view `dms_reporting.funnel_events` (Radio1 project,
 * role `dms_reader`) and upserts `dms.funnel_events` for the Spin brand.
 * Idempotent: the unique key is (brand_id, event_type, external_user_id).
 *
 * ponytail: reads the whole view every run (hundreds of rows today). Switch to
 * `where occurred_at > last sync` once it reaches tens of thousands.
 */

export const SPIN_BRAND_SLUG = "spin";
const BATCH = 500;

export const EVENT_TYPES = ["signup", "first_upload", "first_broadcast", "activation", "first_earning"] as const;
type EventType = (typeof EVENT_TYPES)[number];

export interface SpinEventRow {
  user_id: string;
  event_type: string;
  occurred_at: Date | string;
  is_spinner: boolean;
  country: string | null;
  dms_click_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
}

export interface FunnelEventRow {
  org_id: string;
  brand_id: string;
  event_type: EventType;
  external_user_id: string;
  occurred_at: string;
  click_id: string | null;
  link_id: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Maps view rows to DMS rows. A click id is kept only when it is one of this
 * brand's recorded clicks (`clickLinks`: click id → link id); otherwise the
 * UTM tags are still kept in metadata.
 */
export function toFunnelRows(
  rows: SpinEventRow[],
  brand: { id: string; org_id: string },
  clickLinks: Map<string, string>,
): FunnelEventRow[] {
  const out: FunnelEventRow[] = [];
  for (const r of rows) {
    if (!(EVENT_TYPES as readonly string[]).includes(r.event_type)) continue;
    const click = r.dms_click_id?.toLowerCase() ?? null;
    const linkId = click ? clickLinks.get(click) : undefined;
    const metadata: Record<string, unknown> = { is_spinner: r.is_spinner };
    if (r.country) metadata.country = r.country;
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const) {
      if (r[k]) metadata[k] = r[k];
    }
    out.push({
      org_id: brand.org_id,
      brand_id: brand.id,
      event_type: r.event_type as EventType,
      external_user_id: r.user_id,
      occurred_at: new Date(r.occurred_at).toISOString(),
      click_id: linkId ? click : null,
      link_id: linkId ?? null,
      metadata,
    });
  }
  return out;
}

export async function syncSpin(): Promise<{ read: number; written: number; attributed: number }> {
  const sql = postgres(spinDatabaseUrl(), {
    max: 1,
    prepare: false, // Supabase's pooler in transaction mode does not support prepared statements
    connect_timeout: 10,
  });
  let rows: SpinEventRow[];
  try {
    rows = await sql<SpinEventRow[]>`select * from dms_reporting.funnel_events`;
  } finally {
    await sql.end({ timeout: 5 });
  }

  const db = adminClient();
  const { data: brand, error: brandError } = await db
    .from("brands")
    .select("id, org_id")
    .eq("slug", SPIN_BRAND_SLUG)
    .single<{ id: string; org_id: string }>();
  if (brandError || !brand) throw new Error(`Spin brand not found: ${brandError?.message ?? "no row"}`);

  const clickIds = [...new Set(rows.flatMap((r) => (r.dms_click_id ? [r.dms_click_id.toLowerCase()] : [])))];
  const clickLinks = new Map<string, string>();
  for (let i = 0; i < clickIds.length; i += BATCH) {
    const { data, error } = await db
      .from("link_clicks")
      .select("id, link_id")
      .eq("brand_id", brand.id)
      .in("id", clickIds.slice(i, i + BATCH));
    if (error) throw new Error(`Click lookup failed: ${error.message}`);
    for (const c of data ?? []) clickLinks.set(c.id, c.link_id);
  }

  const out = toFunnelRows(rows, brand, clickLinks);
  for (let i = 0; i < out.length; i += BATCH) {
    const { error } = await db
      .from("funnel_events")
      .upsert(out.slice(i, i + BATCH), { onConflict: "brand_id,event_type,external_user_id" });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
  }

  return { read: rows.length, written: out.length, attributed: out.filter((r) => r.link_id).length };
}
