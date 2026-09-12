export const runtime = "nodejs";
export const maxDuration = 60;

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
      body: JSON.stringify({ raw, plan }),
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
        provider: "ollama",
        model: data?.model || "blueprint-local",
      }, response.status >= 400 && response.status < 600 ? response.status : 502);
    }

    return json({
      executed: true,
      output: String(data?.output || "LOCAL AGENT COMPLETED WITHOUT A TEXT RESPONSE."),
      activity: [],
      provider: "ollama",
      model: data?.model || "blueprint-local",
      local: true,
    });
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "LOCAL BRIDGE TIMED OUT. CHECK THAT OLLAMA, THE BRIDGE, AND NGROK ARE RUNNING ON YOUR MAC."
      : `LOCAL BRIDGE UNREACHABLE: ${error instanceof Error ? error.message : String(error)}`;
    return json({ executed: false, output: message, provider: "ollama", model: "blueprint-local" }, 503);
  } finally {
    clearTimeout(timeout);
  }
}
