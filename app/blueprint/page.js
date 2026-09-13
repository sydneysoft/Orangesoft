"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const C = {
  bg: "#061725",
  panel: "rgba(5,22,36,.82)",
  line: "#2b6b92",
  text: "#d7f2ff",
  muted: "#77a8c3",
  hi: "#9addff",
  danger: "#ffb6b6",
  ok: "#9ce6b2",
  local: "#ffd27d",
};

const aliases = [
  [/\bxochu\b/gi, "хочу"],
  [/\bgavaret\b/gi, "говорити"],
  [/\bkole\b/gi, "коли"],
  [/\babo\b/gi, "або"],
  [/\bjesli\b/gi, "jeśli"],
  [/\bukrainski\b/gi, "український"],
  [/\bruski\b/gi, "російський"],
];

const known = new Set(["reflect", "zdrobic", "inspect", "modify", "find", "deploy"]);
const labels = {
  reflect: "ANALYZE / ANSWER",
  zdrobic: "EXECUTE / CREATE",
  inspect: "INSPECT",
  modify: "MODIFY",
  find: "SEARCH",
  deploy: "DEPLOY",
};

const ZAIKA_MEMORY_KEY = "blueprint.zaika.memory";
const MAX_ZAIKA_MEMORY = 20000;
const MOBILE_BREAKPOINT = 900;

function normalize(value) {
  let text = String(value || "").replace(/\./g, " ").replace(/_/g, " ");
  aliases.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  return text.replace(/\s+/g, " ").trim();
}

function splitTopLevel(text) {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  let escape = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "(") {
      depth += 1;
      continue;
    }
    if (ch === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (ch === "." && depth === 0) {
      const part = text.slice(start, i).trim();
      if (part) parts.push(part);
      start = i + 1;
    }
  }

  const last = text.slice(start).trim();
  if (last) parts.push(last);
  return parts;
}

