import { getBufferPost, publishPostNow } from "../../../../lib/buffer";

export const dynamic = "force-dynamic";

const postId = "6aa971ba02bda32caae8814d";
const imageUrl = "https://www.orangesoft.uk/api/orangesoft-social-card?card=research";
const altText = "OrangeSoft research card about artificial intelligence and advanced computing";

export async function GET() {
  try {
    const post = await getBufferPost(postId);
    if (!post) return Response.json({ ok: false, message: "OrangeSoft post not found." }, { status: 404 });
    if (post.sentAt || post.status === "sent") return Response.json({ ok: true, alreadyPublished: true, post });
    const published = await publishPostNow(postId, { text: post.text, imageUrl, altText });
    return Response.json({ ok: true, published });
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : "Publish failed." }, { status: 502 });
  }
}
