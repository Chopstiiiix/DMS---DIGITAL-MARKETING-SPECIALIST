/** Reads a required environment variable, failing loudly with its name. */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

// NEXT_PUBLIC_* must be referenced literally so Next can inline them.
export const supabaseUrl = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const supabasePublishableKey = () =>
  required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

/** Server only. Bypasses row level security — never import into client code. */
export const supabaseSecretKey = () =>
  required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);

/** Server only. Salt for the unique-visitor hash. */
export const linkHashSalt = () => required("LINK_HASH_SALT", process.env.LINK_HASH_SALT);

/**
 * Postgres schema holding every DMS table. DMS shares a Supabase project with
 * other apps, so it keeps out of `public`. Must be listed under the project's
 * exposed schemas (Settings → API).
 */
export const DB_SCHEMA = "dms";
