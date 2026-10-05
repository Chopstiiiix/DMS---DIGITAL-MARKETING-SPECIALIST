import { z } from "zod";
import { validateDestination } from "./destination";
import { normalizeSlug } from "./slug";

export const CHANNELS = [
  "instagram",
  "email",
  "dm",
  "whatsapp",
  "partner",
  "event",
  "press",
  "other",
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

const schema = z.object({
  label: z.string().trim().min(1, "Give the link a label.").max(160),
  destination: z.string().trim().min(1, "Enter a destination URL.").max(2000),
  channel: z.enum(CHANNELS, { message: "Choose a channel." }),
  pillar: optionalText(60),
  slug: optionalText(60),
  campaignId: optionalText(40),
  newCampaign: optionalText(120),
});

export interface LinkInput {
  label: string;
  destinationUrl: string;
  channel: (typeof CHANNELS)[number];
  pillar: string | null;
  /** null = generate one. */
  slug: string | null;
  campaignId: string | null;
  newCampaign: { name: string; slug: string } | null;
}

export type ParseResult = { ok: true; value: LinkInput } | { ok: false; error: string };

const tagify = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);

/** Validates the "new link" form against the brand's destination allow-list. */
export function parseLinkInput(
  raw: Record<string, FormDataEntryValue | null>,
  allowedHosts: readonly string[],
): ParseResult {
  const parsed = schema.safeParse({
    label: raw.label ?? "",
    destination: raw.destination ?? "",
    channel: raw.channel ?? "",
    pillar: raw.pillar ?? "",
    slug: raw.slug ?? "",
    campaignId: raw.campaignId ?? "",
    newCampaign: raw.newCampaign ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;

  const dest = validateDestination(v.destination, allowedHosts);
  if (!dest.ok) return { ok: false, error: dest.reason };

  let slug: string | null = null;
  if (v.slug) {
    slug = normalizeSlug(v.slug);
    if (!slug) return { ok: false, error: "Short name must be 2 to 40 letters, numbers or dashes." };
  }

  let newCampaign: LinkInput["newCampaign"] = null;
  if (v.newCampaign) {
    const campaignSlug = normalizeSlug(v.newCampaign);
    if (!campaignSlug) return { ok: false, error: "Campaign name needs at least 2 letters or numbers." };
    newCampaign = { name: v.newCampaign, slug: campaignSlug };
  }
  if (newCampaign && v.campaignId) {
    return { ok: false, error: "Pick an existing campaign or name a new one, not both." };
  }

  const pillar = v.pillar ? tagify(v.pillar) || null : null;

  return {
    ok: true,
    value: {
      label: v.label,
      destinationUrl: dest.url.toString(),
      channel: v.channel,
      pillar,
      slug,
      campaignId: v.campaignId,
      newCampaign,
    },
  };
}
