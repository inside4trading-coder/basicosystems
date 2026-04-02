import { useState, useEffect, useRef, useCallback } from "react";
import { Phone, Loader2, AlertTriangle, RefreshCw, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
    window.self !== window.top // iframe detection
  );
}

export default function ZadarmaWebPhone() {
  const [state, setState] = useState<PhoneState>({ status: "loading", message: "Conectando teléfono..." });
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

      console.info("[WebPhone] WebRTC key obtained", {
        sipLogin,
        hasKey: true,
        hostname: window.location.hostname,
      });

      setState({ status: "loading-scripts", message: "Conectando teléfono..." });

      try {
        await loadScripts();
        await waitForWidgetFunction();
        console.info("[WebPhone] External scripts loaded and widget function available");
      } catch (scriptErr) {
        console.warn("[WebPhone] Script loading failed:", scriptErr);

        if (isPreviewEnvironment()) {
          setState({
            status: "preview-blocked",
            message: "El teléfono web no puede renderizarse correctamente en este entorno preview de Lovable. Validar en entorno desplegado.",
          });
          return;
        }

        throw new Error("No se pudieron cargar los scripts del teléfono web");
      }

      if (!containerRef.current) {
        throw new Error("El contenedor del teléfono web no está disponible");
      }

      setState({ status: "initializing", message: "Conectando teléfono..." });
      await waitForNextPaint();

      const win = window as unknown as Record<string, unknown>;
      if (typeof win.zadarmaWidgetFn !== "function") {
        console.error("[WebPhone] zadarmaWidgetFn not found on window after script load");

        if (isPreviewEnvironment()) {
          setState({
            status: "preview-blocked",
            message: "El teléfono web no puede renderizarse correctamente en este entorno preview de Lovable. Validar en entorno desplegado.",
          });
          return;
        }

        throw new Error("zadarmaWidgetFn no encontrada después de cargar los scripts");
      }

      console.info("[WebPhone] Initializing widget", {
        sipLogin,
        position: WIDGET_POSITION,
      });

      (win.zadarmaWidgetFn as ZadarmaWidgetFn)(
        key,
        sipLogin,
        "square",
        "es",
        false,
        WIDGET_POSITION,
      );

      const widgetElement = await waitForWidgetElement();

      if (!containerRef.current) {
        throw new Error("El contenedor del teléfono web dejó de estar disponible");
      }

      containerRef.current.replaceChildren(widgetElement);
      widgetElement.style.margin = "0";
      console.info("[WebPhone] Widget mounted successfully inside dashboard container");

      setState({ status: "ready", message: "Teléfono web listo" });
    } catch (err) {
      console.error("[WebPhone] Error:", err);

      if (isPreviewEnvironment() && shouldTreatAsPreviewIssue(err)) {
        setState({
          status: "preview-blocked",
          message: "El teléfono web no puede renderizarse correctamente en este entorno preview de Lovable. Validar en entorno desplegado.",
        });
      } else {
        setState({
          status: "error",
          message: "No se pudo cargar el teléfono web",
        });
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!initAttempted.current) {
      fetchKeyAndInit();
    }

    return () => {
      mountedRef.current = false;
      removeExistingWidget(containerRef.current);
    };
  }, [fetchKeyAndInit]);

  const statusBadge = () => {
    switch (state.status) {
      case "loading":
      case "loading-scripts":
      case "initializing":
        return <Badge variant="secondary" className="text-xs">Conectando</Badge>;
      case "ready":
        return <Badge className="text-xs">Conectado</Badge>;
      case "error":
        return <Badge variant="destructive" className="text-xs">Error</Badge>;
      case "preview-blocked":
        return <Badge variant="outline" className="text-xs">Preview</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Teléfono web
          </CardTitle>
          {statusBadge()}
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative min-h-[420px] overflow-hidden rounded-lg border border-border bg-muted/20">
          <div
            ref={containerRef}
            id="zadarma-webphone-container"
            className={state.status === "ready" ? "min-h-[420px]" : "min-h-[420px] opacity-0 pointer-events-none"}
          />

          {(state.status === "loading" || state.status === "loading-scripts" || state.status === "initializing") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-background/80 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{state.message}</p>
            </div>
          )}

          {state.status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-background/90">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground max-w-xs">{state.message}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  initAttempted.current = false;
                  fetchKeyAndInit();
                }}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Reintentar
              </Button>
            </div>
          )}

          {state.status === "preview-blocked" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-background/90">
              <Monitor className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground max-w-sm">{state.message}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  initAttempted.current = false;
                  fetchKeyAndInit();
                }}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Reintentar
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

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

    const timeout = setTimeout(() => {
      reject(new Error("Timeout cargando scripts de Zadarma (15s)"));
    }, 15000);

    let loaded = 0;

    function loadNext() {
      if (loaded >= SCRIPT_URLS.length) {
        clearTimeout(timeout);
        // Give scripts a moment to initialize
        setTimeout(resolve, 500);
        return;
      }

      const url = SCRIPT_URLS[loaded];

      // Check if already loaded
      if (document.querySelector(`script[src="${url}"]`)) {
        loaded++;
        loadNext();
        return;
      }

      const script = document.createElement("script");
      script.src = url;
      script.async = false;
      script.onload = () => {
        console.log(`[WebPhone] Script loaded: ${url}`);
        loaded++;
        loadNext();
      };
      script.onerror = (e) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load script: ${url}`));
      };
      document.head.appendChild(script);
    }

    loadNext();
  });
}
