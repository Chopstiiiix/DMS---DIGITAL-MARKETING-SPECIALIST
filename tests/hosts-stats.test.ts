import { describe, expect, it } from "vitest";
import { hostnameOf, isAppHost, linkDomainRewritePath } from "@/lib/hosts";
import { groupStats, normalizeStats, rate, totalsOf } from "@/lib/stats";

describe("hosts", () => {
  it("treats local, Vercel and listed hosts as the app", () => {
    expect(isAppHost("localhost", undefined)).toBe(true);
    expect(isAppHost("dms-abc123.vercel.app", undefined)).toBe(true);
    expect(isAppHost("dms.inspire.codes", "dms.inspire.codes, other.example")).toBe(true);
    expect(isAppHost("DMS.Inspire.Codes", "dms.inspire.codes")).toBe(true);
  });

  it("treats every other host as a link domain", () => {
    expect(isAppHost("go.spinmusic.uk", "dms.inspire.codes")).toBe(false);
    expect(isAppHost("vercel.app.evil.com", undefined)).toBe(false);
  });

  it("strips ports and prefers the forwarded host", () => {
    expect(hostnameOf(new Headers({ host: "localhost:3000" }))).toBe("localhost");
    expect(hostnameOf(new Headers({ host: "internal:8080", "x-forwarded-host": "Go.SpinMusic.uk" }))).toBe("go.spinmusic.uk");
    expect(hostnameOf(new Headers())).toBe("");
  });

  it("maps link-domain paths to the redirect route", () => {
    expect(linkDomainRewritePath("/kenya")).toBe("/r/kenya");
    expect(linkDomainRewritePath("/kenya/")).toBe("/r/kenya");
    expect(linkDomainRewritePath("/")).toBe("/r/_root");
    expect(linkDomainRewritePath("/a/b")).toBe("/r/_root");
  });
});

describe("stats", () => {
  const links = [
    { id: "l1", channel: "instagram", campaign: "Kenya" },
    { id: "l2", channel: "instagram", campaign: null },
    { id: "l3", channel: "email", campaign: "Kenya" },
  ];
  const rows = normalizeStats([
    { link_id: "l1", clicks: "40", visitors: 30, signups: 4, activations: 2 },
    { link_id: "l2", clicks: 10, visitors: 9, signups: 1, activations: 0 },
    { link_id: "l3", clicks: 100, visitors: 80, signups: 20, activations: 10 },
    { link_id: "gone", clicks: 5, visitors: 5, signups: 0, activations: 0 },
  ]);

  it("normalises bigint strings to numbers", () => {
    expect(rows[0]!.clicks).toBe(40);
  });

  it("totals every row", () => {
    expect(totalsOf(rows)).toEqual({ clicks: 155, visitors: 124, signups: 25, activations: 12 });
  });

  it("groups by channel, busiest first, skipping rows for unknown links", () => {
    expect(groupStats(rows, links, "channel")).toEqual([
      { key: "email", clicks: 100, visitors: 80, signups: 20, activations: 10 },
      { key: "instagram", clicks: 50, visitors: 39, signups: 5, activations: 2 },
    ]);
  });

  it("groups by campaign with a bucket for links that have none", () => {
    expect(groupStats(rows, links, "campaign").map((g) => [g.key, g.clicks])).toEqual([
      ["Kenya", 140],
      ["No campaign", 10],
    ]);
  });

  it("formats rates and avoids dividing by zero", () => {
    expect(rate(1, 4)).toBe("25%");
    expect(rate(1, 20)).toBe("5.0%");
    expect(rate(0, 0)).toBe("–");
  });
});
