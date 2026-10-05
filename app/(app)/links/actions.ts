"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/context";
import { parseLinkInput } from "@/lib/links/input";
import { randomSlug } from "@/lib/links/slug";
import { adminClient } from "@/lib/supabase/admin";

export interface CreateLinkState {
  error: string | null;
  createdSlug: string | null;
}

const UNIQUE_VIOLATION = "23505";

export async function createLink(
  _prev: CreateLinkState,
  formData: FormData,
): Promise<CreateLinkState> {
  const fail = (error: string): CreateLinkState => ({ error, createdSlug: null });

  const { supabase, user, brand } = await getContext();
  if (!brand) return fail("No brand selected.");

  const parsed = parseLinkInput(
    {
      label: formData.get("label"),
      destination: formData.get("destination"),
      channel: formData.get("channel"),
      pillar: formData.get("pillar"),
      slug: formData.get("slug"),
      campaignId: formData.get("campaignId"),
      newCampaign: formData.get("newCampaign"),
    },
    brand.allowed_hosts,
  );
  if (!parsed.ok) return fail(parsed.error);
  const input = parsed.value;

  // All writes below go through the user's client, so row level security and
  // the tenancy triggers decide whether they are allowed.
  let campaignId = input.campaignId;
  if (input.newCampaign) {
    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        org_id: brand.org_id,
        brand_id: brand.id,
        name: input.newCampaign.name,
        slug: input.newCampaign.slug,
      })
      .select("id")
      .single();
    if (error) {
      return fail(
        error.code === UNIQUE_VIOLATION
          ? "A campaign with that name already exists. Pick it from the list."
          : "Could not create the campaign.",
      );
    }
    campaignId = data.id as string;
  }

  // A custom short name gets one attempt; generated ones retry on collision.
  const attempts = input.slug ? 1 : 4;
  for (let i = 0; i < attempts; i++) {
    const slug = input.slug ?? randomSlug();
    const { data, error } = await supabase
      .from("links")
      .insert({
        org_id: brand.org_id,
        brand_id: brand.id,
        campaign_id: campaignId,
        slug,
        label: input.label,
        destination_url: input.destinationUrl,
        channel: input.channel,
        pillar: input.pillar,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (!error) {
      const { error: auditError } = await adminClient().from("audit_events").insert({
        org_id: brand.org_id,
        actor_id: user.id,
        action: "link.create",
        entity: "link",
        entity_id: data.id,
        metadata: { slug, channel: input.channel, destination: input.destinationUrl },
      });
      if (auditError) console.error("[links] audit insert failed", auditError.message);

      revalidatePath("/links");
      revalidatePath("/");
      return { error: null, createdSlug: slug };
    }
    if (error.code !== UNIQUE_VIOLATION) return fail("Could not create the link.");
    if (input.slug) return fail("That short name is already used for this brand.");
  }
  return fail("Could not find a free short name. Try again.");
}
