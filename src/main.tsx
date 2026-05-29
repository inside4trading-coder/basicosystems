import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker only in production, top-level windows, outside Lovable preview.
if ("serviceWorker" in navigator) {
  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const host = window.location.hostname;
  const isPreviewHost = host.includes("lovableproject.com") || host.includes("lovable.app") && host.includes("id-preview");
  const isLocalhost = host === "localhost" || host === "127.0.0.1";

  if (isInIframe || isPreviewHost || isLocalhost || import.meta.env.DEV) {
    // Clean up any previously registered SW in dev/preview contexts.
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
