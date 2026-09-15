import {
  createInstagramPost,
  findInstagramChannel,
  isBufferConfigured,
} from "../../../../lib/buffer";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isBufferConfigured()) {
    return Response.json(
      { ok: false, message: "BUFFER_API_KEY is not configured on the orangesoft deployment." },
      { status: 503 }
    );
  }

  try {
    const match = await findInstagramChannel("storylingo.uk");
    if (!match) {
      return Response.json(
        { ok: false, message: "Could not find a unique connected @storylingo.uk Instagram channel in Buffer." },
        { status: 404 }
      );
    }

    const post = await createInstagramPost({
      channelId: match.channel.id,
      dueAt: "2026-09-15T12:50:00.000Z",
      text: "Stories make language memorable. 📚🌍\n\nStoryLingo helps you learn through illustrated stories, multilingual reading and vocabulary in context.\n\nExplore the library at storylingo.uk\n\n#StoryLingo #LanguageLearning #LearnThroughStories #LearnLanguages",
      imageUrl: "https://raw.githubusercontent.com/sydneysoft/hellboychronicles/main/covers-lite/folk-collection.webp",
      altText: "StoryLingo illustrated folk tales collection",
    });

    return Response.json({
      ok: true,
      account: match.channel.displayName || match.channel.name || "storylingo.uk",
      post,
    });
  } catch (error) {
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : "Buffer test post failed." },
      { status: 502 }
    );
  }
}
