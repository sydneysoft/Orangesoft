export const runtime = "nodejs";
export const maxDuration = 60;

const OPENAI_URL = "https://api.openai.com/v1/responses";
const DEFAULT_ALLOWED_REPOS = ["sydneysoft/Orangesoft", "sydneysoft/hellboychronicles"];
const MAX_FILE_BYTES = 400_000;
const MAX_AGENT_ROUNDS = 8;

function json(data, status = 200) {
  return Response.json(data, { status });
}

function allowedRepos() {
  const configured = (process.env.BLUEPRINT_ALLOWED_REPOS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_ALLOWED_REPOS);
}

function requireRepo(repo) {
  if (!allowedRepos().has(repo)) {
    throw new Error(`Repository not allowed: ${repo}`);
  }
}

function requireSafePath(path) {
  const p = String(path || "").trim();
  if (!p || p.startsWith("/") || p.includes("..")) throw new Error("Unsafe repository path");
  const lower = p.toLowerCase();
  const blocked = [".env", ".pem", ".key", "id_rsa", "credentials", "secrets"];
  if (blocked.some((x) => lower.includes(x))) throw new Error("Secret/credential paths cannot be modified by Blueprint");
  if (lower.startsWith(".github/workflows/")) throw new Error("GitHub workflow files are not writable through Blueprint");
  return p;
}

function ghHeaders() {
  return {
    Authorization: `Bearer ${process.env.BLUEPRINT_GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "OrangeSoft-Blueprint-Agent",
  };
}

function encodedPath(path) {
  return String(path || "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

async function githubRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...ghHeaders(), ...(options.headers || {}) },
    cache: "no-store",
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
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
  return body.slice(0, 120).map((item) => ({ name: item.name, path: item.path, type: item.type, size: item.size }));
}

async function readRepoFile({ repo, path, branch = "main" }) {
  requireRepo(repo);
  const clean = requireSafePath(path);
  const { response, body } = await githubRequest(
    `https://api.github.com/repos/${repo}/contents/${encodedPath(clean)}?ref=${encodeURIComponent(branch)}`
  );
  if (!response.ok) throw new Error(`GitHub read failed (${response.status}): ${body?.message || "unknown error"}`);
  if (body.type !== "file" || !body.content) throw new Error("Path is not a readable file");
  if ((body.size || 0) > MAX_FILE_BYTES) throw new Error(`File exceeds ${MAX_FILE_BYTES} byte Blueprint limit`);
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
  if (Buffer.byteLength(text, "utf8") > MAX_FILE_BYTES) throw new Error(`Write exceeds ${MAX_FILE_BYTES} byte Blueprint limit`);

  let sha;
  const current = await githubRequest(
    `https://api.github.com/repos/${repo}/contents/${encodedPath(clean)}?ref=${encodeURIComponent(branch)}`
  );
  if (current.response.ok && current.body?.type === "file") sha = current.body.sha;
  else if (current.response.status !== 404) {
    throw new Error(`GitHub preflight failed (${current.response.status}): ${current.body?.message || "unknown error"}`);
  }

  const payload = {
    message: String(commit_message || `Blueprint update ${clean}`).slice(0, 180),
    content: Buffer.from(text, "utf8").toString("base64"),
    branch,
    ...(sha ? { sha } : {}),
  };
  const result = await githubRequest(
    `https://api.github.com/repos/${repo}/contents/${encodedPath(clean)}`,
    { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }
  );
  if (!result.response.ok) throw new Error(`GitHub write failed (${result.response.status}): ${result.body?.message || "unknown error"}`);
  return {
    repo,
    path: clean,
    commit: result.body?.commit?.sha || null,
    content_sha: result.body?.content?.sha || null,
    deployment_note: "A push to the production branch was made. If this repository is connected to Vercel, its Git integration will start a deployment automatically.",
  };
}

async function checkPublicUrl({ url }) {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const allowed = new Set(["orangesoft.uk", "www.orangesoft.uk", "storylingo.uk", "www.storylingo.uk"]);
  if (!allowed.has(host) || parsed.protocol !== "https:") throw new Error("URL host is not allowed for Blueprint verification");
  const response = await fetch(parsed.toString(), { redirect: "follow", cache: "no-store" });
  const text = await response.text();
  return { url: parsed.toString(), status: response.status, ok: response.ok, sample: text.slice(0, 6000) };
}

const tools = [
  {
    type: "function",
    name: "list_repo_directory",
    description: "List files/directories in an allowed GitHub repository before deciding what to inspect or modify.",
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
    description: "Read a UTF-8 text file from an allowed GitHub repository. Inspect relevant files before editing them.",
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
    name: "write_repo_file",
    description: "Create or replace one UTF-8 text file in an allowed GitHub repository. Use for requested zdrobic/modify operations. For logos and simple visual assets, SVG is preferred because it is safely editable text.",
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
  },
  {
    type: "function",
    name: "check_public_url",
    description: "Fetch an approved OrangeSoft or StoryLingo production URL to verify the public result after a change.",
    parameters: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
      additionalProperties: false,
    },
    strict: true,
  },
];

