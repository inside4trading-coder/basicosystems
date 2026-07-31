import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Keyboard } from "lucide-react";
import { useCameraTapFocus } from "@/hooks/useCameraTapFocus";
import { FocusRing } from "@/components/core/CameraFocusRing";
import { useCameraControls, startScannerWithFallback } from "@/hooks/useCameraControls";

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function MobileQrScanner({ open, onClose, onDetected }: Props) {
  const cameraDivRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const { ring, handleTapFocus, enableContinuousFocus, unsupportedMsg } = useCameraTapFocus();
  const cam = useCameraControls();
  const [camDeviceId, setCamDeviceId] = useState<string | null>(null);
  const [streamActive, setStreamActive] = useState(false);

  useEffect(() => {
    if (!open || manual) return;
    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled || !cameraDivRef.current) return;
        const scanner = new Html5Qrcode(cameraDivRef.current.id);
        scannerRef.current = scanner;
        await startScannerWithFallback(
          scanner,
          camDeviceId,
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded: string) => {
            const t = (decoded || "").trim();
            if (!t) return;
            const s = scannerRef.current;
            scannerRef.current = null;
            if (s) s.stop().then(() => { try { s.clear?.(); } catch { /* noop */ } }).catch(() => {});
            onDetected(t);
          },
        );
        if (!cancelled) setStreamActive(true);
        setTimeout(() => {
          void enableContinuousFocus(cameraDivRef.current);
          void cam.probeCapabilities(cameraDivRef.current);
          if (cam.nearMode) void cam.applyNearMode(cameraDivRef.current, true);
        }, 600);
      } catch (e: any) {
        console.error("[scanner] start failed", e?.name, e?.message ?? e);
        setStreamActive(false);
        setError("No se pudo iniciar la cámara. Revisa permisos o prueba cambiar cámara.");
      }
    })();


    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop().then(() => { try { s.clear?.(); } catch { /* noop */ } }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, manual, camDeviceId]);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const t = manualCode.trim();
    if (!t) return;
    setManualCode("");
    setManual(false);
    onDetected(t);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-full sm:max-w-md p-0 gap-0 h-[100dvh] sm:h-auto sm:rounded-2xl">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span>Escanear código</span>
            <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 flex flex-col">
          {!manual ? (
            <>
              <div
                className="relative w-full"
                onClick={(e) => handleTapFocus(e, cameraDivRef.current)}
                onTouchStart={(e) => handleTapFocus(e, cameraDivRef.current)}
              >
                <div
                  id="mobile-qr-scanner-region"
                  ref={cameraDivRef}
                  className="bg-black w-full aspect-square sm:aspect-video"
                />
                {ring && <FocusRing key={ring.id} x={ring.x} y={ring.y} />}
              </div>
              {error && (
                <div className="p-3 text-xs text-destructive bg-destructive/10">{error}</div>
              )}
              <div className="flex flex-wrap gap-2 justify-center px-4 pt-3">
                <Button
                  size="sm"
                  variant={cam.nearMode ? "default" : "outline"}
                  onClick={() => void cam.applyNearMode(cameraDivRef.current, !cam.nearMode)}
                >
                  Modo QR cercano
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const id = await cam.nextDeviceId();
                    if (id) { cam.resetTorch(); setCamDeviceId(id); }
                  }}
                >
                  Cambiar cámara
                </Button>
                {cam.torchSupported && (
                  <Button size="sm" variant={cam.torchOn ? "default" : "outline"} onClick={() => void cam.toggleTorch(cameraDivRef.current)}>
                    Luz
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center px-4 py-2">
                Apunta al QR o código de barras. Toca la imagen para enfocar.
                <br />Para QR pequeños: activa Modo QR cercano y aleja un poco la etiqueta.
              </p>
              {unsupportedMsg && (
                <p className="text-[11px] text-muted-foreground text-center px-4 pb-2">{unsupportedMsg}</p>
              )}
              <div className="p-4 grid grid-cols-2 gap-2 border-t">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button variant="secondary" onClick={() => setManual(true)}>
                  <Keyboard className="h-4 w-4 mr-1" />Ingresar manual
                </Button>
              </div>
            </>
          ) : (
            <form onSubmit={submitManual} className="p-4 space-y-3">
              <label className="text-xs font-medium">Código manual</label>
              <Input autoFocus value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="scan_code / SKU / barcode" />
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setManual(false)}>Volver a cámara</Button>
                <Button type="submit">Buscar</Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
