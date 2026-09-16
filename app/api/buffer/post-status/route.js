import { getBufferPost, isBufferConfigured } from "../../../../lib/buffer";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    if (!isBufferConfigured()) {
      return Response.json({ ok: false, message: "Buffer is not configured." }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();
    if (!id) {
      return Response.json({ ok: false, message: "Missing post id." }, { status: 400 });
    }

    const post = await getBufferPost(id);
    if (!post) {
      return Response.json({ ok: false, message: "Post not found." }, { status: 404 });
    }

    return Response.json({ ok: true, post });
  } catch (error) {
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : "Status check failed." },
      { status: 502 }
    );
  }
}
