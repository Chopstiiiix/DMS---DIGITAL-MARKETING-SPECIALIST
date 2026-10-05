import "server-only";
import { createClient } from "@supabase/supabase-js";
import { DB_SCHEMA, supabaseSecretKey, supabaseUrl } from "@/lib/env";

function make() {
  return createClient(supabaseUrl(), supabaseSecretKey(), {
    db: { schema: DB_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let client: ReturnType<typeof make> | null = null;

/**
 * Service-role client. Bypasses row level security, so it is used only where
 * there is no signed-in user (the public redirect) or for append-only system
 * rows (clicks, audit). Never return its results to a browser unfiltered.
 */
export function adminClient() {
  return (client ??= make());
}
