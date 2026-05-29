import { useEffect, useState } from "react";
import { Download, Smartphone, Monitor, Apple } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "desktop" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (/chrome|edg|chromium|safari/.test(ua)) return "desktop";
  return "other";
}

interface Props {
  collapsed?: boolean;
}

export function InstallAppButton({ collapsed }: Props) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      toast.success("BASICO SYSTEM instalado en este dispositivo.");
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    // Detect if already running as installed app
    if (window.matchMedia?.("(display-mode: standalone)").matches) {
      setInstalled(true);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleClick = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted") {
          toast.success("BASICO SYSTEM instalado en este dispositivo.");
        } else {
          toast("No se instaló el acceso directo.");
        }
        setDeferred(null);
      } catch {
        setOpen(true);
      }
    } else {
      setOpen(true);
    }
  };

  if (installed) return null;

  const platform = detectPlatform();

  return (
    <>
      <button
        onClick={handleClick}
        title="Instala BASICO SYSTEM en este dispositivo"
        className="w-full flex items-center px-2 py-2 text-sm rounded-md hover:bg-sidebar-accent/50 text-sidebar-foreground/70 transition-colors"
      >
        <Download className="mr-3 h-4 w-4 shrink-0" />
        {!collapsed && <span>Crear acceso directo</span>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear acceso directo en este dispositivo</DialogTitle>
            <DialogDescription>
              Tu navegador no permite instalar automáticamente desde este botón. Puedes crear el acceso manualmente siguiendo estos pasos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            {platform === "ios" && (
              <Section icon={<Apple className="h-4 w-4" />} title="iPhone / iPad (Safari)">
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Toca el botón compartir de Safari.</li>
                  <li>Selecciona <b>Añadir a pantalla de inicio</b>.</li>
                  <li>Confirma el nombre <b>BASICO SYSTEM</b>.</li>
                  <li>Abre el acceso desde tu pantalla de inicio.</li>
                </ol>
              </Section>
            )}
            {platform === "android" && (
              <Section icon={<Smartphone className="h-4 w-4" />} title="Android (Chrome)">
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Abre el menú de Chrome (⋮).</li>
                  <li>Toca <b>Instalar app</b> o <b>Añadir a pantalla principal</b>.</li>
                  <li>Confirma <b>BASICO SYSTEM</b>.</li>
                </ol>
              </Section>
            )}
            {platform === "desktop" && (
              <Section icon={<Monitor className="h-4 w-4" />} title="Desktop (Chrome / Edge)">
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Busca el icono de instalar en la barra de dirección.</li>
                  <li>O abre el menú del navegador.</li>
                  <li>Selecciona <b>Instalar BASICO SYSTEM</b> y confirma.</li>
                </ol>
              </Section>
            )}
            {platform === "other" && (
              <p className="text-muted-foreground">
                Si no ves la opción, abre BASICO SYSTEM desde Chrome, Edge o Safari.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 font-semibold mb-2">{icon}{title}</div>
      {children}
    </div>
  );
}
