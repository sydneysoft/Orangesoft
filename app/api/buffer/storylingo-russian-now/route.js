import { createInstagramPost, findInstagramChannel, isBufferConfigured } from "../../../../lib/buffer";

export const dynamic = "force-dynamic";

const text = `Russian is now available in StoryLingo. 🇷🇺📚\n\nUniversal Stories can now be read in Russian alongside English, Polish, French, German and Spanish. Switch languages while staying in the same story, explore vocabulary, listen to the text and practise words in context.\n\nAvailable now on storylingo.uk\n\n#StoryLingo #Russian #LearnRussian #LanguageLearning #Languages #Vocabulary #Reading #Polyglot`;

export async function GET() {
  try {
    if (!isBufferConfigured()) return Response.json({ ok:false, message:"Buffer is not configured." }, { status:503 });
    const match = await findInstagramChannel("storylingo.uk");
    if (!match) return Response.json({ ok:false, message:"StoryLingo Instagram channel not found." }, { status:404 });
    const nonce = Date.now();
    const published = await createInstagramPost({
      channelId: match.channel.id,
      text,
      imageUrl: `https://www.orangesoft.uk/api/storylingo-russian-card?v=${nonce}`,
      altText: "StoryLingo announcement that Russian is now available in Universal Stories",
      mode: "shareNow",
    });
    return Response.json({ ok:true, published });
  } catch (error) {
    return Response.json({ ok:false, message:error instanceof Error ? error.message : "Publish failed." }, { status:502 });
  }
}
