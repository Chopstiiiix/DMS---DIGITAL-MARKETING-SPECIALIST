import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface Brand {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  link_domain: string | null;
  default_destination: string;
  allowed_hosts: string[];
}

/**
 * Signed-in user plus the brand being viewed. Brands come back through row
 * level security, so a user only ever sees brands of organizations they
 * belong to.
 */
export async function getContext(brandSlug?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("brands")
    .select("id, org_id, name, slug, link_domain, default_destination, allowed_hosts")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load brands: ${error.message}`);

  const brands = (data ?? []) as Brand[];
  const brand = brands.find((b) => b.slug === brandSlug) ?? brands[0] ?? null;
  return { supabase, user, brands, brand };
}

/** Public short URL for a link, on the brand's own domain when it has one. */
export function shortUrl(brand: Brand, slug: string, appOrigin: string): string {
  return brand.link_domain
    ? `https://${brand.link_domain}/${slug}`
    : `${appOrigin}/r/${brand.id}/${slug}`;
}
