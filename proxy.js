import { NextResponse } from "next/server";

const ACTION = "blueprint_command";
const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

function json(data, status) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store, max-age=0" } });
}

export async function proxy(request) {
  if (request.method === "OPTIONS") return NextResponse.next();

  const siteKey = String(process.env.RECAPTCHA_SITE_KEY || "").trim();
  const secretKey = String(process.env.RECAPTCHA_SECRET_KEY || "").trim();

  if (!siteKey && !secretKey) return NextResponse.next();
  if (!siteKey || !secretKey) {
    return json({ executed: false, output: "reCAPTCHA configuration is incomplete on the server." }, 503);
  }

  const token = String(request.headers.get("x-recaptcha-token") || "").trim();
  if (!token) {
    return json({ executed: false, output: "HUMAN VERIFICATION REQUIRED. RELOAD BLUEPRINT AND TRY AGAIN." }, 403);
  }

  try {
    const body = new URLSearchParams({ secret: secretKey, response: token });
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    const minScore = Math.max(0, Math.min(1, Number(process.env.RECAPTCHA_MIN_SCORE || 0.5)));
    const score = Number(result?.score ?? 0);
    const actionMatches = result?.action === ACTION;

    if (!response.ok || result?.success !== true || !actionMatches || score < minScore) {
      return json({
        executed: false,
        output: "HUMAN VERIFICATION FAILED. PLEASE TRY AGAIN.",
        recaptcha: { success: Boolean(result?.success), score, action: result?.action || null },
      }, 403);
    }

    const headers = new Headers(request.headers);
    headers.delete("x-recaptcha-token");
    headers.set("x-recaptcha-verified", "1");
    headers.set("x-recaptcha-score", String(score));
    return NextResponse.next({ request: { headers } });
  } catch {
    return json({ executed: false, output: "HUMAN VERIFICATION SERVICE IS TEMPORARILY UNAVAILABLE." }, 503);
  }
}

export const config = {
  matcher: "/api/command/:path*",
};
