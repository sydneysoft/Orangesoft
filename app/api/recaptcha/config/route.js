export const dynamic = "force-dynamic";

export async function GET() {
  const siteKey = String(process.env.RECAPTCHA_SITE_KEY || "").trim();
  const secretKey = String(process.env.RECAPTCHA_SECRET_KEY || "").trim();
  const enabled = Boolean(siteKey && secretKey);

  return Response.json(
    { enabled, siteKey: enabled ? siteKey : "", provider: "google-recaptcha-v3" },
    { headers: { "cache-control": "no-store, max-age=0" } }
  );
}
