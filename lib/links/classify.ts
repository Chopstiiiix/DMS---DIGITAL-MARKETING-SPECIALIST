import { createHash } from "node:crypto";

export type Device = "mobile" | "tablet" | "desktop" | "unknown";
export type Os = "ios" | "android" | "windows" | "macos" | "linux" | "unknown";

// Link-preview fetchers and crawlers. They follow the redirect like a person
// would, so without this every Instagram/WhatsApp share would count as a click.
const BOT_PATTERN =
  /bot\b|bot\/|crawler|spider|facebookexternalhit|facebookcatalog|meta-externalagent|whatsapp|telegrambot|twitterbot|slackbot|slack-imgproxy|discordbot|linkedinbot|pinterest|skypeuripreview|embedly|quora link preview|vkshare|redditbot|applebot|bingpreview|google-inspectiontool|googleother|headlesschrome|lighthouse|pingdom|uptimerobot|curl\/|wget\/|python-requests|go-http-client|axios\/|node-fetch|okhttp|java\/|libwww|httpclient|preview/i;

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim().length < 12) return true;
  return BOT_PATTERN.test(userAgent);
}

export function classifyOs(userAgent: string | null | undefined): Os {
  const ua = userAgent ?? "";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/windows/i.test(ua)) return "windows";
  if (/mac os x|macintosh/i.test(ua)) return "macos";
  if (/linux|cros/i.test(ua)) return "linux";
  return "unknown";
}

export function classifyDevice(userAgent: string | null | undefined): Device {
  const ua = userAgent ?? "";
  if (!ua) return "unknown";
  if (/ipad|tablet|kindle|silk|playbook/i.test(ua)) return "tablet";
  if (/android/i.test(ua)) return /mobile/i.test(ua) ? "mobile" : "tablet";
  if (/iphone|ipod|mobile|windows phone/i.test(ua)) return "mobile";
  if (/windows|macintosh|mac os x|linux|cros/i.test(ua)) return "desktop";
  return "unknown";
}

const ISO2 = /^[A-Z]{2}$/;
const UNKNOWN_COUNTRY = new Set(["XX", "T1", "ZZ", "A1", "A2", "EU"]);

/** ISO country from the edge (Cloudflare first, then Vercel), or null. */
export function countryFromHeaders(headers: Headers): string | null {
  for (const name of ["cf-ipcountry", "x-vercel-ip-country"]) {
    const cc = headers.get(name)?.trim().toUpperCase();
    if (cc && ISO2.test(cc) && !UNKNOWN_COUNTRY.has(cc)) return cc;
  }
  return null;
}

export function clientIp(headers: Headers): string | null {
  const direct = headers.get("cf-connecting-ip") ?? headers.get("x-real-ip");
  if (direct) return direct.trim();
  const forwarded = headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0]!.trim() : null;
}

/** Host of the referring page, never the full URL (which can carry personal data). */
export function refererHost(headers: Headers): string | null {
  const raw = headers.get("referer");
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase().slice(0, 120) || null;
  } catch {
    return null;
  }
}

/**
 * Unique-visitor key without keeping the IP address.
 *
 * The hash is salted with a secret and the UTC date, so the same person hashes
 * differently tomorrow and the value cannot be reversed to an IP. That makes
 * "visitors" a per-day count, which is the honest limit of cookieless counting.
 */
export function visitorHash(input: {
  ip: string | null;
  userAgent: string | null;
  brandId: string;
  salt: string;
  now?: Date;
}): string | null {
  if (!input.ip) return null;
  const day = (input.now ?? new Date()).toISOString().slice(0, 10);
  return createHash("sha256")
    .update([input.salt, day, input.brandId, input.ip, input.userAgent ?? ""].join("|"))
    .digest("hex")
    .slice(0, 32);
}
