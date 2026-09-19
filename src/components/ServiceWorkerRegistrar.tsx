"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker.
 *
 * Production only. In development Turbopack serves modules that change on
 * every edit, and a cache-first worker in front of that produces stale-bundle
 * bugs that look like application bugs.
 *
 * Failure is silent on purpose: no service worker means no offline support,
 * which is a downgrade, not a fault. It must never surface an error to
 * someone trying to communicate.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    };

    // After load, so precaching never competes with the first paint of the
    // board itself.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
