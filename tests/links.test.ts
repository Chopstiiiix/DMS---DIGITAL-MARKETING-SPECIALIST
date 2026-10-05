import { describe, expect, it } from "vitest";
import {
  classifyDevice,
  classifyOs,
  clientIp,
  countryFromHeaders,
  isBot,
  refererHost,
  visitorHash,
} from "@/lib/links/classify";
import {
  appStoreCampaignToken,
  buildRedirectUrl,
  hostAllowed,
  validateDestination,
} from "@/lib/links/destination";
import { parseLinkInput } from "@/lib/links/input";
import { normalizeSlug, randomSlug, SLUG_PATTERN } from "@/lib/links/slug";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const ANDROID_PHONE =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const INSTAGRAM_IAB = `${IPHONE} Instagram 390.0.0.28.85 (iPhone16,2; iOS 18_5; en_GB; en; scale=3.00; 1290x2796; 123456789)`;

const SPIN_HOSTS = ["spinmusic.uk", "apps.apple.com"];

const tags = {
  channel: "instagram",
  campaignSlug: "kenya-mentorship",
  linkSlug: "kenya",
  pillar: "money_math",
  clickId: "11111111-2222-4333-8444-555555555555",
  appStorePt: "126543210",
};

describe("validateDestination", () => {
  it("accepts https URLs on allowed hosts and their subdomains", () => {
    expect(validateDestination("https://spinmusic.uk/signup", SPIN_HOSTS).ok).toBe(true);
    expect(validateDestination("https://www.spinmusic.uk/signup", SPIN_HOSTS).ok).toBe(true);
  });

  it("rejects hosts that only look similar", () => {
    for (const url of [
      "https://evil.com/spinmusic.uk",
      "https://spinmusic.uk.evil.com/",
      "https://notspinmusic.uk/",
      "https://spinmusic.uk@evil.com/",
    ]) {
      expect(validateDestination(url, SPIN_HOSTS).ok, url).toBe(false);
    }
  });

  it("rejects non-https and malformed URLs", () => {
    expect(validateDestination("http://spinmusic.uk/", SPIN_HOSTS).ok).toBe(false);
    expect(validateDestination("javascript:alert(1)", SPIN_HOSTS).ok).toBe(false);
    expect(validateDestination("not a url", SPIN_HOSTS).ok).toBe(false);
  });

  it("rejects everything when the allow-list is empty", () => {
    expect(validateDestination("https://spinmusic.uk/", []).ok).toBe(false);
    expect(hostAllowed("spinmusic.uk", ["", "  "])).toBe(false);
  });
});

describe("buildRedirectUrl", () => {
  it("adds campaign tags and the click id to a web destination", () => {
    const url = new URL(buildRedirectUrl("https://spinmusic.uk/signup", tags));
    expect(url.origin + url.pathname).toBe("https://spinmusic.uk/signup");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      utm_source: "instagram",
      utm_medium: "dms",
      utm_campaign: "kenya-mentorship",
      utm_content: "kenya.money_math",
      dms_click: tags.clickId,
    });
  });

  it("falls back to the link slug when there is no campaign or pillar", () => {
    const url = new URL(
      buildRedirectUrl("https://spinmusic.uk/signup", { ...tags, campaignSlug: null, pillar: null }),
    );
    expect(url.searchParams.get("utm_campaign")).toBe("kenya");
    expect(url.searchParams.get("utm_content")).toBe("kenya");
  });

  it("never overwrites parameters already on the destination", () => {
    const url = new URL(
      buildRedirectUrl("https://spinmusic.uk/signup?utm_source=newsletter&redirectTo=%2Flisten", tags),
    );
    expect(url.searchParams.get("utm_source")).toBe("newsletter");
    expect(url.searchParams.get("redirectTo")).toBe("/listen");
    expect(url.searchParams.get("dms_click")).toBe(tags.clickId);
  });

  it("uses Apple's campaign parameters for App Store links, and nothing else", () => {
    const url = new URL(buildRedirectUrl("https://apps.apple.com/app/id123456789", tags));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      ct: "kenya-mentorship",
      pt: "126543210",
      mt: "8",
    });
  });

  it("omits pt when the brand has no provider token", () => {
    const url = new URL(buildRedirectUrl("https://apps.apple.com/app/id1", { ...tags, appStorePt: null }));
    expect(url.searchParams.has("pt")).toBe(false);
    expect(url.searchParams.get("ct")).toBe("kenya-mentorship");
  });

  it("caps the Apple campaign token at 30 characters", () => {
    const long = "a".repeat(40);
    expect(appStoreCampaignToken({ campaignSlug: long, linkSlug: "x1" })).toHaveLength(30);
  });
});

describe("slugs", () => {
  it("generates valid slugs without ambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      const slug = randomSlug();
      expect(slug).toMatch(SLUG_PATTERN);
      expect(slug).not.toMatch(/[01ilo]/);
    }
  });

  it("normalises names and rejects unusable or reserved ones", () => {
    expect(normalizeSlug("  Kenya Mentorship 2026! ")).toBe("kenya-mentorship-2026");
    expect(normalizeSlug("a")).toBeNull();
    expect(normalizeSlug("---")).toBeNull();
    expect(normalizeSlug("API")).toBeNull();
    expect(normalizeSlug("x".repeat(80))).toHaveLength(40);
  });
});