function unwrapQuoted(value) {
  const text = value.trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

function parseExpression(expr, path = "") {
  const match = expr.match(/^([a-zA-Z_][\w-]*)\s*\(([\s\S]*)\)$/);
  if (!match) {
    return [{ id: path || "1", type: "unknown", raw: expr, body: expr, label: "UNKNOWN" }];
  }
  const type = match[1].toLowerCase();
  const body = match[2].trim();
  return [{ id: path || "1", type, raw: expr, body: unwrapQuoted(body), label: labels[type] || type.toUpperCase() }];
}

function parseProgram(raw) {
  const text = raw.trim();
  if (!/^(reflect|zdrobic|inspect|modify|find|deploy)\s*\(/i.test(text)) {
    return [{ id: "1", type: "reflect", raw: text, body: text, label: labels.reflect, implicit: true }];
  }
  const plan = [];
  splitTopLevel(text).forEach((expr, index) => {
    plan.push(...parseExpression(expr, String(index + 1)));
  });
  return plan;
}

function formatPlan(raw, plan) {
  const lines = plan.map((step, index) => `${index + 1}. ${step.label}${step.body ? ` → ${normalize(step.body).slice(0, 220)}` : ""}`);
  const invalid = plan.some((step) => !known.has(step.type));
  return `COMMAND PROGRAM\n${lines.join("\n")}\n\n${invalid ? "STATUS: SYNTAX ERROR" : "STATUS: AGENT UNAVAILABLE"}\n${invalid ? "The command contains an unsupported top-level expression." : "The browser could not complete an authenticated agent request. No execution is being claimed."}\n\nRAW:\n${raw}`;
}

function imagePreviews(activity) {
  const previews = [];
  const seen = new Set();
  for (const item of Array.isArray(activity) ? activity : []) {
    if (item?.tool !== "write_repo_file" || item?.ok !== true) continue;
    const result = item.result || {};
    const repo = String(result.repo || "");
    const path = String(result.path || "");
    const commit = String(result.commit || "");
    if (!repo || !path || !commit || !/\.(svg|png|jpe?g|webp|gif)$/i.test(path)) continue;
    const key = `${repo}:${commit}:${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    previews.push({ repo, path, commit, url: `https://raw.githubusercontent.com/${repo}/${commit}/${encodedPath}` });
  }
  return previews;
}

function linkedText(value) {
  const text = String(value || "");
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"']+)/gi;
  const nodes = [];
  let last = 0;
  let index = 0;
  let match;

  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const raw = match[2] || match[3] || "";
    let url = raw;
    let trailing = "";
    if (!match[2]) {
      const tail = url.match(/[.,!?;:)\]}]+$/)?.[0] || "";
      if (tail) {
        trailing = tail;
        url = url.slice(0, -tail.length);
      }
    }
    const label = match[1] || url;
    nodes.push(
      <a
        key={`link-${index++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={url}
        style={{ color: C.hi, textDecoration: "underline", textUnderlineOffset: 2 }}
      >
        {label}
      </a>
    );
    if (trailing) nodes.push(trailing);
    last = pattern.lastIndex;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function BlueprintPage() {
  const [input, setInput] = useState("");
  const [masked, setMasked] = useState(false);
  const [status, setStatus] = useState("READY");
  const [agent, setAgent] = useState("DISCONNECTED");
  const [accessKey, setAccessKey] = useState("");
  const [provider, setProvider] = useState("cloud");
  const [zaikaMemory, setZaikaMemory] = useState("");
  const [seq, setSeq] = useState(2);
  const [isMobile, setIsMobile] = useState(false);
  const [entries, setEntries] = useState([
    {
      id: 1,
      kind: "SYSTEM RESULT",
      text:
        "CONSOLE READY\nMODE: THREE BRAINS\nCHAIN PARSER: ACTIVE\nNESTED ARGUMENTS: ACTIVE\nPLAIN TEXT: AUTO-REFLECT\n\nЛОКАЛ: GROQ / gpt-oss-120b\nИНКА: OLLAMA / blueprint-local\nЗАИКА: OPENAI / gpt-5.6-luna\n\nYou can type normal questions directly. Plain text is automatically treated as reflect(...).\nExplicit Blueprint commands still keep their command behavior.\n\nЗАИКА MEMORY can import a ChatGPT Memory Summary into this browser for use as Zaika context.\n\nSet AGENT KEY, select a brain, then ask or run a command.",
      user: false,
      error: false,
      previews: [],
    },
  ]);

  const logRef = useRef(null);

  useEffect(() => {
    setAccessKey(sessionStorage.getItem("blueprint.key") || "");
    setZaikaMemory(localStorage.getItem(ZAIKA_MEMORY_KEY) || "");

    const saved = sessionStorage.getItem("blueprint.provider");
    if (saved === "local" || saved === "cloud" || saved === "zaika") {
      setProvider(saved);
    }

    const syncViewport = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    syncViewport();

    const onKeyDown = (event) => {
      if (event.key === "Escape") setMasked((value) => !value);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [entries]);

  const time = useMemo(() => new Date().toLocaleString(), [entries, status]);
  const endpoint = provider === "local" ? "/api/command/local" : provider === "zaika" ? "/api/command/zaika" : "/api/command";
  const providerLabel = provider === "local" ? "ИНКА / OLLAMA" : provider === "zaika" ? "ЗАИКА / OPENAI" : "ЛОКАЛ / GROQ";
  const providerShort = provider === "local" ? "ИНКА" : provider === "zaika" ? "ЗАИКА" : "ЛОКАЛ";
  const modelLabel = provider === "local" ? "blueprint-local" : provider === "zaika" ? "gpt-5.6-luna" : "gpt-oss-120b";

  function chooseProvider(next) {
    setProvider(next);
    setAgent("DISCONNECTED");
    sessionStorage.setItem("blueprint.provider", next);

    const text =
      next === "local"
        ? "ИНКА SELECTED\nROUTE: /api/command/local → secure bridge → Ollama\nMODEL: blueprint-local\nMODE: CHAT + REFLECT + INSPECT + FIND"
        : next === "zaika"
          ? `ЗАИКА SELECTED\nROUTE: /api/command/zaika → OpenAI Responses API\nMODEL: gpt-5.6-luna\nMODE: CHAT + REFLECT\nMEMORY: ${zaikaMemory ? "IMPORTED" : "EMPTY"}`
          : "ЛОКАЛ SELECTED\nROUTE: /api/command → Groq\nMODEL: gpt-oss-120b\nMODE: CHAT + FULL REPO TOOLS + DEPLOY";

    setEntries((value) => [...value, { id: Date.now(), kind: "SYSTEM RESULT", text, user: false, error: false, previews: [] }]);
  }

  function connectAgent() {
    const key = window.prompt("Blueprint access key (stored only for this browser tab/session):", accessKey);
    if (key === null) return;
    const clean = key.trim();
    setAccessKey(clean);
    if (clean) {
      sessionStorage.setItem("blueprint.key", clean);
      setAgent("KEY SET");
    } else {
      sessionStorage.removeItem("blueprint.key");
      setAgent("DISCONNECTED");
    }
  }

  function manageZaikaMemory() {
    const next = window.prompt(
      "Paste your ChatGPT Memory Summary for ЗАИКА. It will be stored in this browser's localStorage and sent to the Zaika backend only when Zaika is selected. Submit an empty value to clear it.",
      zaikaMemory
    );
    if (next === null) return;
    const clean = next.trim();
    if (clean.length > MAX_ZAIKA_MEMORY) {
      window.alert(`Zaika memory is too large. Maximum ${MAX_ZAIKA_MEMORY} characters.`);
      return;
    }
    if (clean) {
      localStorage.setItem(ZAIKA_MEMORY_KEY, clean);
      setZaikaMemory(clean);
      setEntries((value) => [
        ...value,
        {
          id: Date.now(),
          kind: "SYSTEM RESULT · ЗАИКА",
          text: `MEMORY IMPORTED\n${clean.length} CHARACTERS\nSOURCE: USER-PASTED CHATGPT MEMORY SUMMARY\nSTORAGE: THIS BROWSER`,
          user: false,
          error: false,
          previews: [],
        },
      ]);
    } else {
      localStorage.removeItem(ZAIKA_MEMORY_KEY);
      setZaikaMemory("");
      setEntries((value) => [
        ...value,
        { id: Date.now(), kind: "SYSTEM RESULT · ЗАИКА", text: "MEMORY CLEARED FROM THIS BROWSER", user: false, error: false, previews: [] },
      ]);
    }
  }

  async function run() {
    const raw = input.trim();
    if (!raw) return;

    const plan = parseProgram(raw);
    const invalid = plan.some((step) => !known.has(step.type));
    const commandId = seq;
    const resultId = seq + 1;

    setEntries((value) => [...value, { id: commandId, kind: `COMMAND · ${providerShort}`, text: raw, user: true, error: invalid, previews: [] }]);
    setSeq(resultId + 1);
    setInput("");
    setStatus("EXECUTING");

    let output = formatPlan(raw, plan);
    let error = invalid;
    let previews = [];

    if (!invalid) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(accessKey ? { "x-blueprint-key": accessKey } : {}),
          },
          body: JSON.stringify({
            raw,
            plan: plan.map((step) => ({ id: step.id, type: step.type, body: step.body, normalized: normalize(step.body) })),
            ...(provider === "zaika" && zaikaMemory ? { memory: zaikaMemory } : {}),
          }),
        });

        let data = {};
        try {
          data = await response.json();
        } catch {
          data = {};
        }

        previews = imagePreviews(data?.activity);

        if (response.ok && data?.executed === true) {
          setAgent("CONNECTED");
          output = data.output || "EXECUTION COMPLETED";
          error = false;
        } else {
          if (response.status === 401) setAgent("AUTH REQUIRED");
          else if (response.status === 409 && provider === "local") setAgent("LOCAL READ ONLY");
          else if (response.status === 409 && provider === "zaika") setAgent("CHAT ONLY");
          else if (response.status === 503) setAgent("SERVER SETUP");
          else setAgent("DISCONNECTED");
          output = data?.output || formatPlan(raw, plan);
          error = true;
        }
      } catch (err) {
        setAgent("DISCONNECTED");
        output = `AGENT REQUEST FAILED\n${err instanceof Error ? err.message : String(err)}\n\n${formatPlan(raw, plan)}`;
        error = true;
      }
    }

    setEntries((value) => [...value, { id: resultId, kind: `SYSTEM RESULT · ${providerShort}`, text: output, user: false, error, previews }]);
    setStatus("READY");
  }

  const btn = {
    border: `1px solid ${C.line}`,
    background: "transparent",
    color: C.text,
    padding: "7px 10px",
    font: "inherit",
    fontSize: 10,
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: ".06em",
  };
  const accent = provider === "local" ? C.local : provider === "zaika" ? C.hi : C.ok;
  const modeBtn = (active) => ({
    ...btn,
    borderColor: active ? accent : C.line,
    background: active ? "rgba(70,120,145,.22)" : "transparent",
    color: active ? accent : C.text,
  });
  const metaColor = (value) => {
    if (value === "CONNECTED" || value === "SET" || value === "KEY SET" || value === "IMPORTED") return C.ok;
    if (value === "LOCAL READ ONLY" || value === "CHAT ONLY") return accent;
    if (String(value).includes("REQUIRED") || String(value).includes("MISSING") || value === "DISCONNECTED" || value === "SERVER SETUP" || value === "EMPTY") {
      return C.danger;
    }
    return C.text;
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "grid",
        gridTemplateRows: isMobile ? "auto 1fr 26px" : "46px 1fr 26px",
        color: C.text,
        fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace',
        backgroundColor: C.bg,
        backgroundImage:
          "linear-gradient(rgba(130,211,255,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(130,211,255,.13) 1px,transparent 1px),linear-gradient(rgba(130,211,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(130,211,255,.045) 1px,transparent 1px)",
        backgroundSize: "32px 32px,32px 32px,8px 8px,8px 8px",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: isMobile ? "stretch" : "center",
          justifyContent: "space-between",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? 8 : 0,
          padding: isMobile ? "8px 10px" : "0 13px",
          borderBottom: `1px solid ${C.line}`,
          background: "rgba(5,20,33,.94)",
        }}
      >
        <div style={{ display: "flex", gap: 11, alignItems: "center", fontSize: isMobile ? 10 : 11, letterSpacing: ".14em", textTransform: "uppercase", lineHeight: 1.15 }}>
          <span style={{ width: 23, height: 23, border: `1px solid ${C.hi}`, display: "grid", placeItems: "center", color: C.hi, flexShrink: 0 }}>+</span>
          <span style={{ overflowWrap: "anywhere" }}>ORANGESOFT / TECHNICAL DRAWING CONSOLE</span>
        </div>
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", justifyContent: isMobile ? "flex-start" : "flex-end" }}>
          <button title="Groq" style={modeBtn(provider === "cloud")} onClick={() => chooseProvider("cloud")}>ЛОКАЛ</button>
          <button title="Ollama" style={modeBtn(provider === "local")} onClick={() => chooseProvider("local")}>ИНКА</button>
          <button title="OpenAI" style={modeBtn(provider === "zaika")} onClick={() => chooseProvider("zaika")}>ЗАИКА</button>
          <button title="Import ChatGPT Memory Summary for Zaika" style={{ ...btn, borderColor: zaikaMemory ? C.ok : C.line, color: zaikaMemory ? C.ok : C.text }} onClick={manageZaikaMemory}>
            {zaikaMemory ? "Заика Memory ✓" : "Заика Memory"}
          </button>
          <button style={{ ...btn, borderColor: accessKey ? C.ok : C.line }} onClick={connectAgent}>{accessKey ? "Agent Key ✓" : "Agent Key"}</button>
          <button style={btn} onClick={() => setMasked((value) => !value)}>Drawing View</button>
          <button style={btn} onClick={() => setEntries([])}>Clear</button>
        </div>
      </header>

      <main style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: isMobile ? undefined : "210px minmax(0,1fr) 260px", minHeight: 0 }}>
        {!isMobile && (
          <aside style={{ padding: 12, borderRight: `1px solid ${C.line}`, background: C.panel, overflow: "auto" }}>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: ".18em", textTransform: "uppercase", margin: "6px 0 10px" }}>Command Grammar</div>
            <div style={{ fontSize: 11, lineHeight: 1.7 }}>
              {[
                ["plain text", "auto reflect / chat"],
                ["reflect(...)", "analyze / answer"],
                ["zdrobic(...)", "execute / create"],
                ["inspect(...)", "check / review"],
                ["modify(...)", "change / edit"],
                ["find(...)", "search"],
                ["deploy(...)", "publish"],
              ].map(([command, description]) => (
                <div key={command} style={{ marginBottom: 7 }}>
                  <div style={{ color: C.hi }}>{command}</div>
                  <div style={{ color: C.muted, fontSize: 10 }}>{description}</div>
                </div>
              ))}
            </div>
          </aside>
        )}

        <section style={{ position: "relative", padding: isMobile ? 10 : 16, minWidth: 0, overflow: "hidden", minHeight: 0 }}>
          <div style={{ position: "absolute", inset: isMobile ? 10 : 16, border: `1px solid ${C.line}`, opacity: 0.4, pointerEvents: "none" }} />
          <div style={{ height: "100%", maxWidth: isMobile ? "100%" : 960, margin: "auto", position: "relative", zIndex: 2, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 8, padding: "8px 0 11px", borderBottom: `1px solid ${C.line}` }}>
              <h1 style={{ margin: 0, fontSize: isMobile ? 15 : 17, fontWeight: 500, letterSpacing: ".14em", textTransform: "uppercase" }}>Command Console</h1>
              <span style={{ fontSize: 9, color: provider === "local" ? C.local : provider === "zaika" ? C.hi : C.muted }}>{isMobile ? providerLabel : `DWG A-01 · REV 17 · ${providerLabel}`}</span>
            </div>

            <div ref={logRef} style={{ flex: 1, overflow: "auto", padding: isMobile ? "15px 2px 180px" : "15px 5px 132px" }}>
              {entries.map((entry) => (
                <div key={entry.id} style={{ maxWidth: isMobile ? "100%" : "86%", margin: entry.user ? "0 0 17px auto" : "0 0 17px", textAlign: entry.user ? "right" : "left", fontSize: 12, lineHeight: 1.55 }}>
                  <div style={{ fontSize: 9, color: C.muted, letterSpacing: ".15em", textTransform: "uppercase", marginBottom: 4 }}>{entry.kind} {String(entry.id).padStart(3, "0")}</div>
                  <div style={{ display: "inline-block", maxWidth: "100%", textAlign: "left", whiteSpace: "pre-wrap", overflowWrap: "anywhere", padding: "10px 12px", border: `1px ${entry.user ? "dashed" : "solid"} ${entry.error ? "#855" : C.line}`, background: "rgba(7,31,50,.88)", color: entry.error ? C.danger : C.text }}>
                    {linkedText(entry.text)}
                  </div>
                  {entry.previews?.length > 0 && (
                    <div style={{ display: "grid", gap: 9, marginTop: 9, textAlign: "left" }}>
                      {entry.previews.map((preview) => (
                        <div key={`${preview.commit}:${preview.path}`} style={{ border: `1px solid ${C.line}`, background: "rgba(7,31,50,.94)", padding: 8 }}>
                          <div style={{ fontSize: 9, color: C.muted, letterSpacing: ".13em", textTransform: "uppercase", marginBottom: 7 }}>Artifact Preview · {preview.path}</div>
                          <a href={preview.url} target="_blank" rel="noreferrer" style={{ display: "block", background: "rgba(255,255,255,.96)", border: `1px solid ${C.line}`, padding: 10 }}>
                            <img src={preview.url} alt={preview.path} style={{ display: "block", width: "100%", maxHeight: 320, objectFit: "contain" }} />
                          </a>
                          <div style={{ marginTop: 6, fontSize: 9, color: C.muted }}>COMMIT {preview.commit.slice(0, 12)} · CLICK IMAGE TO OPEN</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: isMobile ? 24 : 36, background: "linear-gradient(transparent,rgba(6,23,37,.99) 28%)" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 8 }}>
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      event.preventDefault();
                      run();
                    }
                  }}
                  spellCheck={false}
                  placeholder={provider === "local" ? "Ask anything, or use reflect(...)" : provider === "zaika" ? "Ask Заика anything, or use reflect(...)" : "Ask a question, or use zdrobic(...)"}
                  style={{ height: isMobile ? 120 : 77, resize: "none", outline: "none", padding: "11px 12px", border: `1px solid ${accent}`, background: "rgba(5,23,37,.95)", color: C.text, font: "inherit", fontSize: 12 }}
                />
                <button style={{ ...btn, minWidth: isMobile ? "100%" : 90, minHeight: isMobile ? 44 : undefined, borderColor: accent, color: accent }} onClick={run}>
                  {provider === "local" ? "Run Инка" : provider === "zaika" ? "Run Заика" : "Execute"}
                </button>
              </div>
              <div style={{ marginTop: 6, fontSize: 9, color: C.muted }}>PLAIN TEXT = REFLECT · CTRL/⌘ + ENTER = RUN · EXPLICIT COMMANDS KEEP THEIR ACTIONS</div>
            </div>
          </div>

          {masked && (
            <div style={{ position: "absolute", inset: 0, zIndex: 20, background: C.bg, display: "grid", placeItems: "center" }}>
              <div style={{ width: "70%", height: "55%", border: `1px solid ${C.line}`, position: "relative" }}>
                <div style={{ position: "absolute", left: "10%", top: "12%", width: "36%", height: "30%", border: `1px solid ${C.line}` }} />
                <div style={{ position: "absolute", right: "10%", bottom: "12%", width: "34%", height: "38%", border: `1px dashed ${C.line}` }} />
              </div>
            </div>
          )}
        </section>

        {!isMobile && (
          <aside style={{ padding: 12, borderLeft: `1px solid ${C.line}`, background: C.panel, overflow: "auto" }}>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: ".18em", textTransform: "uppercase", margin: "6px 0 10px" }}>Execution State</div>
            {[
              ["STATE", status],
              ["PARSER", "CONNECTED"],
              ["BACKEND", endpoint],
              ["PROVIDER", providerShort],
              ["MODEL", modelLabel],
              ["MEMORY", zaikaMemory ? "IMPORTED" : "EMPTY"],
              ["KEY", accessKey ? "SET" : "MISSING"],
              ["AGENT", agent],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 5, fontSize: 10, lineHeight: 1.7, color: C.muted }}>
                <span>{label}</span>
                <b style={{ fontWeight: 400, color: metaColor(value) }}>{value}</b>
              </div>
            ))}
          </aside>
        )}
      </main>

      <footer style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", fontSize: 9, color: C.muted, borderTop: `1px solid ${C.line}`, background: "rgba(5,20,33,.94)" }}>
        <span>ORANGESOFT / DRAWING CONTROL SYSTEM · {providerLabel}</span>
        <span>{time}</span>
      </footer>
    </div>
  );
}
