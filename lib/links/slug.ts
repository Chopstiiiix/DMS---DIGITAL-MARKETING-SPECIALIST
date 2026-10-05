import { randomInt } from "node:crypto";

// No 0/o, 1/l/i: slugs get read aloud and typed from posters.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;

/** Slugs that would collide with the redirector's own routes. */
const RESERVED = new Set(["_root", "api", "r", "login", "links", "favicon.ico", "robots.txt"]);

export function randomSlug(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** Normalises user input to a slug, or returns null if nothing usable is left. */
export function normalizeSlug(input: string): string | null {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  if (!SLUG_PATTERN.test(slug) || RESERVED.has(slug)) return null;
  return slug;
}
