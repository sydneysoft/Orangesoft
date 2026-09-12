export const runtime = "nodejs";
export const maxDuration = 60;

const REPOS = {
  orangesoft: { owner: "sydneysoft", repo: "Orangesoft", file: "Orangesoft-main.zip" },
  storylingo: { owner: "sydneysoft", repo: "hellboychronicles", file: "hellboychronicles-main.zip" },
};

export async function GET(request) {
  const url = new URL(request.url);
  const key = String(url.searchParams.get("repo") || "orangesoft").toLowerCase();
  const target = REPOS[key];

  if (!target) {
    return Response.json({ ok: false, error: "UNKNOWN REPOSITORY" }, { status: 400 });
  }

  const upstream = await fetch(
    `https://codeload.github.com/${target.owner}/${target.repo}/zip/refs/heads/main`,
    { cache: "no-store", headers: { "user-agent": "OrangeSoft-Blueprint-Bootstrap" } }
  );

  if (!upstream.ok || !upstream.body) {
    return Response.json(
      { ok: false, error: `GITHUB ARCHIVE FETCH FAILED: HTTP ${upstream.status}` },
      { status: 502 }
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${target.file}"`,
      "cache-control": "no-store",
    },
  });
}
