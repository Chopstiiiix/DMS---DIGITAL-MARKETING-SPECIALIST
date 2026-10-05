import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Fakes ───────────────────────────────────────────────────────────────────
// A tiny stand-in for the Supabase query builder: enough to answer the two
// lookups the route makes and to capture the click it writes.

const BRAND = {
  id: "11000000-0000-4000-8000-000000000001",
  org_id: "10000000-0000-4000-8000-000000000001",
  link_domain: "go.spinmusic.uk",
  default_destination: "https://spinmusic.uk/signup",
  allowed_hosts: ["spinmusic.uk", "apps.apple.com"],
  app_store_pt: "126543210",
};

const LINK = {
  id: "1a000000-0000-4000-8000-000000000001",
  brand_id: BRAND.id,
  slug: "kenya",
  destination_url: "https://spinmusic.uk/signup",
  channel: "event",
  pillar: null as string | null,
  is_active: true,
  campaigns: { slug: "kenya-mentorship" } as { slug: string } | null,
};

const state = vi.hoisted(() => ({
  brands: [] as Record<string, unknown>[],
  links: [] as Record<string, unknown>[],
  clicks: [] as Record<string, unknown>[],
  insertError: null as { message: string } | null,
  afterTasks: [] as Promise<unknown>[],
}));

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: () => ({
    from(table: "brands" | "links" | "link_clicks") {
      const filters: [string, unknown][] = [];
      const builder = {
        select: () => builder,
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return builder;
        },
        async maybeSingle() {
          const rows = table === "brands" ? state.brands : state.links;
          const row = rows.find((r) => filters.every(([c, v]) => r[c] === v)) ?? null;
          return { data: row, error: null };
        },
        async insert(row: Record<string, unknown>) {
          if (state.insertError) return { error: state.insertError };
          state.clicks.push(row);
          return { error: null };
        },
      };
      return builder;
    },
  }),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    // Run "after the response" work immediately, but let the test await it.
    after: (task: () => Promise<unknown>) => {
      state.afterTasks.push(task());
    },
  };
});

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";

async function hit(
  parts: string[],
  init: { host?: string; headers?: Record<string, string>; method?: string } = {},
) {
  const { GET } = await import("@/app/r/[...parts]/route");
  const host = init.host ?? "go.spinmusic.uk";
  const request = new NextRequest(`https://${host}/r/${parts.join("/")}`, {
    method: init.method ?? "GET",
    headers: { host, "user-agent": IPHONE, "x-forwarded-for": "203.0.113.7", ...init.headers },
  });
  const response = await GET(request, { params: Promise.resolve({ parts }) });
  await Promise.all(state.afterTasks);
  return response;
}

beforeEach(() => {
  process.env.LINK_HASH_SALT = "test-salt";
  state.brands = [{ ...BRAND }];
  state.links = [{ ...LINK }];
  state.clicks = [];
  state.insertError = null;
  state.afterTasks = [];
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("GET /r/[...parts]", () => {
  it("redirects a link on the brand's domain with campaign tags and logs the click", async () => {
    const res = await hit(["kenya"], {
      headers: { "cf-ipcountry": "KE", referer: "https://l.instagram.com/?u=abc" },
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("cache-control")).toBe("no-store");

    const location = new URL(res.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://spinmusic.uk/signup");
    expect(location.searchParams.get("utm_source")).toBe("event");
    expect(location.searchParams.get("utm_campaign")).toBe("kenya-mentorship");

    expect(state.clicks).toHaveLength(1);
    const click = state.clicks[0]!;
    // The id in the URL is the id of the stored click: that is the join key.
    expect(location.searchParams.get("dms_click")).toBe(click.id);
    expect(click).toMatchObject({
      org_id: BRAND.org_id,
      brand_id: BRAND.id,
      link_id: LINK.id,
      country: "KE",
      device: "mobile",
      os: "ios",
      referer_host: "l.instagram.com",
      is_bot: false,
    });
    expect(click.visitor_hash).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(click)).not.toContain("203.0.113.7");
  });

  it("resolves the brand by id on the app host", async () => {
    const res = await hit([BRAND.id, "kenya"], { host: "dms.example.test" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("https://spinmusic.uk/signup?");
    expect(state.clicks).toHaveLength(1);
  });

  it("is case-insensitive on the slug", async () => {
    const res = await hit(["KENYA"]);
    expect(res.status).toBe(302);
    expect(state.clicks).toHaveLength(1);
  });

  it("still redirects link-preview bots but flags the click", async () => {
    const res = await hit(["kenya"], {
      headers: { "user-agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" },
    });
    expect(res.status).toBe(302);
    expect(state.clicks[0]).toMatchObject({ is_bot: true });
  });

  it("sends unknown and switched-off links to the brand default without logging", async () => {
    const unknown = await hit(["nope"]);
    expect(unknown.status).toBe(302);
    expect(unknown.headers.get("location")).toBe(BRAND.default_destination);

    state.links = [{ ...LINK, is_active: false }];
    const off = await hit(["kenya"]);
    expect(off.headers.get("location")).toBe(BRAND.default_destination);

    const root = await hit(["_root"]);
    expect(root.headers.get("location")).toBe(BRAND.default_destination);

    expect(state.clicks).toHaveLength(0);
  });

  it("refuses to follow a stored destination that is no longer allow-listed", async () => {
    state.links = [{ ...LINK, destination_url: "https://evil.example/phish" }];
    const res = await hit(["kenya"]);
    expect(res.headers.get("location")).toBe(BRAND.default_destination);
    expect(state.clicks).toHaveLength(0);
  });

  it("uses Apple campaign parameters for App Store destinations", async () => {
    state.links = [{ ...LINK, destination_url: "https://apps.apple.com/app/id123456789" }];
    const res = await hit(["kenya"]);
    const location = new URL(res.headers.get("location")!);
    expect(Object.fromEntries(location.searchParams)).toEqual({
      ct: "kenya-mentorship",
      pt: "126543210",
      mt: "8",
    });
  });

  it("404s for an unknown domain, a malformed brand id, and odd paths", async () => {
    expect((await hit(["kenya"], { host: "go.unknown.test" })).status).toBe(404);
    expect((await hit(["not-a-uuid", "kenya"], { host: "dms.example.test" })).status).toBe(404);
    expect((await hit(["a", "b", "c"])).status).toBe(404);
    expect(state.clicks).toHaveLength(0);
  });

  it("does not serve one brand's links on another brand's domain", async () => {
    state.brands.push({ ...BRAND, id: "22000000-0000-4000-8000-000000000002", link_domain: "go.other.test", default_destination: "https://other.test/" });
    const res = await hit(["kenya"], { host: "go.other.test" });
    expect(res.headers.get("location")).toBe("https://other.test/");
    expect(state.clicks).toHaveLength(0);
  });

  it("still redirects when the click cannot be saved", async () => {
    state.insertError = { message: "database unavailable" };
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await hit(["kenya"]);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("https://spinmusic.uk/signup?");
    expect(errorLog).toHaveBeenCalled();
    errorLog.mockRestore();
  });
});
