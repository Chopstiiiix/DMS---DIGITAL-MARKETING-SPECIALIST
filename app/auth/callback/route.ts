import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for the emailed sign-in link.
 *
 * Supabase sends the browser here with `?code=…` (the default link) or with
 * `?token_hash=…&type=…` (if the project's email template is customised).
 * Either is exchanged for a session cookie, then the visitor goes to the app.
 * The destination is fixed: nothing in the query string can choose it.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const to = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path.split("?")[0]!;
    url.search = path.includes("?") ? path.slice(path.indexOf("?")) : "";
    return NextResponse.redirect(url);
  };

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return to("/");
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return to("/");
  }

  return to("/login?error=link");
}
