"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the browser currently has a network connection.
 *
 * Now that the manual board works offline, the difference matters: pressing
 * Listen with no connection fails in a way that looks like a broken
 * microphone, which is both wrong and alarming. Knowing we are offline lets
 * the app say the true thing instead — the AI needs a network, the board does
 * not.
 *
 * `navigator.onLine` is famously optimistic: it reports true for a connection
 * that goes nowhere, such as a captive portal. It is reliable in the
 * direction that matters here, though — false really does mean offline — so
 * it is used only to explain a failure, never to pre-emptively block anything
 * that might have worked.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    // Assume online during server render: a false "you are offline" banner on
    // first paint would be worse than a moment of optimism.
    () => true,
  );
}