async function callTool(item) {
  const args = JSON.parse(item.arguments || "{}");
  if (item.name === "list_repo_directory") return listRepoDirectory(args);
  if (item.name === "read_repo_file") return readRepoFile(args);
  if (item.name === "write_repo_file") return writeRepoFile(args);
  if (item.name === "check_public_url") return checkPublicUrl(args);
  throw new Error(`Unknown tool: ${item.name}`);
}

async function openAI(body) {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: { message: text } }; }
  if (!response.ok) throw new Error(`OpenAI API failed (${response.status}): ${data?.error?.message || "unknown error"}`);
  return data;
}

function responseText(response) {
  if (typeof response.output_text === "string" && response.output_text.trim()) return response.output_text.trim();
  const chunks = [];
  for (const item of response.output || []) {
    if (item.type !== "message") continue;
    for (const part of item.content || []) {
      if (part.type === "output_text" && part.text) chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

export async function POST(request) {
  const configuredKey = process.env.BLUEPRINT_ACCESS_KEY;
  if (!configuredKey) {
    return json({ executed: false, output: "AGENT BACKEND EXISTS, BUT BLUEPRINT_ACCESS_KEY IS NOT CONFIGURED ON THE SERVER." }, 503);
  }
  const suppliedKey = request.headers.get("x-blueprint-key") || "";
  if (suppliedKey !== configuredKey) {
    return json({ executed: false, output: "AGENT AUTH REQUIRED. ENTER THE BLUEPRINT ACCESS KEY." }, 401);
  }
  if (!process.env.OPENAI_API_KEY) {
    return json({ executed: false, output: "OPENAI_API_KEY IS NOT CONFIGURED ON THE SERVER." }, 503);
  }
  if (!process.env.BLUEPRINT_GITHUB_TOKEN) {
    return json({ executed: false, output: "BLUEPRINT_GITHUB_TOKEN IS NOT CONFIGURED ON THE SERVER." }, 503);
  }

  let payload;
  try { payload = await request.json(); } catch { return json({ executed: false, output: "INVALID JSON REQUEST." }, 400); }
  const raw = String(payload?.raw || "").trim();
  const plan = Array.isArray(payload?.plan) ? payload.plan : [];
  if (!raw || raw.length > 30_000) return json({ executed: false, output: "COMMAND IS EMPTY OR TOO LARGE." }, 400);

  const instructions = `You are Blueprint, a private software execution agent for the owner of OrangeSoft and StoryLingo.
Interpret mixed English, Polish, Ukrainian, Russian and Latin transliteration naturally. Dots may be word separators.
The command parser has already provided a program. Follow its intent rather than explaining the syntax.

Allowed repositories:
- sydneysoft/Orangesoft = orangesoft.uk company website and Blueprint itself
- sydneysoft/hellboychronicles = storylingo.uk reading/language-learning site

Rules:
1. If the program only asks reflect/analyze, answer directly and do not write files.
2. If it includes zdrobic/modify, inspect the relevant repository and files first, then make the requested change when the intent is sufficiently clear.
3. If it includes deploy, committing to the production branch counts as the deployment trigger because Vercel Git integration deploys pushes. State exactly what was committed. Do not claim production verification unless check_public_url confirms it.
4. Never modify secrets, credential files, or GitHub workflows.
5. Prefer small targeted edits. Preserve existing functionality unless the command requests otherwise.
6. For a requested logo or simple visual asset, you may create a polished SVG in the appropriate public folder and update the site to use it if the command clearly implies that.
7. Never say a change happened unless a write_repo_file tool call succeeded.
8. Finish with a compact technical report: interpreted request, files inspected, files changed, commit SHA(s), deployment trigger status, and verification status.
`;

  const userInput = `RAW BLUEPRINT COMMAND:\n${raw}\n\nPARSED PROGRAM:\n${JSON.stringify(plan, null, 2)}`;
  const model = process.env.BLUEPRINT_MODEL || "gpt-5.6-terra";

  try {
    let response = await openAI({ model, instructions, tools, input: userInput });
    const activity = [];

    for (let round = 0; round < MAX_AGENT_ROUNDS; round++) {
      const calls = (response.output || []).filter((item) => item.type === "function_call");
      if (!calls.length) {
        return json({
          executed: true,
          output: responseText(response) || "AGENT COMPLETED WITHOUT A TEXT SUMMARY.",
          activity,
          model,
        });
      }

      const outputs = [];
      for (const call of calls) {
        try {
          const result = await callTool(call);
          activity.push({ tool: call.name, ok: true, result });
          outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify({ ok: true, result }) });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          activity.push({ tool: call.name, ok: false, error: message });
          outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify({ ok: false, error: message }) });
        }
      }

      response = await openAI({
        model,
        instructions,
        tools,
        previous_response_id: response.id,
        input: outputs,
      });
    }

    return json({ executed: false, output: "AGENT STOPPED AFTER THE MAXIMUM TOOL-CALL ROUNDS TO PREVENT AN UNBOUNDED EXECUTION LOOP.", activity }, 508);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ executed: false, output: `AGENT ERROR: ${message}` }, 500);
  }
}
