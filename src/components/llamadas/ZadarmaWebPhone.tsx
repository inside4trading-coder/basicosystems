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

function isPreviewEnvironment(): boolean {
  const hostname = window.location.hostname;
  return (
    hostname.includes("lovableproject.com") ||
    hostname.includes("lovable.app") ||
    hostname.includes("localhost") ||
    hostname.includes("127.0.0.1") ||
    window.self !== window.top // iframe detection
  );
}

export default function ZadarmaWebPhone() {
  const [state, setState] = useState<PhoneState>({ status: "loading", message: "Obteniendo clave WebRTC..." });
  const containerRef = useRef<HTMLDivElement>(null);
  const initAttempted = useRef(false);

  const fetchKeyAndInit = useCallback(async () => {
    initAttempted.current = true;
    setState({ status: "loading", message: "Obteniendo clave WebRTC..." });

    try {
      // 1. Fetch WebRTC key from edge function
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
      console.log("[WebPhone] WebRTC key obtained for SIP:", sipLogin);

      // 2. Load external scripts
      setState({ status: "loading-scripts", message: "Cargando scripts del teléfono..." });

      try {
        await loadScripts();
        console.log("[WebPhone] External scripts loaded");
      } catch (scriptErr) {
        console.warn("[WebPhone] Script loading failed:", scriptErr);

        // Check if it's a preview environment blocking scripts
        if (isPreviewEnvironment()) {
          setState({
            status: "preview-blocked",
            message: "El teléfono web no puede renderizarse en este entorno preview. Los scripts externos de Zadarma están bloqueados por restricciones de sandbox/iframe. Probar en entorno desplegado o compatible.",
          });
          return;
        }

        throw new Error("No se pudieron cargar los scripts del teléfono web");
      }

      // 3. Initialize the widget
      setState({ status: "initializing", message: "Inicializando teléfono..." });

      const win = window as unknown as Record<string, unknown>;
      if (typeof win.zadarmaWidgetFn !== "function") {
        console.error("[WebPhone] zadarmaWidgetFn not found on window after script load");

        if (isPreviewEnvironment()) {
          setState({
            status: "preview-blocked",
            message: "El teléfono web no puede renderizarse en este entorno preview. La función zadarmaWidgetFn no está disponible. Probar en entorno desplegado o compatible.",
          });
          return;
        }

        throw new Error("zadarmaWidgetFn no encontrada después de cargar los scripts");
      }

      // Call the widget initialization
      (win.zadarmaWidgetFn as (config: Record<string, unknown>) => void)({
        key,
        sip: sipLogin,
        lang: "es",
        container: containerRef.current,
      });

      console.log("[WebPhone] Widget initialized successfully");
      setState({ status: "ready", message: "Teléfono web listo" });
    } catch (err) {
      console.error("[WebPhone] Error:", err);

      if (isPreviewEnvironment()) {
        setState({
          status: "preview-blocked",
          message: `El teléfono web no puede renderizarse en este entorno preview. ${err instanceof Error ? err.message : "Error desconocido"}. Probar en entorno desplegado o compatible.`,
        });
      } else {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Error desconocido al inicializar el teléfono",
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!initAttempted.current) {
      fetchKeyAndInit();
    }
  }, [fetchKeyAndInit]);

  const statusBadge = () => {
    switch (state.status) {
      case "loading":
      case "loading-scripts":
      case "initializing":
        return <Badge variant="secondary" className="text-xs">Conectando</Badge>;
      case "ready":
        return <Badge className="text-xs bg-green-600">Conectado</Badge>;
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
        {/* Loading states */}
        {(state.status === "loading" || state.status === "loading-scripts" || state.status === "initializing") && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
        )}

        {/* Error state */}
        {state.status === "error" && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
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

        {/* Preview blocked state */}
        {state.status === "preview-blocked" && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
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

        {/* Widget container - always mounted for the widget to attach to */}
        <div
          ref={containerRef}
          id="zadarma-webphone-container"
          className={state.status === "ready" ? "min-h-[400px]" : "hidden"}
        />
      </CardContent>
    </Card>
  );
}

/** Load external scripts sequentially with timeout */
function loadScripts(): Promise<void> {
  return new Promise((resolve, reject) => {
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
