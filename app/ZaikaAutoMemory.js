"use client";

import { useEffect } from "react";

const MAX_MEMORY_CHARS = 20_000;
const CHAT_RESERVE = 7_500;

const BRAINS = {
  "/api/command/zaika": {
    key: "blueprint.zaika.memory",
    marker: "--- ZAИКА AUTO-SAVED CHAT ---",
    assistant: "ЗАИКА",
  },
  "/api/command/local": {
    key: "blueprint.inka.memory",
    marker: "--- ИНКА AUTO-SAVED CHAT ---",
    assistant: "ИНКА",
  },
  "/api/command": {
    key: "blueprint.local.memory",
    marker: "--- ЛОКАЛ AUTO-SAVED CHAT ---",
    assistant: "ЛОКАЛ",
  },
};

function splitMemory(value, marker) {
  const text = String(value || "").trim();
  const index = text.indexOf(marker);
  if (index < 0) return { base: text, chat: "" };
  return {
    base: text.slice(0, index).trim(),
    chat: text.slice(index + marker.length).trim(),
  };
}

function composeMemory(base, chat, marker) {
  const cleanBase = String(base || "").trim();
  const cleanChat = String(chat || "").trim();
  if (!cleanChat) return cleanBase.slice(0, MAX_MEMORY_CHARS);

  const separator = `\n\n${marker}\n`;
  const maxBase = Math.max(0, MAX_MEMORY_CHARS - separator.length - CHAT_RESERVE);
  const keptBase = cleanBase.slice(0, maxBase);
  const roomForChat = Math.max(0, MAX_MEMORY_CHARS - keptBase.length - separator.length);
  const keptChat = cleanChat.slice(-roomForChat);
  return `${keptBase}${separator}${keptChat}`.trim();
}

function currentMemory(config) {
  try {
    const stored = localStorage.getItem(config.key) || "";
    const { base, chat } = splitMemory(stored, config.marker);
    return composeMemory(base, chat, config.marker);
  } catch {
    return "";
  }
}

function appendChatLine(config, role, text, maxChars) {
  try {
    const clean = String(text || "").trim().slice(0, maxChars);
    if (!clean) return;

    const stored = localStorage.getItem(config.key) || "";
    const { base, chat } = splitMemory(stored, config.marker);
    const line = `${role}: ${clean}`;
    const nextChat = `${chat}${chat ? "\n\n" : ""}${line}`;
    localStorage.setItem(config.key, composeMemory(base, nextChat, config.marker));
  } catch {
    // Memory is optional. Storage problems must never break Blueprint chat.
  }
}

export default function ZaikaAutoMemory() {
  useEffect(() => {
    let installedFetch = null;
    let previousFetch = null;

    // Install after sibling effects (notably reCAPTCHA) so this wrapper remains outermost.
    const timer = window.setTimeout(() => {
      previousFetch = window.fetch.bind(window);

      installedFetch = async (input, init = {}) => {
        const rawUrl = typeof input === "string" ? input : input?.url || String(input);
        let pathname = "";
        try { pathname = new URL(rawUrl, window.location.href).pathname.replace(/\/+$/, ""); } catch {}

        const config = BRAINS[pathname];
        if (!config || window.location.pathname !== "/blueprint") {
          return previousFetch(input, init);
        }

        let payload = null;
        let nextInit = init;
        let reflectOnly = true;

        if (typeof init?.body === "string") {
          try {
            payload = JSON.parse(init.body);
            reflectOnly = Array.isArray(payload?.plan)
              ? payload.plan.every((step) => String(step?.type || "").toLowerCase() === "reflect")
              : true;

            if (reflectOnly) {
              const memoryBeforeTurn = currentMemory(config);
              nextInit = {
                ...init,
                body: JSON.stringify({ ...payload, ...(memoryBeforeTurn ? { memory: memoryBeforeTurn } : {}) }),
              };

              // Save the user's message immediately so the next request can recall it.
              appendChatLine(config, "USER", payload?.raw, 2_500);
            }
          } catch {
            payload = null;
          }
        }

        const response = await previousFetch(input, nextInit);

        if (response.ok && payload && reflectOnly) {
          response.clone().json().then((data) => {
            if (data?.executed === true && typeof data?.output === "string") {
              appendChatLine(config, config.assistant, data.output, 3_500);
            }
          }).catch(() => {});
        }

        return response;
      };

      window.fetch = installedFetch;
    }, 0);

    return () => {
      window.clearTimeout(timer);
      if (installedFetch && window.fetch === installedFetch && previousFetch) {
        window.fetch = previousFetch;
      }
    };
  }, []);

  return null;
}
