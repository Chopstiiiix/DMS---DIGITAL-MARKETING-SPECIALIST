"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hostnameOf, isAppHost } from "@/lib/hosts";
import { createClient } from "@/lib/supabase/server";

export interface LoginState {
  error: string | null;
  /** Set once a sign-in link has been requested. */
  notice: string | null;
}

const LINK_NOTICE =
  "If that email has access, a sign-in link is on its way. Open it in this browser.";

/**
 * Origin the sign-in link should come back to. Only ever one of our own app
 * hosts: a spoofed Host header must not be able to steer the link elsewhere.
 * (Supabase also refuses redirect targets that are not on its allow-list.)
 */
async function appOrigin(): Promise<string | null> {
  const h = await headers();
  const host = hostnameOf(h);
  if (!isAppHost(host, process.env.APP_HOSTS)) return null;
  const rawHost = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]!.trim();
  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  return `${local ? "http" : "https"}://${rawHost}`;
}

/**
 * Two ways in, one form:
 *  - email + password, or
 *  - email only, which sends a one-time sign-in link.
 * Neither path creates accounts, and neither reveals whether an email exists.
 */
export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email) return { error: "Enter your email.", notice: null };

  const supabase = await createClient();

  if (password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "That email and password did not match.", notice: null };
    redirect("/");
  }

  const origin = await appOrigin();
  if (!origin) return { error: "Sign in from the DMS app address.", notice: null };

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error?.status === 429) {
    return { error: "Too many sign-in emails requested. Try again in a few minutes.", notice: null };
  }
  // Any other error (most often: no such account) gets the same neutral reply.
  if (error) console.error("[login] sign-in link not sent:", error.code ?? error.message);
  return { error: null, notice: LINK_NOTICE };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
