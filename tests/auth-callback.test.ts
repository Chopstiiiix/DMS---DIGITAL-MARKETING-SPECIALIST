import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth }),
}));

async function hit(query: string) {
  const { GET } = await import("@/app/auth/callback/route");
  return GET(new NextRequest(`https://dms.example.test/auth/callback${query}`));
}

beforeEach(() => {
  auth.exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  auth.verifyOtp.mockReset().mockResolvedValue({ error: null });
});

describe("GET /auth/callback", () => {
  it("exchanges the code and sends the visitor to the app", async () => {
    const res = await hit("?code=abc123");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(res.headers.get("location")).toBe("https://dms.example.test/");
  });

  it("accepts a token hash from a customised email template", async () => {
    const res = await hit("?token_hash=h4sh&type=email");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "h4sh", type: "email" });
    expect(res.headers.get("location")).toBe("https://dms.example.test/");
  });

  it("returns to the login page when the link is expired or reused", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: { message: "expired" } });
    const res = await hit("?code=old");
    expect(res.headers.get("location")).toBe("https://dms.example.test/login?error=link");
  });

  it("returns to the login page when nothing usable is supplied", async () => {
    const res = await hit("");
    expect(res.headers.get("location")).toBe("https://dms.example.test/login?error=link");
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("ignores any redirect target in the query string", async () => {
    const res = await hit("?code=abc&next=https://evil.example/&redirect_to=https://evil.example/");
    expect(res.headers.get("location")).toBe("https://dms.example.test/");
  });
});
