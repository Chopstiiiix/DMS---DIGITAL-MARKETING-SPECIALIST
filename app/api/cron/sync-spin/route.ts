import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cronSecret } from "@/lib/env";
import { syncSpin } from "@/lib/sync/spin";

/**
 * Daily Spin → DMS funnel sync, called by Vercel Cron (see vercel.json) with
 * `Authorization: Bearer <CRON_SECRET>`. Also callable by hand with the same
 * header. Returns counts only, never user data.
 */

export const maxDuration = 60;

const digest = (s: string) => createHash("sha256").update(s).digest();

export async function GET(request: NextRequest) {
  const given = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(given), digest(`Bearer ${cronSecret()}`))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncSpin();
    console.log("[sync-spin]", result);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[sync-spin] failed", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
