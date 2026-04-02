import { useState, useEffect, useRef, useCallback } from "react";
import { Phone, Loader2, AlertTriangle, RefreshCw, Monitor, X, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type PhoneStatus = "loading" | "loading-scripts" | "initializing" | "ready" | "error" | "preview-blocked";

interface PhoneState {
  status: PhoneStatus;
  message: string;
}

const SCRIPT_URLS = [
  "https://my.zadarma.com/webphoneWebRTCWidget/v8/js/loader-phone-lib.js",
  "https://my.zadarma.com/webphoneWebRTCWidget/v8/js/loader-phone-fn.js",
];

const WIDGET_ROOT_ID = "zdrmWPhI";
const WIDGET_POSITION = {
  bottom: "0px",
  right: "0px",
};

type ZadarmaWidgetFn = (
  key: string,
  sip: string,
  shape: "square" | "circle",
  lang: "ru" | "en" | "es" | "fr" | "de" | "pl" | "ua",
  fixed: boolean,
  position: { bottom?: string; top?: string; right?: string; left?: string },
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
    hostname.includes("127.0.0.1") ||
    window.self !== window.top
  );
}

export default function ZadarmaWebPhone() {
  const [state, setState] = useState<PhoneState>({ status: "loading", message: "Conectando teléfono..." });
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initAttempted = useRef(false);
  const mountedRef = useRef(true);

  const fetchKeyAndInit = useCallback(async () => {
    initAttempted.current = true;
    removeExistingWidget(containerRef.current);
    setState({ status: "loading", message: "Conectando teléfono..." });

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/zadarma-webrtc-key`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo obtener la clave WebRTC");
      }

      const { key, sipLogin } = data;
      if (typeof key !== "string" || !key.trim()) {
        throw new Error("La clave WebRTC recibida no es válida");
      }

      if (!isFullSipLogin(sipLogin)) {
        throw new Error("El login SIP recibido no es el login completo de la extensión PBX");
      }

      console.info("[WebPhone] WebRTC key obtained", { sipLogin, hasKey: true });

      setState({ status: "loading-scripts", message: "Conectando teléfono..." });

      try {
        await loadScripts();
        await waitForWidgetFunction();
      } catch (scriptErr) {
        console.warn("[WebPhone] Script loading failed:", scriptErr);
        if (isPreviewEnvironment()) {
          setState({ status: "preview-blocked", message: "El teléfono web no puede renderizarse en este entorno preview." });
          return;
        }
        throw new Error("No se pudieron cargar los scripts del teléfono web");
      }

      if (!containerRef.current) throw new Error("Contenedor no disponible");

      setState({ status: "initializing", message: "Conectando teléfono..." });
      await waitForNextPaint();

      if (typeof window.zadarmaWidgetFn !== "function") {
        if (isPreviewEnvironment()) {
          setState({ status: "preview-blocked", message: "El teléfono web no puede renderizarse en este entorno preview." });
          return;
        }
        throw new Error("zadarmaWidgetFn no encontrada");
      }

      (window.zadarmaWidgetFn as ZadarmaWidgetFn)(key, sipLogin, "square", "es", false, WIDGET_POSITION);

      const widgetElement = await waitForWidgetElement();
      if (!containerRef.current) throw new Error("Contenedor no disponible");

      containerRef.current.replaceChildren(widgetElement);
      widgetElement.style.margin = "0";

      setState({ status: "ready", message: "Teléfono web listo" });
    } catch (err) {
      console.error("[WebPhone] Error:", err);
      if (isPreviewEnvironment() && shouldTreatAsPreviewIssue(err)) {
        setState({ status: "preview-blocked", message: "El teléfono web no puede renderizarse en este entorno preview." });
      } else {
        setState({ status: "error", message: "No se pudo cargar el teléfono web" });
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!initAttempted.current) fetchKeyAndInit();
    return () => {
      mountedRef.current = false;
      removeExistingWidget(containerRef.current);
    };
  }, [fetchKeyAndInit]);

  const statusDot = () => {
    switch (state.status) {
      case "loading":
      case "loading-scripts":
      case "initializing":
        return "bg-yellow-400 animate-pulse";
      case "ready":
        return "bg-green-500";
      case "error":
        return "bg-destructive";
      case "preview-blocked":
        return "bg-muted-foreground";
    }
  };

  const isLoading = state.status === "loading" || state.status === "loading-scripts" || state.status === "initializing";

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {/* Expanded panel */}
      {expanded && (
        <div className="w-[320px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Phone className="h-3.5 w-3.5" />
              Teléfono web
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(false)}>
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Widget container */}
          <div className="relative min-h-[420px] bg-muted/20">
            <div
              ref={containerRef}
              id="zadarma-webphone-container"
              className={state.status === "ready" ? "min-h-[420px]" : "min-h-[420px] opacity-0 pointer-events-none"}
            />

            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{state.message}</p>
              </div>
            )}

            {state.status === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-background/90">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <p className="text-xs text-muted-foreground max-w-xs">{state.message}</p>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => { initAttempted.current = false; fetchKeyAndInit(); }}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Reintentar
                </Button>
              </div>
            )}

            {state.status === "preview-blocked" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-background/90">
                <Monitor className="h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground max-w-[260px]">{state.message}</p>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => { initAttempted.current = false; fetchKeyAndInit(); }}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Reintentar
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FAB button */}
      <Button
        onClick={() => setExpanded(!expanded)}
        className="h-14 w-14 rounded-full shadow-lg relative"
        variant={expanded ? "secondary" : "default"}
        size="icon"
      >
        {expanded ? <X className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
        {/* Status dot */}
        <span className={`absolute top-0 right-0 h-3 w-3 rounded-full border-2 border-card ${statusDot()}`} />
      </Button>
    </div>
  );
}

// --- helpers (unchanged logic) ---

function isFullSipLogin(value: unknown): value is string {
  return typeof value === "string" && /^\S+-\S+$/.test(value.trim());
}

function shouldTreatAsPreviewIssue(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return !message.includes("sip") && !message.includes("clave") && !message.includes("webrtc") && !message.includes("backend");
}

function removeExistingWidget(container: HTMLDivElement | null): void {
  container?.replaceChildren();
  document.getElementById(WIDGET_ROOT_ID)?.remove();
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function waitForWidgetFunction(timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      if (typeof window.zadarmaWidgetFn === "function") { resolve(); return; }
      if (Date.now() - startedAt >= timeoutMs) { reject(new Error("zadarmaWidgetFn timeout")); return; }
      window.setTimeout(check, 100);
    };
    check();
  });
}

function waitForWidgetElement(timeoutMs = 8000): Promise<HTMLDivElement> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(WIDGET_ROOT_ID);
    if (existing instanceof HTMLDivElement) { resolve(existing); return; }

    const observer = new MutationObserver(() => {
      const widget = document.getElementById(WIDGET_ROOT_ID);
      if (widget instanceof HTMLDivElement) {
        window.clearTimeout(timeout);
        observer.disconnect();
        resolve(widget);
      }
    });

    const timeout = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error("Widget Zadarma no se montó a tiempo"));
    }, timeoutMs);

    observer.observe(document.body, { childList: true, subtree: true });
  });
}

function loadScripts(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.zadarmaWidgetFn === "function") { resolve(); return; }

    const timeout = setTimeout(() => reject(new Error("Timeout scripts Zadarma")), 15000);
    let loaded = 0;

    function loadNext() {
      if (loaded >= SCRIPT_URLS.length) {
        clearTimeout(timeout);
        setTimeout(resolve, 500);
        return;
      }
      const url = SCRIPT_URLS[loaded];
      if (document.querySelector(`script[src="${url}"]`)) { loaded++; loadNext(); return; }

      const script = document.createElement("script");
      script.src = url;
      script.async = false;
      script.onload = () => { loaded++; loadNext(); };
      script.onerror = () => { clearTimeout(timeout); reject(new Error(`Failed to load: ${url}`)); };
      document.head.appendChild(script);
    }
    loadNext();
  });
}
