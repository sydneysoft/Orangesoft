export const runtime = "nodejs";
export const maxDuration = 60;

const INKA_REFLECT_GUIDANCE = `You are ИНКА, Blueprint Local Brain. Answer ordinary requests directly and helpfully.
If the request depends on current/live information that is not present in the provided tool context (for example nearby businesses, maps, opening hours, prices, availability, weather, or news), do not give a generic refusal. Clearly say that ИНКА does not currently have live web/maps access, state what cannot be verified, and still provide useful non-live guidance without inventing current facts.
Treat dots in natural-language prompts as word separators when sensible. Use any LOCAL TOOL CONTEXT you receive as evidence. Keep the answer concise.

USER REQUEST:\n`;

function json(data, status = 200) {
  return Response.json(data, { status });
}

function bridgeUrl() {
  const value = String(process.env.BLUEPRINT_LOCAL_BRIDGE_URL || "").trim().replace(/\/+$/, "");
  if (!value) throw new Error("BLUEPRINT_LOCAL_BRIDGE_URL IS NOT CONFIGURED ON THE SERVER.");
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") throw new Error("BLUEPRINT_LOCAL_BRIDGE_URL MUST USE HTTPS.");
  return value;
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

  const bridgeToken = String(process.env.BLUEPRINT_LOCAL_BRIDGE_TOKEN || "").trim();
  if (!bridgeToken) {
    return json({ executed: false, output: "BLUEPRINT_LOCAL_BRIDGE_TOKEN IS NOT CONFIGURED ON THE SERVER." }, 503);
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

  const allowed = new Set(["reflect", "inspect", "find"]);
  const unsupported = plan.filter((step) => !allowed.has(String(step?.type || "").toLowerCase()));
  if (unsupported.length) {
    return json({
      executed: false,
      output: "LOCAL READ TOOLS ARE ACTIVE. Use LOCAL for normal chat, reflect(...), inspect(...), and find(...). File changes and deployment still require CLOUD until the local write adapters are enabled.",
      provider: "ollama",
      model: "blueprint-local",
      local: true,
      tools: ["reflect", "inspect", "find"],
    }, 409);
  }

  const forwardedPlan = plan.map((step) => {
    if (String(step?.type || "").toLowerCase() !== "reflect") return step;
    const userRequest = String(step?.normalized || step?.body || raw).trim();
    return { ...step, body: `${INKA_REFLECT_GUIDANCE}${userRequest}` };
  });

  let base;
  try {
    base = bridgeUrl();
  } catch (error) {
    return json({ executed: false, output: error instanceof Error ? error.message : String(error) }, 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const response = await fetch(`${base}/command`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bridgeToken}`,
        "content-type": "application/json",
        "user-agent": "OrangeSoft-Blueprint-Local",
      },
      body: JSON.stringify({ raw, plan: forwardedPlan }),
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { output: text }; }

    if (!response.ok || data?.ok === false) {
      const detail = data?.error || data?.output || `LOCAL BRIDGE HTTP ${response.status}`;
      return json({
        executed: false,
        output: `LOCAL AGENT ERROR: ${detail}`,
        activity: Array.isArray(data?.activity) ? data.activity : [],
        provider: "ollama",
        model: data?.model || "blueprint-local",
        local: true,
        tools: ["reflect", "inspect", "find"],
      }, response.status >= 400 && response.status < 600 ? response.status : 502);
    }

    return json({
      executed: true,
      output: String(data?.output || "LOCAL AGENT COMPLETED WITHOUT A TEXT RESPONSE."),
      activity: Array.isArray(data?.activity) ? data.activity : [],
      provider: "ollama",
      model: data?.model || "blueprint-local",
      local: true,
      tools: ["reflect", "inspect", "find"],
      guidance: "inka-live-data-limit-v1",
    });
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "LOCAL BRIDGE TIMED OUT. CHECK THAT OLLAMA, THE BRIDGE, AND NGROK ARE RUNNING ON YOUR MAC."
      : `LOCAL BRIDGE UNREACHABLE: ${error instanceof Error ? error.message : String(error)}`;
    return json({ executed: false, output: message, provider: "ollama", model: "blueprint-local", tools: ["reflect", "inspect", "find"] }, 503);
  } finally {
    clearTimeout(timeout);
  }
}
