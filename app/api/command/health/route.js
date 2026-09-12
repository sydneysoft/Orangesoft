export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    env: {
      BLUEPRINT_ACCESS_KEY: Boolean(process.env.BLUEPRINT_ACCESS_KEY),
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
      BLUEPRINT_GITHUB_TOKEN: Boolean(process.env.BLUEPRINT_GITHUB_TOKEN),
    },
    vercel: {
      env: process.env.VERCEL_ENV || null,
      productionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL || null,
      deploymentUrl: process.env.VERCEL_URL || null,
      gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
    },
    note: "This endpoint intentionally exposes only presence/metadata, never secret values."
  });
}