describe("user agent classification", () => {
  it("separates phones, tablets and desktops", () => {
    expect([classifyDevice(IPHONE), classifyOs(IPHONE)]).toEqual(["mobile", "ios"]);
    expect([classifyDevice(ANDROID_PHONE), classifyOs(ANDROID_PHONE)]).toEqual(["mobile", "android"]);
    expect([classifyDevice(ANDROID_TABLET), classifyOs(ANDROID_TABLET)]).toEqual(["tablet", "android"]);
    expect([classifyDevice(MAC), classifyOs(MAC)]).toEqual(["desktop", "macos"]);
    expect([classifyDevice(null), classifyOs(null)]).toEqual(["unknown", "unknown"]);
  });

  it("flags link-preview fetchers and scripts as bots", () => {
    for (const ua of [
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "WhatsApp/2.23.20.0 A",
      "Twitterbot/1.0",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "TelegramBot (like TwitterBot)",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "curl/8.7.1",
      "",
      null,
    ]) {
      expect(isBot(ua), String(ua)).toBe(true);
    }
  });

  it("does not flag real browsers, including Instagram's in-app browser", () => {
    for (const ua of [IPHONE, ANDROID_PHONE, ANDROID_TABLET, MAC, INSTAGRAM_IAB]) {
      expect(isBot(ua), ua).toBe(false);
    }
  });
});

describe("request metadata", () => {
  it("reads country from the edge and ignores placeholder codes", () => {
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "ng" }))).toBe("NG");
    expect(countryFromHeaders(new Headers({ "x-vercel-ip-country": "GB" }))).toBe("GB");
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "XX", "x-vercel-ip-country": "KE" }))).toBe("KE");
    expect(countryFromHeaders(new Headers())).toBeNull();
  });

  it("takes the first forwarded address as the client IP", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "cf-connecting-ip": "198.51.100.4", "x-forwarded-for": "10.0.0.1" }))).toBe("198.51.100.4");
    expect(clientIp(new Headers())).toBeNull();
  });

  it("keeps only the host of the referrer", () => {
    expect(refererHost(new Headers({ referer: "https://l.instagram.com/?u=secret&e=token" }))).toBe("l.instagram.com");
    expect(refererHost(new Headers({ referer: "garbage" }))).toBeNull();
    expect(refererHost(new Headers())).toBeNull();
  });
});

describe("visitorHash", () => {
  const base = { ip: "203.0.113.7", userAgent: IPHONE, brandId: "b1", salt: "s3cret" };
  const day1 = new Date("2026-10-05T10:00:00Z");

  it("is stable within a day and changes the next day", () => {
    const a = visitorHash({ ...base, now: day1 });
    expect(a).toBe(visitorHash({ ...base, now: new Date("2026-10-05T23:59:59Z") }));
    expect(a).not.toBe(visitorHash({ ...base, now: new Date("2026-10-06T00:00:01Z") }));
  });

  it("differs by brand, salt and address, and never contains the IP", () => {
    const a = visitorHash({ ...base, now: day1 })!;
    expect(a).not.toBe(visitorHash({ ...base, brandId: "b2", now: day1 }));
    expect(a).not.toBe(visitorHash({ ...base, salt: "other", now: day1 }));
    expect(a).not.toBe(visitorHash({ ...base, ip: "203.0.113.8", now: day1 }));
    expect(a).not.toContain("203.0.113.7");
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });

  it("returns null without an IP rather than hashing everyone together", () => {
    expect(visitorHash({ ...base, ip: null })).toBeNull();
  });
});

describe("parseLinkInput", () => {
  const form = {
    label: " Instagram bio ",
    destination: "https://spinmusic.uk/signup",
    channel: "instagram",
    pillar: "Money Math",
    slug: "",
    campaignId: "",
    newCampaign: "Kenya Mentorship Programme",
  };

  it("normalises a valid form", () => {
    const res = parseLinkInput(form, SPIN_HOSTS);
    expect(res).toEqual({
      ok: true,
      value: {
        label: "Instagram bio",
        destinationUrl: "https://spinmusic.uk/signup",
        channel: "instagram",
        pillar: "money_math",
        slug: null,
        campaignId: null,
        newCampaign: { name: "Kenya Mentorship Programme", slug: "kenya-mentorship-programme" },
      },
    });
  });

  it("rejects a destination outside the brand's allow-list", () => {
    const res = parseLinkInput({ ...form, destination: "https://evil.com/" }, SPIN_HOSTS);
    expect(res.ok).toBe(false);
  });

  it("rejects an unknown channel, a bad short name, and both campaign fields at once", () => {
    expect(parseLinkInput({ ...form, channel: "carrier-pigeon" }, SPIN_HOSTS).ok).toBe(false);
    expect(parseLinkInput({ ...form, slug: "!" }, SPIN_HOSTS).ok).toBe(false);
    expect(parseLinkInput({ ...form, campaignId: "abc" }, SPIN_HOSTS).ok).toBe(false);
  });

  it("treats missing optional fields as empty", () => {
    const res = parseLinkInput(
      { label: "x", destination: "https://spinmusic.uk/", channel: "email", pillar: null, slug: null, campaignId: null, newCampaign: null },
      SPIN_HOSTS,
    );
    expect(res.ok).toBe(true);
  });
});
