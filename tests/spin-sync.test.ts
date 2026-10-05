import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const syncSpin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sync/spin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sync/spin")>()),
  syncSpin,
}));

const { toFunnelRows } = await import("@/lib/sync/spin");
const { GET } = await import("@/app/api/cron/sync-spin/route");

const BRAND = { id: "11000000-0000-4000-8000-000000000001", org_id: "10000000-0000-4000-8000-000000000001" };
const USER = "22000000-0000-4000-8000-000000000001";
const CLICK = "eefb169c-0fdf-4d69-8ac3-9102021ca2c8";
const LINK = "1a000000-0000-4000-8000-000000000001";

const row = (over: Record<string, unknown> = {}) => ({
  user_id: USER,
  event_type: "signup",
  occurred_at: new Date("2026-10-05T20:00:00Z"),
  is_spinner: true,
  country: "KE",
  dms_click_id: null,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  ...over,
});

describe("toFunnelRows", () => {
  it("credits a known click to its link", () => {
    const [r] = toFunnelRows(
      [row({ dms_click_id: CLICK.toUpperCase(), utm_source: "instagram", utm_campaign: "kenya" })],
      BRAND,
      new Map([[CLICK, LINK]]),
    );
    expect(r).toEqual({
      org_id: BRAND.org_id,
      brand_id: BRAND.id,
      event_type: "signup",
      external_user_id: USER,
      occurred_at: "2026-10-05T20:00:00.000Z",
      click_id: CLICK,
      link_id: LINK,
      metadata: { is_spinner: true, country: "KE", utm_source: "instagram", utm_campaign: "kenya" },
    });
  });

  it("drops a click DMS does not know, but keeps the UTM tags", () => {
    const [r] = toFunnelRows([row({ dms_click_id: CLICK, utm_source: "dm" })], BRAND, new Map());
    expect(r!.click_id).toBeNull();
    expect(r!.link_id).toBeNull();
    expect(r!.metadata).toMatchObject({ utm_source: "dm" });
  });

  it("skips event types DMS does not track", () => {
    expect(toFunnelRows([row({ event_type: "first_tip" })], BRAND, new Map())).toEqual([]);
  });
});

describe("GET /api/cron/sync-spin", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    syncSpin.mockReset();
  });

  const call = (auth?: string) =>
    GET(new NextRequest("https://dms.test/api/cron/sync-spin", { headers: auth ? { authorization: auth } : {} }));

  it("rejects a missing or wrong secret without syncing", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer nope")).status).toBe(401);
    expect(syncSpin).not.toHaveBeenCalled();
  });

  it("syncs with the right secret and returns counts", async () => {
    syncSpin.mockResolvedValue({ read: 3, written: 3, attributed: 1 });
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ read: 3, written: 3, attributed: 1 });
  });

  it("reports a failed sync as 500", async () => {
    syncSpin.mockRejectedValue(new Error("password authentication failed"));
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(500);
  });
});
