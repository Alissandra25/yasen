import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

// The server has no `navigator` — always reports online, so the client's first render matches
// it and the real value (if different) applies right after hydration, no mismatch.
function getServerSnapshot() {
  return true;
}

/** Live `navigator.onLine`, safe to read during SSR (see the "Зв'язок із сервером" mockup). */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
