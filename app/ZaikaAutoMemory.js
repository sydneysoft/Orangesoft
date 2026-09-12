"use client";

import { useEffect } from "react";

const MEMORY_KEY = "blueprint.zaika.memory";
const MAX_MEMORY_CHARS = 20_000;
const AUTO_MARKER = "\n\n--- ZAИКА AUTO-SAVED CHAT ---\n";
const CHAT_RESERVE = 7_500;

function splitMemory(value) {
  const text = String(value || "").trim();
  const marker = AUTO_MARKER.trim();
  const index = text.indexOf(marker);
  if (index < 0) return { base: text, chat: "" };
  return {
    base: text.slice(0, index).trim(),
    chat: text.slice(index + marker.length).trim(),
  };
}

function composeMemory(base, chat) {
  const cleanBase = String(base || "").trim();
  const cleanChat = String(chat || "").trim();
  if (!cleanChat) return cleanBase.slice(0, MAX_MEMORY_CHARS);

  const marker = AUTO_MARKER;
  const maxBase = Math.max(0, MAX_MEMORY_CHARS - marker.length - CHAT_RESERVE);
  const keptBase = cleanBase.slice(0, maxBase);
  const roomForChat = Math.max(0, MAX_MEMORY_CHARS - keptBase.length - marker.length);
  const keptChat = cleanChat.slice(-roomForChat);
  return `${keptBase}${marker}${keptChat}`.trim();
}

function currentMemory() {
  try {
    const stored = localStorage.getItem(MEMORY_KEY) || "";
    const { base, chat } = splitMemory(stored);
    return composeMemory(base, chat);
  } catch {
    return "";
  }
}

function appendChatLine(role, text, maxChars) {
  try {
    const clean = String(text || "").trim().slice(0, maxChars);
    if (!clean) return;

    const stored = localStorage.getItem(MEMORY_KEY) || "";
    const { base, chat } = splitMemory(stored);
    const line = `${role}: ${clean}`;
    const nextChat = `${chat}${chat ? "\n\n" : ""}${line}`;
    localStorage.setItem(MEMORY_KEY, composeMemory(base, nextChat));
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

        if (pathname !== "/api/command/zaika") {
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
              // Inject only memory that existed before this request.
              const memoryBeforeTurn = currentMemory();
              nextInit = {
                ...init,
                body: JSON.stringify({ ...payload, ...(memoryBeforeTurn ? { memory: memoryBeforeTurn } : {}) }),
              };

              // Persist the user's message synchronously so the next request can recall it
              // even if response parsing is delayed.
              appendChatLine("USER", payload?.raw, 2_500);
            }
          } catch {
            payload = null;
          }
        }

        const response = await previousFetch(input, nextInit);

        if (response.ok && payload && reflectOnly) {
          response.clone().json().then((data) => {
            if (data?.executed === true && typeof data?.output === "string") {
              appendChatLine("ЗАИКА", data.output, 3_500);
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
