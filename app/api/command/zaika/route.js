export const runtime = "nodejs";
export const maxDuration = 60;

const OPENAI_URL = "https://api.openai.com/v1/responses";

function json(data, status = 200) {
  return Response.json(data, { status });
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

export async function POST(request) {
  const configuredKey = process.env.BLUEPRINT_ACCESS_KEY;
  if (!configuredKey) {
    return json({ executed: false, output: "BLUEPRINT_ACCESS_KEY IS NOT CONFIGURED ON THE SERVER." }, 503);
  }

  const suppliedKey = request.headers.get("x-blueprint-key") || "";
  if (suppliedKey !== configuredKey) {
    return json({ executed: false, output: "AGENT AUTH REQUIRED. ENTER THE BLUEPRINT ACCESS KEY." }, 401);
  }

  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    return json({
      executed: false,
      output: "ЗАИКА BACKEND IS INSTALLED, BUT OPENAI_API_KEY IS NOT CONFIGURED ON THE SERVER.",
      provider: "openai",
      model: String(process.env.BLUEPRINT_OPENAI_MODEL || "gpt-5.6-luna"),
      zaika: true,
    }, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ executed: false, output: "INVALID JSON REQUEST." }, 400);
  }

  const raw = String(payload?.raw || "").trim();
  const plan = Array.isArray(payload?.plan) ? payload.plan : [];
  if (!raw || raw.length > 30_000) {
    return json({ executed: false, output: "COMMAND IS EMPTY OR TOO LARGE." }, 400);
  }

  const unsupported = plan.filter((step) => String(step?.type || "").toLowerCase() !== "reflect");
  if (unsupported.length) {
    return json({
      executed: false,
      output: "ЗАИКА CURRENTLY SUPPORTS NORMAL CHAT AND reflect(...). Repository writes, deployment, inspect and find still use ЛОКАЛ or ИНКА.",
      provider: "openai",
      model: String(process.env.BLUEPRINT_OPENAI_MODEL || "gpt-5.6-luna"),
      zaika: true,
      tools: ["reflect"],
    }, 409);
  }

  const prompt = plan
    .filter((step) => String(step?.type || "").toLowerCase() === "reflect")
    .map((step) => String(step?.body || "").trim())
    .filter(Boolean)
    .join("\n\n") || raw;

  const model = String(process.env.BLUEPRINT_OPENAI_MODEL || "gpt-5.6-luna").trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "user-agent": "OrangeSoft-Blueprint-Zaika",
      },
      body: JSON.stringify({
        model,
        instructions: "You are ЗАИКА, the OpenAI-powered brain inside OrangeSoft Blueprint. Blueprint is OrangeSoft's AI command and execution system. Answer the user's request directly and concisely. Do not claim that files were changed or deployed unless an execution tool actually reports that it happened.",
        input: prompt,
        max_output_tokens: 1200,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data?.error?.message || data?.error || `OPENAI HTTP ${response.status}`;
      return json({ executed: false, output: `ЗАИКА ERROR: ${detail}`, provider: "openai", model, zaika: true }, response.status >= 400 && response.status < 600 ? response.status : 502);
    }

    const output = extractOutputText(data);
    return json({
      executed: true,
      output: output || "ЗАИКА COMPLETED WITHOUT A TEXT RESPONSE.",
      provider: "openai",
      model,
      zaika: true,
      tools: ["reflect"],
      activity: [{ tool: "openai_response", ok: true, model }],
    });
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "ЗАИКА TIMED OUT WHILE WAITING FOR OPENAI."
      : `ЗАИКА UNREACHABLE: ${error instanceof Error ? error.message : String(error)}`;
    return json({ executed: false, output: message, provider: "openai", model, zaika: true }, 503);
  } finally {
    clearTimeout(timeout);
  }
}
