"use client";

import { useEffect } from "react";

const MEMORY_KEY = "blueprint.zaika.memory";
const MAX_MEMORY_CHARS = 20_000;
const AUTO_MARKER = "\n\n--- ZAИКА AUTO-SAVED CHAT ---\n";
const CHAT_RESERVE = 7_500;

function splitMemory(value) {
  const text = String(value || "").trim();
  const index = text.indexOf(AUTO_MARKER.trim());
  if (index < 0) return { base: text, chat: "" };
  return {
    base: text.slice(0, index).trim(),
    chat: text.slice(index + AUTO_MARKER.trim().length).trim(),
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

function rememberTurn(userText, assistantText) {
  try {
    const stored = localStorage.getItem(MEMORY_KEY) || "";
    const { base, chat } = splitMemory(stored);
    const user = String(userText || "").trim().slice(0, 2_500);
    const assistant = String(assistantText || "").trim().slice(0, 3_500);
    if (!user || !assistant) return;

    const turn = `USER: ${user}\nЗАИКА: ${assistant}`;
    const nextChat = `${chat}${chat ? "\n\n" : ""}${turn}`;
    localStorage.setItem(MEMORY_KEY, composeMemory(base, nextChat));
  } catch {
    // Memory is optional. A storage failure must never break Blueprint chat.
  }
}

export default function ZaikaAutoMemory() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init = {}) => {
      const rawUrl = typeof input === "string" ? input : input?.url || String(input);
      let pathname = "";
      try { pathname = new URL(rawUrl, window.location.href).pathname; } catch {}

      if (pathname !== "/api/command/zaika" || window.location.pathname !== "/blueprint") {
        return originalFetch(input, init);
      }

      let payload = null;
      let nextInit = init;
      if (typeof init?.body === "string") {
        try {
          payload = JSON.parse(init.body);
          const memory = currentMemory();
          nextInit = {
            ...init,
            body: JSON.stringify({ ...payload, ...(memory ? { memory } : {}) }),
          };
        } catch {
          payload = null;
        }
      }

      const response = await originalFetch(input, nextInit);

      if (response.ok && payload) {
        const reflectOnly = Array.isArray(payload?.plan)
          ? payload.plan.every((step) => String(step?.type || "").toLowerCase() === "reflect")
          : true;

        if (reflectOnly) {
          response.clone().json().then((data) => {
            if (data?.executed === true && typeof data?.output === "string") {
              rememberTurn(payload.raw, data.output);
            }
          }).catch(() => {});
        }
      }

      return response;
    };

    return () => { window.fetch = originalFetch; };
  }, []);

  return null;
}
