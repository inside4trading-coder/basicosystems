import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Phone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
const PUBLISHED_CALLS_URL = "https://basico-hub.lovable.app/llamadas";

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
  const [state, setState] = useState<PhoneState>({ status: "loading", message: "Conectando teléfono..." });
  const initAttempted = useRef(false);

  const fetchKeyAndInit = useCallback(async () => {
    initAttempted.current = true;
    removeExistingWidget();
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

      console.info("[WebPhone] WebRTC key obtained", { sipLogin, hasKey: true });

      setState({ status: "loading-scripts", message: "Cargando scripts oficiales..." });
      await loadScripts();
      await waitForWidgetFunction();

      if (typeof window.zadarmaWidgetFn !== "function") {
        throw new Error("zadarmaWidgetFn no encontrada después de cargar los scripts");
      }

      setState({ status: "initializing", message: "Inicializando teléfono..." });

      window.zadarmaWidgetFn(key, sipLogin, "square", "es", true, "{right:'10px',bottom:'5px'}");

      setState({ status: "ready", message: "Widget disponible en pantalla — esquina inferior derecha" });
      console.info("[WebPhone] Widget initialized — Zadarma handles its own DOM");
    } catch (error) {
      console.error("[WebPhone] Error:", error);
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "No se pudo cargar el teléfono web",
      });
    }
  }, []);

  useEffect(() => {
    if (initAttempted.current) return;

    if (isPreviewEnvironment()) {
      setState({
        status: "preview-blocked",
        message: `Las llamadas solo se ejecutan desde ${PUBLISHED_CALLS_URL}.`,
      });
      return;
    }

    fetchKeyAndInit();

    return () => {
      removeExistingWidget();
      removeZadarmaScripts();
    };
  }, [fetchKeyAndInit]);

  const isLoading = state.status === "loading" || state.status === "loading-scripts" || state.status === "initializing";

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="flex items-center gap-3 p-4">
        {isLoading && (
          <>
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Teléfono web</p>
              <p className="text-xs text-muted-foreground">{state.message}</p>
            </div>
          </>
        )}

        {state.status === "ready" && (
          <>
            <Phone className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Teléfono web activo</p>
              <p className="text-xs text-muted-foreground">{state.message}</p>
            </div>
          </>
        )}

        {state.status === "error" && (
          <>
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Error</p>
              <p className="text-xs text-muted-foreground">{state.message}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 text-xs"
              onClick={() => {
                initAttempted.current = false;
                fetchKeyAndInit();
              }}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Reintentar
            </Button>
          </>
        )}

        {state.status === "preview-blocked" && (
          <>
            <Phone className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Teléfono web</p>
              <p className="text-xs text-muted-foreground">{state.message}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function isFullSipLogin(value: unknown): value is string {
  return typeof value === "string" && /^\S+-\S+$/.test(value.trim());
}

function removeExistingWidget(): void {
  document.getElementById(WIDGET_ROOT_ID)?.remove();
}

function removeZadarmaScripts(): void {
  SCRIPT_URLS.forEach((url) => {
    document.querySelector(`script[src="${url}"]`)?.remove();
  });
}

function waitForWidgetFunction(timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      if (typeof window.zadarmaWidgetFn === "function") { resolve(); return; }
      if (Date.now() - startedAt >= timeoutMs) { reject(new Error("zadarmaWidgetFn no estuvo disponible a tiempo")); return; }
      window.setTimeout(check, 100);
    };
    check();
  });
}

function loadScripts(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.zadarmaWidgetFn === "function") { resolve(); return; }

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
      if (document.querySelector(`script[src="${url}"]`)) { loaded += 1; loadNext(); return; }

      const script = document.createElement("script");
      script.src = url;
      script.async = false;
      script.onload = () => { loaded += 1; loadNext(); };
      script.onerror = () => { window.clearTimeout(timeout); reject(new Error(`Failed to load script: ${url}`)); };
      document.head.appendChild(script);
    };
    loadNext();
  });
}
