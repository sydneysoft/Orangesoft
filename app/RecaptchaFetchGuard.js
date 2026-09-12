"use client";

import { useEffect } from "react";

const ACTION = "blueprint_command";
let scriptPromise = null;
let cachedConfig = null;

async function getConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    const response = await fetch("/api/recaptcha/config", { cache: "no-store" });
    cachedConfig = response.ok ? await response.json() : { enabled: false, siteKey: "" };
  } catch {
    cachedConfig = { enabled: false, siteKey: "" };
  }
  return cachedConfig;
}

function loadRecaptcha(siteKey) {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.grecaptcha?.execute) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-orangesoft-recaptcha="1"]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.orangesoftRecaptcha = "1";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return scriptPromise;
}

async function createToken() {
  const config = await getConfig();
  if (!config?.enabled || !config?.siteKey) return "";
  await loadRecaptcha(config.siteKey);
  return new Promise((resolve, reject) => {
    window.grecaptcha.ready(async () => {
      try {
        resolve(await window.grecaptcha.execute(config.siteKey, { action: ACTION }));
      } catch (error) {
        reject(error);
      }
    });
  });
}

export default function RecaptchaFetchGuard() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init = {}) => {
      const rawUrl = typeof input === "string" ? input : input?.url || String(input);
      let pathname = "";
      try { pathname = new URL(rawUrl, window.location.href).pathname; } catch {}

      if (!pathname.startsWith("/api/command")) {
        return originalFetch(input, init);
      }

      const config = await getConfig();
      if (!config?.enabled) return originalFetch(input, init);

      const token = await createToken();
      if (!token) throw new Error("reCAPTCHA verification token could not be created.");

      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));
      headers.set("x-recaptcha-token", token);

      return originalFetch(input, { ...init, headers });
    };

    getConfig().then((config) => {
      if (config?.enabled && config?.siteKey) loadRecaptcha(config.siteKey).catch(() => {});
    });

    return () => { window.fetch = originalFetch; };
  }, []);

  return null;
}
