"use client";

import { useLayoutEffect } from "react";

const EXACT_REPLACEMENTS = [
  ["MODE: THREE BRAINS", "MODE: THREE PRIVATE MODES"],
  ["ЛОКАЛ: GROQ / gpt-oss-120b", "ЛОКАЛ"],
  ["ИНКА: OLLAMA / blueprint-local", "ИНКА"],
  ["ЗАИКА: OPENAI / gpt-5.6-luna", "ЗАИКА"],
  ["ЛОКАЛ / GROQ", "ЛОКАЛ"],
  ["ИНКА / OLLAMA", "ИНКА"],
  ["ЗАИКА / OPENAI", "ЗАИКА"],
  ["ROUTE: /api/command/local → secure bridge → Ollama", "ROUTE: PRIVATE"],
  ["ROUTE: /api/command/zaika → OpenAI Responses API", "ROUTE: PRIVATE"],
  ["ROUTE: /api/command → Groq", "ROUTE: PRIVATE"],
  ["MODEL: blueprint-local", "MODEL: PRIVATE"],
  ["MODEL: gpt-5.6-luna", "MODEL: PRIVATE"],
  ["MODEL: gpt-oss-120b", "MODEL: PRIVATE"],
  ["ChatGPT Memory Summary", "private memory context"],
  ["select a brain", "select a mode"],
  ["Groq", "Private mode"],
  ["Ollama", "Private mode"],
  ["OpenAI", "Private mode"],
];

function cleanText(value) {
  let next = String(value ?? "");
  for (const [from, to] of EXACT_REPLACEMENTS) {
    next = next.split(from).join(to);
  }
  return next;
}

function scrubNode(node) {
  if (!node) return;

  if (node.nodeType === Node.TEXT_NODE) {
    const next = cleanText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  for (const attr of ["title", "aria-label", "placeholder"]) {
    if (!node.hasAttribute?.(attr)) continue;
    const current = node.getAttribute(attr) || "";
    const next = cleanText(current);
    if (next !== current) node.setAttribute(attr, next);
  }

  for (const child of node.childNodes || []) scrubNode(child);
}

export default function BlueprintPrivacyScrub() {
  useLayoutEffect(() => {
    if (!window.location.pathname.startsWith("/blueprint")) return undefined;

    const originalPrompt = window.prompt;
    window.prompt = function blueprintPrivatePrompt(message, defaultValue) {
      return originalPrompt.call(window, cleanText(message), defaultValue);
    };

    scrubNode(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          scrubNode(mutation.target);
          continue;
        }
        for (const node of mutation.addedNodes) scrubNode(node);
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      window.prompt = originalPrompt;
    };
  }, []);

  return null;
}
