import { randomUUID } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { linkHashSalt } from "@/lib/env";
import { hostnameOf } from "@/lib/hosts";
import {
  classifyDevice,
  classifyOs,
  clientIp,
  countryFromHeaders,
  isBot,
  refererHost,
  visitorHash,
} from "@/lib/links/classify";
import { buildRedirectUrl, validateDestination } from "@/lib/links/destination";
import { SLUG_PATTERN } from "@/lib/links/slug";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Public short-link redirect.
 *
 *   https://<brand link domain>/<slug>   → proxy rewrites to /r/<slug>
 *   https://<app host>/r/<brand id>/<slug>  (fallback before a domain is set up)
 *
 * Always a 302 with no-store, so every click reaches this handler and is
 * counted. The click row is written after the response is sent; a logging
 * failure never costs the visitor their redirect.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BrandRow {
  id: string;
  org_id: string;
  default_destination: string;
  allowed_hosts: string[];
  app_store_pt: string | null;
}

interface LinkRow {
  id: string;
  slug: string;
  destination_url: string;
  channel: string;
  pillar: string | null;
  is_active: boolean;
  campaigns: { slug: string } | { slug: string }[] | null;
}

function redirect(url: string) {
  return new NextResponse(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

function notFound() {
  return new NextResponse("Link not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ parts: string[] }> },
) {
  const { parts } = await params;
  if (parts.length < 1 || parts.length > 2) return notFound();

  const db = adminClient();
  const brandSelect = "id, org_id, default_destination, allowed_hosts, app_store_pt";

  let brand: BrandRow | null = null;
  let slug: string;

  if (parts.length === 2) {
    const [brandId, linkSlug] = parts as [string, string];
    if (!UUID.test(brandId)) return notFound();
    const { data } = await db.from("brands").select(brandSelect).eq("id", brandId).maybeSingle<BrandRow>();
    brand = data;
    slug = linkSlug;
  } else {
    const host = hostnameOf(request.headers);
    const { data } = await db.from("brands").select(brandSelect).eq("link_domain", host).maybeSingle<BrandRow>();
    brand = data;
    slug = parts[0]!;
  }

  if (!brand) return notFound();

  slug = slug.toLowerCase();
  if (!SLUG_PATTERN.test(slug)) return redirect(brand.default_destination);

  const { data: link } = await db
    .from("links")
    .select("id, slug, destination_url, channel, pillar, is_active, campaigns(slug)")
    .eq("brand_id", brand.id)
    .eq("slug", slug)
    .maybeSingle<LinkRow>();

  if (!link || !link.is_active) return redirect(brand.default_destination);

  // Re-check at click time: the allow-list may have been tightened since the
  // link was created.
  const check = validateDestination(link.destination_url, brand.allowed_hosts);
  if (!check.ok) return redirect(brand.default_destination);

  const campaign = Array.isArray(link.campaigns) ? link.campaigns[0] : link.campaigns;
  const clickId = randomUUID();
  const target = buildRedirectUrl(link.destination_url, {
    channel: link.channel,
    campaignSlug: campaign?.slug ?? null,
    linkSlug: link.slug,
    pillar: link.pillar,
    clickId,
    appStorePt: brand.app_store_pt,
  });

  const headers = request.headers;
  const userAgent = headers.get("user-agent");
  const row = {
    id: clickId,
    org_id: brand.org_id,
    brand_id: brand.id,
    link_id: link.id,
    country: countryFromHeaders(headers),
    device: classifyDevice(userAgent),
    os: classifyOs(userAgent),
    referer_host: refererHost(headers),
    visitor_hash: visitorHash({
      ip: clientIp(headers),
      userAgent,
      brandId: brand.id,
      salt: linkHashSalt(),
    }),
    // HEAD requests are link checkers, not people.
    is_bot: request.method === "HEAD" || isBot(userAgent),
  };

  after(async () => {
    const { error } = await db.from("link_clicks").insert(row);
    if (error) console.error("[redirect] click insert failed", error.message);
  });

  return redirect(target);
}
