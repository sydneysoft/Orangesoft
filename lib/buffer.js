const BUFFER_ENDPOINT = "https://api.buffer.com";

export function isBufferConfigured() {
  return Boolean(process.env.BUFFER_API_KEY);
}

async function bufferGraphql(query, variables = {}) {
  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) throw new Error("BUFFER_API_KEY is not configured");

  const response = await fetch(BUFFER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Buffer API returned ${response.status}`);
  if (!payload) throw new Error("Buffer API returned an empty response");
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }
  return payload.data;
}

export async function findInstagramChannel(accountName) {
  const target = String(accountName || "").replace(/^@/, "").trim().toLowerCase();
  const accountData = await bufferGraphql(`
    query GetOrganizations {
      account { organizations { id name } }
    }
  `);

  const organizations = accountData?.account?.organizations ?? [];
  const matches = [];

  for (const organization of organizations) {
    const data = await bufferGraphql(
      `query GetChannels($organizationId: OrganizationId!) {
        channels(input: { organizationId: $organizationId }) {
          id name displayName service externalLink isDisconnected isLocked isQueuePaused
        }
      }`,
      { organizationId: organization.id }
    );

    for (const channel of data?.channels ?? []) {
      if (String(channel.service).toLowerCase() !== "instagram") continue;
      if (channel.isDisconnected || channel.isLocked) continue;
      const haystack = [channel.name, channel.displayName, channel.externalLink]
        .filter(Boolean).join(" ").toLowerCase();
      if (haystack.includes(target)) matches.push({ organization, channel });
    }
  }

  return matches.length === 1 ? matches[0] : null;
}

export async function getScheduledPosts(organizationId, channelId) {
  const data = await bufferGraphql(
    `query GetScheduledPosts($organizationId: OrganizationId!, $channelId: ChannelId!) {
      posts(
        first: 100
        input: {
          organizationId: $organizationId
          filter: { status: [scheduled], channelIds: [$channelId] }
          sort: [{ field: dueAt, direction: asc }]
        }
      ) {
        edges { node { id text dueAt status channelId } }
      }
    }`,
    { organizationId, channelId }
  );

  return (data?.posts?.edges ?? []).map((edge) => edge.node);
}

export async function publishPostNow(postId) {
  const data = await bufferGraphql(
    `mutation PublishNow($input: EditPostInput!) {
      editPost(input: $input) {
        ... on PostActionSuccess { post { id text dueAt sentAt status sharedNow shareMode } }
        ... on MutationError { message }
      }
    }`,
    { input: { id: postId, mode: "shareNow", schedulingType: "automatic" } }
  );

  const result = data?.editPost;
  if (result?.message && !result?.post) throw new Error(result.message);
  if (!result?.post) throw new Error("Buffer did not return the updated post");
  return result.post;
}

export async function createInstagramPost({
  channelId,
  text,
  dueAt,
  imageUrl,
  altText,
  mode = "customScheduled",
}) {
  const input = {
    text,
    channelId,
    schedulingType: "automatic",
    mode,
    aiAssisted: false,
    assets: [{ image: { url: imageUrl, metadata: { altText } } }],
    metadata: {
      instagram: {
        type: "post",
        shouldShareToFeed: true,
        isAiGenerated: false,
      },
    },
  };

  if (mode === "customScheduled") {
    input.dueAt = dueAt;
  }

  const data = await bufferGraphql(
    `mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess { post { id text dueAt sentAt status sharedNow shareMode } }
        ... on MutationError { message }
      }
    }`,
    { input }
  );

  const result = data?.createPost;
  if (result?.message && !result?.post) throw new Error(result.message);
  if (!result?.post) throw new Error("Buffer did not return the post");
  return result.post;
}
