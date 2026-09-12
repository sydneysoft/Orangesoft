"use client";

import { useEffect, useState } from "react";

const COOKIE_KEY = "orangesoft_cookie_notice_accepted";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(COOKIE_KEY) !== "yes");
    } catch {
      setVisible(true);
    }
  }, []);

  function acceptCookies() {
    try {
      localStorage.setItem(COOKIE_KEY, "yes");
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookieBanner" role="region" aria-label="Cookie notice">
      <div className="cookieInner shell">
        <div>
          <strong>COOKIE NOTICE</strong>
          <p>
            OrangeSoft uses essential browser storage for site preferences and Google reCAPTCHA
            for security and abuse prevention when reCAPTCHA is enabled.
          </p>
        </div>
        <button type="button" className="pixelButton cookieAccept" onClick={acceptCookies}>
          ACCEPT
        </button>
      </div>
    </div>
  );
}
