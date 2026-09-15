import {
  createInstagramPost,
  editInstagramPost,
  findInstagramChannel,
  getBufferPost,
  isBufferConfigured,
} from "../../../../lib/buffer";

export const dynamic = "force-dynamic";

const POST_ID = "6aa93ce5947833e10e9583f6";
const IMAGE_URL = "https://www.orangesoft.uk/api/storylingo-card";
const ALT_TEXT = "StoryLingo language-learning library with six languages and built-in translation, vocabulary and practice features";
const TEXT = `Learn languages through stories you actually want to read. 📚🌍

StoryLingo is a multilingual reading and language-learning library. Switch between English, Ukrainian, Polish, French, German and Spanish, keep translation and vocabulary close at hand, and practise words in context as you read.

Explore the library at storylingo.uk

#languagelearning #languages #learnlanguages #languagestudy #learninglanguages #vocabulary #reading #studygram`;

export async function GET() {
  if (!isBufferConfigured()) {
    return Response.json({ ok: false, message: "BUFFER_API_KEY is not configured." }, { status: 503 });
  }

  try {
    const current = await getBufferPost(POST_ID);
    if (!current) {
      return Response.json({ ok: false, message: "Original StoryLingo Buffer post was not found." }, { status: 404 });
    }

    if (Array.isArray(current.allowedActions) && current.allowedActions.includes("editPost")) {
      const post = await editInstagramPost(POST_ID, {
        text: TEXT,
        imageUrl: IMAGE_URL,
        altText: ALT_TEXT,
      });
      return Response.json({ ok: true, action: "edited-existing", before: current, post });
    }

    const match = await findInstagramChannel("storylingo.uk");
    if (!match) {
      return Response.json({ ok: false, message: "Could not find @storylingo.uk in Buffer.", current }, { status: 404 });
    }

    const post = await createInstagramPost({
      channelId: match.channel.id,
      text: TEXT,
      imageUrl: IMAGE_URL,
      altText: ALT_TEXT,
      mode: "shareNow",
    });

    return Response.json({
      ok: true,
      action: "published-corrected-replacement",
      reason: "Original post is no longer editable in Buffer.",
      original: current,
      post,
    });
  } catch (error) {
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : "StoryLingo correction failed." },
      { status: 502 }
    );
  }
}
