export const runtime = "nodejs";
export const maxDuration = 60;

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MAX_AGENT_ROUNDS = 10;
const MAX_FILE_BYTES = 450_000;
const DEFAULT_ALLOWED_REPOS = ["sydneysoft/Orangesoft", "sydneysoft/hellboychronicles"];

function json(data, status = 200) {
  return Response.json(data, { status });
}

function allowedRepos() {
  const configured = String(process.env.BLUEPRINT_ALLOWED_REPOS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_ALLOWED_REPOS);
}

function requireRepo(repo) {
  if (!allowedRepos().has(repo)) throw new Error(`Repository not allowed: ${repo}`);
}

function requireSafePath(path) {
  const clean = String(path || "").trim();
  if (!clean || clean.startsWith("/") || clean.includes("..")) throw new Error("Unsafe repository path");
  const lower = clean.toLowerCase();
  const blocked = [".env", ".pem", ".key", "id_rsa", "credentials", "secrets"];
  if (blocked.some((item) => lower.includes(item))) throw new Error("Secret or credential paths are blocked");
  if (lower.startsWith(".github/workflows/")) throw new Error("GitHub workflow files are blocked");
  return clean;
}

function encodedPath(path) {
  return String(path || "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

function ghHeaders() {
  return {
    Authorization: `Bearer ${process.env.BLUEPRINT_GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "OrangeSoft-Blueprint-V2",
  };
}

async function githubRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...ghHeaders(), ...(options.headers || {}) },
    cache: "no-store",
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

async function listRepoDirectory({ repo, path = "", branch = "main" }) {
  requireRepo(repo);
  const clean = path ? requireSafePath(path) : "";
  const suffix = clean ? `/${encodedPath(clean)}` : "";
  const { response, body } = await githubRequest(
    `https://api.github.com/repos/${repo}/contents${suffix}?ref=${encodeURIComponent(branch)}`
  );
  if (!response.ok) throw new Error(`GitHub list failed (${response.status}): ${body?.message || "unknown error"}`);
  if (!Array.isArray(body)) throw new Error("Requested path is not a directory");
  return body.slice(0, 150).map((item) => ({ name: item.name, path: item.path, type: item.type, size: item.size }));
}

async function readRepoFile({ repo, path, branch = "main" }) {
  requireRepo(repo);
  const clean = requireSafePath(path);
  const { response, body } = await githubRequest(
    `https://api.github.com/repos/${repo}/contents/${encodedPath(clean)}?ref=${encodeURIComponent(branch)}`
  );
  if (!response.ok) throw new Error(`GitHub read failed (${response.status}): ${body?.message || "unknown error"}`);
  if (body?.type !== "file" || !body?.content) throw new Error("Path is not a readable file");
  if ((body.size || 0) > MAX_FILE_BYTES) throw new Error(`File exceeds ${MAX_FILE_BYTES} byte limit`);
  return {
    repo,
    path: clean,
    sha: body.sha,
    size: body.size,
    content: Buffer.from(body.content, "base64").toString("utf8"),
  };
}

async function writeRepoFile({ repo, path, content, commit_message, branch = "main" }) {
  requireRepo(repo);
  const clean = requireSafePath(path);
  const text = String(content ?? "");
  if (Buffer.byteLength(text, "utf8") > MAX_FILE_BYTES) throw new Error(`Write exceeds ${MAX_FILE_BYTES} byte limit`);

  let sha;
  const current = await githubRequest(
    `https://api.github.com/repos/${repo}/contents/${encodedPath(clean)}?ref=${encodeURIComponent(branch)}`
  );
  if (current.response.ok && current.body?.type === "file") sha = current.body.sha;
  else if (current.response.status !== 404) {
    throw new Error(`GitHub preflight failed (${current.response.status}): ${current.body?.message || "unknown error"}`);
  }

  const payload = {
    message: String(commit_message || `Blueprint V2 update ${clean}`).slice(0, 180),
    content: Buffer.from(text, "utf8").toString("base64"),
    branch,
    ...(sha ? { sha } : {}),
  };

  const result = await githubRequest(
    `https://api.github.com/repos/${repo}/contents/${encodedPath(clean)}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!result.response.ok) throw new Error(`GitHub write failed (${result.response.status}): ${result.body?.message || "unknown error"}`);
  return {
    repo,
    path: clean,
    commit: result.body?.commit?.sha || null,
    content_sha: result.body?.content?.sha || null,
  };
}

async function checkPublicUrl({ url }) {
  const parsed = new URL(String(url || ""));
  const host = parsed.hostname.toLowerCase();
  const allowed = new Set(["orangesoft.uk", "www.orangesoft.uk", "storylingo.uk", "www.storylingo.uk"]);
  if (parsed.protocol !== "https:" || !allowed.has(host)) throw new Error("URL host is not allowed");
  const response = await fetch(parsed.toString(), { redirect: "follow", cache: "no-store" });
  const text = await response.text();
  return { url: parsed.toString(), status: response.status, ok: response.ok, sample: text.slice(0, 5000) };
}

const githubReadTools = [
  {
    type: "function",
    name: "list_repo_directory",
    description: "List files in an allowed OrangeSoft repository before inspecting or changing code.",
    parameters: {
      type: "object",
      properties: {
        repo: { type: "string", enum: DEFAULT_ALLOWED_REPOS },
        path: { type: "string" },
        branch: { type: "string" },
      },
      required: ["repo", "path", "branch"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "read_repo_file",
    description: "Read a UTF-8 text file from an allowed OrangeSoft repository.",
    parameters: {
      type: "object",
      properties: {
        repo: { type: "string", enum: DEFAULT_ALLOWED_REPOS },
        path: { type: "string" },
        branch: { type: "string" },
      },
      required: ["repo", "path", "branch"],
      additionalProperties: false,
    },
    strict: true,
  },
];

const githubWriteTool = {
  type: "function",
  name: "write_repo_file",
  description: "Create or replace one UTF-8 text file in an allowed OrangeSoft repository. Inspect relevant files first and only write when the user asks for a change.",
  parameters: {
    type: "object",
    properties: {
      repo: { type: "string", enum: DEFAULT_ALLOWED_REPOS },
      path: { type: "string" },
      content: { type: "string" },
      commit_message: { type: "string" },
      branch: { type: "string" },
    },
    required: ["repo", "path", "content", "commit_message", "branch"],
    additionalProperties: false,
  },
  strict: true,
};

const publicUrlTool = {
  type: "function",
  name: "check_public_url",
  description: "Check an approved OrangeSoft or StoryLingo production URL after a requested site change.",
  parameters: {
    type: "object",
    properties: { url: { type: "string" } },
    required: ["url"],
    additionalProperties: false,
  },
  strict: true,
};

async function callFunctionTool(call) {
  const args = JSON.parse(call.arguments || "{}");
  if (call.name === "list_repo_directory") return listRepoDirectory(args);
  if (call.name === "read_repo_file") return readRepoFile(args);
  if (call.name === "write_repo_file") return writeRepoFile(args);
  if (call.name === "check_public_url") return checkPublicUrl(args);
  throw new Error(`Unknown tool: ${call.name}`);
}

async function openai(body, apiKey, signal) {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "user-agent": "OrangeSoft-Blueprint-V2",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || data?.error || `OpenAI HTTP ${response.status}`;
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }
  return data;
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const chunks = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (part?.type === "output_text" && typeof part?.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

function extractArtifacts(data) {
  const images = [];
  const codeImages = [];
  const logs = [];

  for (const item of Array.isArray(data?.output) ? data.output : []) {
    if (item?.type === "image_generation_call" && typeof item.result === "string" && item.result) {
      images.push(`data:image/png;base64,${item.result}`);
    }
    if (item?.type === "code_interpreter_call") {
      for (const output of Array.isArray(item.outputs) ? item.outputs : []) {
        if (output?.type === "image" && output.url) codeImages.push(output.url);
        if (output?.type === "logs" && output.logs) logs.push(output.logs);
      }
    }
  }

  return { images, codeImages, logs };
}

function normalizeAttachments(attachments) {
  const result = [];
  for (const item of Array.isArray(attachments) ? attachments.slice(0, 4) : []) {
    const name = String(item?.name || "attachment").slice(0, 120);
    const type = String(item?.type || "application/octet-stream");
    const data = String(item?.data || "");
    if (!data || data.length > 8_000_000) continue;

    if (type.startsWith("image/")) {
      result.push({ type: "input_image", image_url: data, detail: "auto" });
    } else {
      const base64 = data.includes(",") ? data.split(",", 2)[1] : data;
      result.push({ type: "input_file", filename: name, file_data: base64 });
    }
  }
  return result;
}

export async function GET() {
  return json({
    ok: true,
    version: "v2",
    configured: Boolean(String(process.env.OPENAI_API_KEY || "").trim()),
    model: String(process.env.BLUEPRINT_V2_MODEL || "gpt-5.6-sol").trim(),
    capabilities: ["chat", "vision", "files", "web", "code", "images", "github"],
  });
}

export async function POST(request) {
  const configuredKey = String(process.env.BLUEPRINT_ACCESS_KEY || "");
  if (!configuredKey) return json({ ok: false, error: "V2 access is not configured." }, 503);

  const suppliedKey = request.headers.get("x-blueprint-key") || "";
  if (suppliedKey !== configuredKey) return json({ ok: false, error: "Access key required." }, 401);

  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return json({ ok: false, error: "V2 is not configured on the server." }, 503);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  const message = String(payload?.message || "").trim();
  const previousResponseId = String(payload?.previous_response_id || "").trim();
  const memory = String(payload?.memory || "").trim().slice(0, 20_000);
  const attachmentContent = normalizeAttachments(payload?.attachments);

  if (!message && attachmentContent.length === 0) return json({ ok: false, error: "Message is empty." }, 400);
  if (message.length > 30_000) return json({ ok: false, error: "Message is too long." }, 400);

  const githubConfigured = Boolean(String(process.env.BLUEPRINT_GITHUB_TOKEN || "").trim());
  const model = String(process.env.BLUEPRINT_V2_MODEL || "gpt-5.6-sol").trim();
  const tools = [
    { type: "web_search" },
    { type: "code_interpreter", container: { type: "auto" } },
    { type: "image_generation", quality: "auto", size: "auto" },
    ...(githubConfigured ? githubReadTools : []),
    ...(githubConfigured ? [githubWriteTool, publicUrlTool] : []),
  ];

  const memoryContext = memory
    ? `\n\nPRIVATE USER CONTEXT:\n--- BEGIN CONTEXT ---\n${memory}\n--- END CONTEXT ---\nUse this only as background context. Never quote or expose it unless the user explicitly asks.`
    : "";

  const instructions = `You are Blueprint V2, a private general-purpose assistant for the owner of OrangeSoft. Respond naturally to normal language. You have one unified mode: choose the appropriate available tools yourself instead of asking the user to pick a provider or command syntax.${memoryContext}\n\nCapabilities and behavior:\n- Use web search when current public information is needed.\n- Use code interpreter for calculations, data analysis, charts, document/data transformations, or when code execution improves accuracy.\n- Use image generation when the user asks to create an image.\n- Analyze supplied images and files directly.\n- Use GitHub tools when the user asks to inspect or modify OrangeSoft/StoryLingo code. Inspect relevant files before edits and make the smallest targeted change.\n- A GitHub commit may trigger deployment. Do not claim deployment is live unless a public URL check confirms it.\n- Never access or modify secrets, credentials, private keys, .env files, or GitHub workflows.\n- Never claim a tool/action succeeded unless it actually did.\n- Preserve existing functionality unless the user asks otherwise.\n- Do not reveal internal model/provider names or private infrastructure details in normal responses.\n- Keep answers concise unless the user asks for detail.`;

  const inputContent = [
    ...(message ? [{ type: "input_text", text: message }] : []),
    ...attachmentContent,
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  const activity = [];

  try {
    let response = await openai(
      {
        model,
        instructions,
        tools,
        input: [{ role: "user", content: inputContent }],
        ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
        max_output_tokens: 4000,
      },
      apiKey,
      controller.signal
    );

    for (let round = 0; round < MAX_AGENT_ROUNDS; round += 1) {
      const calls = (Array.isArray(response?.output) ? response.output : []).filter((item) => item?.type === "function_call");
      if (!calls.length) break;

      const outputs = [];
      for (const call of calls) {
        try {
          const result = await callFunctionTool(call);
          activity.push({ tool: call.name, ok: true, result });
          outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          activity.push({ tool: call.name, ok: false, error: detail });
          outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify({ error: detail }) });
        }
      }

      response = await openai(
        {
          model,
          instructions,
          tools,
          previous_response_id: response.id,
          input: outputs,
          max_output_tokens: 4000,
        },
        apiKey,
        controller.signal
      );
    }

    clearTimeout(timeout);
    const artifacts = extractArtifacts(response);
    return json({
      ok: true,
      response_id: response.id,
      output: extractOutputText(response) || (artifacts.images.length ? "Image created." : "Done."),
      images: artifacts.images,
      code_images: artifacts.codeImages,
      logs: artifacts.logs,
      activity,
    });
  } catch (error) {
    clearTimeout(timeout);
    const messageText = error?.name === "AbortError" ? "Request timed out." : error instanceof Error ? error.message : String(error);
    return json({ ok: false, error: messageText }, error?.status || 500);
  }
}
