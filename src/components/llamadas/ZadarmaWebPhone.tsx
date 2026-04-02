import { useCallback, useEffect, useRef } from "react";

/* ─── Debug: capture Zadarma internal events ─── */
function attachWidgetDebugListeners(): void {
  // Listen for Zadarma widget custom events
  const events = [
    "location_confirm", "location_error",
    "location_update", "incoming_call",
    "outgoing_call", "call_end",
    "webrtc_started", "webrtc_error",
  ];
  events.forEach((evt) => {
    window.addEventListener(evt, (e) => {
      console.info(`[WebPhone] Event: ${evt}`, e);
    });
  });

  // Override console.error temporarily to catch Zadarma internal errors
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    if (msg.toLowerCase().includes("zadarma") || msg.toLowerCase().includes("webrtc") || msg.toLowerCase().includes("sip") || msg.toLowerCase().includes("wss://")) {
      console.info("[WebPhone] Captured internal error:", ...args);
    }
    origError.apply(console, args);
  };
}

const SCRIPT_URLS = [
  "https://my.zadarma.com/webphoneWebRTCWidget/v8/js/loader-phone-lib.js?v=23",
  "https://my.zadarma.com/webphoneWebRTCWidget/v8/js/loader-phone-fn.js?v=23",
];

const WIDGET_ROOT_ID = "zdrmWPhI";
const WIDGET_POSITION = "{right:'10px',bottom:'5px'}";

type ZadarmaWidgetFn = (
  key: string,
  sip: string,
  shape: string,
  lang: string,
  fixed: boolean,
  position: string,
) => void;

declare global {
  interface Window {
    zadarmaWidgetFn?: ZadarmaWidgetFn;
  }
}

function isPreviewEnvironment(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname.includes("lovableproject.com") ||
    hostname.startsWith("id-preview--") ||
    hostname.includes("localhost") ||
    hostname.includes("127.0.0.1")
  );
}

export default function ZadarmaWebPhone() {
  const initAttempted = useRef(false);

  const fetchKeyAndInit = useCallback(async () => {
    initAttempted.current = true;
    removeExistingWidget();

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/zadarma-webrtc-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "WebRTC key error");

      const { key, sipLogin } = data;
      if (typeof key !== "string" || !key.trim()) throw new Error("Invalid WebRTC key");
      if (typeof sipLogin !== "string" || !sipLogin.trim()) throw new Error("Invalid SIP login");

      console.info("[WebPhone] Key obtained (length:", key.length, "), SIP:", sipLogin);
      console.info("[WebPhone] Loading scripts...");
      await loadScripts();
      await waitForWidgetFunction();
      console.info("[WebPhone] Scripts loaded, zadarmaWidgetFn available");
      await waitForStableLayout();

      if (typeof window.zadarmaWidgetFn !== "function") throw new Error("zadarmaWidgetFn not found");

      console.info("[WebPhone] Calling zadarmaWidgetFn with SIP:", sipLogin, "shape: square, lang: es, fixed: true, position:", WIDGET_POSITION);
      attachWidgetDebugListeners();
      window.zadarmaWidgetFn(key, sipLogin, "square", "es", true, WIDGET_POSITION);
      await ensureWidgetPlacement();
      const widgetEl = document.getElementById(WIDGET_ROOT_ID);
      console.info("[WebPhone] Widget initialized. Element found:", !!widgetEl, "Children:", widgetEl?.children.length, "InnerHTML length:", widgetEl?.innerHTML.length);
      
      // Check if widget has iframe (indicates successful SIP registration attempt)
      const iframes = widgetEl?.querySelectorAll("iframe");
      console.info("[WebPhone] Widget iframes:", iframes?.length);
      if (iframes && iframes.length > 0) {
        iframes.forEach((iframe, i) => {
          console.info(`[WebPhone] Iframe ${i}: src=${iframe.src}`);
        });
      }
    } catch (error) {
      console.error("[WebPhone] Error:", error);
    }
  }, []);

  useEffect(() => {
    if (initAttempted.current) return;

    if (isPreviewEnvironment()) {
      console.info("[WebPhone] Preview environment — skipping init");
      return;
    }

    fetchKeyAndInit();

    return () => {
      removeExistingWidget();
      SCRIPT_URLS.forEach((url) => document.querySelector(`script[src="${url}"]`)?.remove());
    };
  }, [fetchKeyAndInit]);

  return null;
}

function removeExistingWidget(): void {
  document.getElementById(WIDGET_ROOT_ID)?.remove();
}

function waitForStableLayout(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, 150);
      });
    });
  });
}

function waitForWidgetElement(timeoutMs = 8000): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      const widget = document.getElementById(WIDGET_ROOT_ID);
      if (widget instanceof HTMLElement) {
        resolve(widget);
        return;
      }

      if (Date.now() - start >= timeoutMs) {
        reject(new Error("Widget element timeout"));
        return;
      }

      window.setTimeout(check, 100);
    };

    check();
  });
}

async function ensureWidgetPlacement(): Promise<void> {
  const widget = await waitForWidgetElement();
  widget.style.position = "fixed";
  widget.style.right = "10px";
  widget.style.bottom = "5px";
  widget.style.left = "auto";
  widget.style.top = "auto";
  widget.style.zIndex = "60";
}

function waitForWidgetFunction(timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (typeof window.zadarmaWidgetFn === "function") {
        resolve();
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        reject(new Error("Widget function timeout"));
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
}

function loadScripts(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.zadarmaWidgetFn === "function") {
      resolve();
      return;
    }

    const timeout = setTimeout(() => reject(new Error("Script load timeout")), 15000);
    let loaded = 0;

    const loadNext = () => {
      if (loaded >= SCRIPT_URLS.length) {
        clearTimeout(timeout);
        setTimeout(resolve, 500);
        return;
      }

      const url = SCRIPT_URLS[loaded];
      if (document.querySelector(`script[src="${url}"]`)) {
        loaded += 1;
        loadNext();
        return;
      }

      const script = document.createElement("script");
      script.src = url;
      script.async = false;
      script.onload = () => {
        loaded += 1;
        loadNext();
      };
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed: ${url}`));
      };
      document.head.appendChild(script);
    };

    loadNext();
  });
}
