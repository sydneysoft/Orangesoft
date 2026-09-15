import {
  createInstagramPost,
  findInstagramChannel,
  getScheduledPosts,
  isBufferConfigured,
  publishPostNow,
} from "../../../../lib/buffer";

export const dynamic = "force-dynamic";

const TEXT = "Stories make language memorable. 📚🌍\n\nStoryLingo helps you learn through illustrated stories, multilingual reading and vocabulary in context.\n\nExplore the library at storylingo.uk\n\n#StoryLingo #LanguageLearning #LearnThroughStories #LearnLanguages";

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

    const scheduled = await getScheduledPosts(match.organization.id, match.channel.id);
    const existing = scheduled.find((post) => post.text === TEXT);

    const post = existing
      ? await publishPostNow(existing.id)
      : await createInstagramPost({
          channelId: match.channel.id,
          mode: "shareNow",
          text: TEXT,
          imageUrl: "https://raw.githubusercontent.com/sydneysoft/hellboychronicles/main/covers-lite/folk-collection.webp",
          altText: "StoryLingo illustrated folk tales collection",
        });

    return Response.json({
      ok: true,
      account: match.channel.displayName || match.channel.name || "storylingo.uk",
      action: existing ? "published-existing" : "published-new",
      post,
    });
  } catch (error) {
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : "Buffer publish-now failed." },
      { status: 502 }
    );
  }
}
