import { useCallback, useEffect, useState, useRef } from "react";
import { AlertTriangle, Loader2, Monitor, Phone, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type PhoneStatus = "idle" | "loading" | "loading-scripts" | "initializing" | "ready" | "error" | "preview-blocked";

interface PhoneState {
  status: PhoneStatus;
  message: string;
}

const SCRIPT_URLS = [
  "https://my.zadarma.com/webphoneWebRTCWidget/v8/js/loader-phone-lib.js",
  "https://my.zadarma.com/webphoneWebRTCWidget/v8/js/loader-phone-fn.js",
];

const WIDGET_ROOT_ID = "zdrmWPhI";
const WIDGET_POSITION = { bottom: "0px", right: "0px" };
const PUBLISHED_CALLS_URL = "https://basico-hub.lovable.app/llamadas";

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
  const [state, setState] = useState<PhoneState>({ status: "idle", message: "" });
  const [expanded, setExpanded] = useState(false);
  const initAttempted = useRef(false);
  const initAttempted = useRef(false);
  const previewEnvironment = isPreviewEnvironment();

  const fetchKeyAndInit = useCallback(async () => {
    initAttempted.current = true;
    removeExistingWidget(containerRef.current);
    setState({ status: "loading", message: "Conectando teléfono..." });

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/zadarma-webrtc-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo obtener la clave WebRTC");
      }

      const { key, sipLogin } = data;
      if (typeof key !== "string" || !key.trim()) {
        throw new Error("La clave WebRTC recibida no es válida");
      }

      if (!isFullSipLogin(sipLogin)) {
        throw new Error("El login SIP recibido no es el login completo de la extensión PBX");
      }

      console.info("[WebPhone] WebRTC key obtained", {
        sipLogin,
        hasKey: true,
        hostname: window.location.hostname,
      });

      setState({ status: "loading-scripts", message: "Cargando scripts oficiales..." });
      await loadScripts();
      await waitForWidgetFunction();
      await waitForNextPaint();

      if (!containerRef.current) {
        throw new Error("El contenedor del teléfono web no está disponible");
      }

      if (typeof window.zadarmaWidgetFn !== "function") {
        throw new Error("zadarmaWidgetFn no encontrada después de cargar los scripts");
      }

      setState({ status: "initializing", message: "Inicializando teléfono..." });
      console.info("[WebPhone] Initializing widget", {
        sipLogin,
        position: WIDGET_POSITION,
      });

      window.zadarmaWidgetFn(key, sipLogin, "square", "es", false, WIDGET_POSITION);

      const widgetElement = await waitForWidgetElement();
      if (!containerRef.current) {
        throw new Error("El contenedor del teléfono web dejó de estar disponible");
      }

      widgetElement.style.margin = "0";
      widgetElement.style.display = "block";
      widgetElement.style.maxWidth = "100%";
      containerRef.current.replaceChildren(widgetElement);

      console.info("[WebPhone] Widget mounted successfully inside calls page");
      setState({ status: "ready", message: "Teléfono web listo" });
    } catch (error) {
      console.error("[WebPhone] Error:", error);
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "No se pudo cargar el teléfono web",
      });
    }
  }, []);

  useEffect(() => {
    return () => removeExistingWidget(containerRef.current);
  }, []);

  useEffect(() => {
    if (!expanded || initAttempted.current) {
      return;
    }

    if (previewEnvironment) {
      console.info("[WebPhone] Preview environment detected, blocking live call init", {
        hostname: window.location.hostname,
      });
      setState({
        status: "preview-blocked",
        message: `El preview usa un dominio distinto al publicado. Las llamadas solo se ejecutan desde ${PUBLISHED_CALLS_URL}.`,
      });
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      fetchKeyAndInit();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [expanded, previewEnvironment, fetchKeyAndInit]);

  const isLoading = state.status === "loading" || state.status === "loading-scripts" || state.status === "initializing";

  const statusDotClass = (() => {
    switch (state.status) {
      case "loading":
      case "loading-scripts":
      case "initializing":
        return "bg-accent animate-pulse";
      case "ready":
        return "bg-primary";
      case "error":
        return "bg-destructive";
      case "idle":
      case "preview-blocked":
      default:
        return "bg-muted-foreground";
    }
  })();

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      <div
        className={`w-[332px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl transition-all duration-200 ${
          expanded
            ? "translate-y-0 scale-100 opacity-100 pointer-events-auto"
            : "translate-y-3 scale-95 opacity-0 pointer-events-none"
        }`}
        aria-hidden={!expanded}
      >
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Phone className="h-4 w-4" />
            Teléfono web
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setExpanded(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className={`relative overflow-hidden ${state.status === "ready" ? "bg-card" : "min-h-[496px] bg-background"}`}>
          <div
            ref={containerRef}
            id="zadarma-webphone-container"
            className={state.status === "ready" ? "block leading-none" : "hidden"}
          />

          {(state.status === "idle" || isLoading) && (
            <div className="flex min-h-[496px] flex-col items-center justify-center gap-3 px-6 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="max-w-[240px] text-xs text-muted-foreground">{state.message || "Preparando teléfono..."}</p>
            </div>
          )}

          {state.status === "error" && (
            <div className="flex min-h-[496px] flex-col items-center justify-center gap-3 px-6 text-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <p className="max-w-[260px] text-xs text-muted-foreground">{state.message}</p>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => {
                  initAttempted.current = false;
                  fetchKeyAndInit();
                }}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Reintentar
              </Button>
            </div>
          )}

          {state.status === "preview-blocked" && (
            <div className="flex min-h-[496px] flex-col items-center justify-center gap-3 px-6 text-center">
              <Monitor className="h-6 w-6 text-muted-foreground" />
              <p className="max-w-[260px] text-xs text-muted-foreground">{state.message}</p>
            </div>
          )}
        </div>
      </div>

      <Button
        onClick={() => setExpanded((current) => !current)}
        className="relative h-14 w-14 rounded-full shadow-xl transition-shadow hover:shadow-2xl"
        variant={expanded ? "secondary" : "default"}
        size="icon"
        aria-label={expanded ? "Cerrar teléfono web" : "Abrir teléfono web"}
      >
        {expanded ? <X className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
        <span className={`absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${statusDotClass}`} />
      </Button>
    </div>
  );
}

function isFullSipLogin(value: unknown): value is string {
  return typeof value === "string" && /^\S+-\S+$/.test(value.trim());
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
      if (typeof window.zadarmaWidgetFn === "function") {
        resolve();
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("zadarmaWidgetFn no estuvo disponible a tiempo"));
        return;
      }

      window.setTimeout(check, 100);
    };

    check();
  });
}

function waitForWidgetElement(timeoutMs = 8000): Promise<HTMLDivElement> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(WIDGET_ROOT_ID);
    if (existing instanceof HTMLDivElement) {
      resolve(existing);
      return;
    }

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
      reject(new Error("El widget de Zadarma no se montó en el DOM a tiempo"));
    }, timeoutMs);

    observer.observe(document.body, { childList: true, subtree: true });
  });
}

function loadScripts(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.zadarmaWidgetFn === "function") {
      resolve();
      return;
    }

    const timeout = window.setTimeout(() => {
      reject(new Error("Timeout cargando scripts de Zadarma (15s)"));
    }, 15000);

    let loaded = 0;

    const loadNext = () => {
      if (loaded >= SCRIPT_URLS.length) {
        window.clearTimeout(timeout);
        window.setTimeout(resolve, 500);
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
        window.clearTimeout(timeout);
        reject(new Error(`Failed to load script: ${url}`));
      };
      document.head.appendChild(script);
    };

    loadNext();
  });
}
