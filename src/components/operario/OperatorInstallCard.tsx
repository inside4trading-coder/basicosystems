import { useEffect, useState } from "react";
import { Download, Check, Share, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia?.("(display-mode: standalone)").matches === true || iosStandalone;
}

export function OperatorInstallCard() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone) {
    return (
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5" /> Acceso directo activo
      </div>
    );
  }

  if (installed) {
    return (
      <div className="mt-6 rounded-lg border bg-card p-4 text-sm">
        <div className="flex items-center gap-2 font-semibold">
          <Check className="h-4 w-4 text-primary" /> Acceso directo instalado
        </div>
        <p className="mt-1 text-muted-foreground">
          Ya puedes abrir BASICO Operario desde la pantalla de inicio de tu teléfono.
        </p>
      </div>
    );
  }

  const platform = detectPlatform();

  const handleClick = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted") setInstalled(true);
        setDeferred(null);
        return;
      } catch {
        // cae a instrucciones manuales
      }
    }
    setShowSteps(true);
  };

  return (
    <div className="mt-6 rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Instalar acceso directo</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Agrega BASICO Operario a la pantalla de inicio para entrar más rápido al portal de escaneo.
      </p>

      <Button className="mt-3 w-full" onClick={handleClick}>
        <Download className="mr-2 h-4 w-4" /> Instalar acceso directo
      </Button>

      {showSteps && (
        <div className="mt-4 space-y-3 text-sm">
          {platform !== "android" && (
            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <Share className="h-4 w-4" /> En iPhone
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Toca compartir en Safari.</li>
                <li>Elige “Agregar a pantalla de inicio”.</li>
                <li>Confirma con “Agregar”.</li>
              </ol>
            </div>
          )}
          {platform !== "ios" && (
            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <MoreVertical className="h-4 w-4" /> En Android
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Abre el menú de Chrome.</li>
                <li>Toca “Agregar a pantalla principal” o “Instalar app”.</li>
                <li>Confirma.</li>
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
