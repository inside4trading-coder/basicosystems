import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Keyboard } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function MobileQrScanner({ open, onClose, onDetected }: Props) {
  const containerId = "mobile-qr-scanner-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    if (!open || manual) return;
    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const scanner = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decoded) => {
            if (cancelled) return;
            handleDetected(decoded);
          },
          () => { /* per-frame errors ignored */ }
        );
      } catch (e: any) {
        setError(e?.message || "No se pudo abrir la cámara. Revisa los permisos.");
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop().then(() => { try { s.clear(); } catch { /* noop */ } }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, manual]);

  const handleDetected = (text: string) => {
    const t = text.trim();
    if (!t) return;
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) s.stop().catch(() => {}).finally(() => s.clear().catch(() => {}));
    onDetected(t);
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDetected(manualCode.trim());
    setManualCode("");
    setManual(false);
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
              <div id={containerId} className="bg-black w-full aspect-square sm:aspect-video" />
              {error && (
                <div className="p-3 text-xs text-destructive bg-destructive/10">{error}</div>
              )}
              <p className="text-xs text-muted-foreground text-center px-4 py-2">
                Apunta al QR o código de barras.
              </p>
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
