import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AlertCircle, Camera, CheckCircle2, Loader2, X } from "lucide-react";
import {
  extractUnitToken,
  formatAmount,
  portalApi,
  type PortalProcess,
  type PortalUnit,
} from "@/lib/operatorPortal";

interface Props {
  open: boolean;
  token: string;
  amountsVisible: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered: (msg: string) => void;
  onSessionExpired: () => void;
}

export function OperatorScanSheet({
  open,
  token,
  amountsVisible,
  onOpenChange,
  onRegistered,
  onSessionExpired,
}: Props) {
  const [manual, setManual] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<PortalUnit | null>(null);
  const [processes, setProcesses] = useState<PortalProcess[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const cameraDivRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    if (!open) {
      setManual("");
      setUnit(null);
      setProcesses([]);
      setSelected(null);
      setError(null);
      setCameraOpen(false);
      setCode("");
    }
  }, [open]);

  useEffect(() => {
    if (!cameraOpen) return;
    let cancelled = false;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled || !cameraDivRef.current) return;
      const scanner = new Html5Qrcode(cameraDivRef.current.id);
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded: string) => {
            setCameraOpen(false);
            void lookup(extractUnitToken(decoded));
          },
          () => {},
        );
      } catch (e: any) {
        setError(e?.message || "No se pudo abrir la cámara");
        setCameraOpen(false);
      }
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().catch(() => {}).finally(() => s.clear?.());
        scannerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen]);

  async function lookup(raw: string) {
    const value = extractUnitToken(raw);
    if (!value) return;
    setLoading(true);
    setError(null);
    setUnit(null);
    setProcesses([]);
    setSelected(null);
    const res = await portalApi.lookupUnit(token, value);
    setLoading(false);
    if (!res.ok) {
      if (res.error === "Sesión expirada") return onSessionExpired();
      setError(res.error ?? "No se pudo leer la prenda");
      return;
    }
    setCode(value);
    setUnit(res.unit);
    setProcesses(res.processes);
    const available = res.processes.filter((p) => !p.blocked_reason);
    if (available.length === 1) setSelected(available[0].id);
  }

  async function register() {
    if (!selected) return;
    setRegistering(true);
    setError(null);
    const res = await portalApi.registerProcess(token, code, selected);
    setRegistering(false);
    if (!res.ok) {
      if (res.error === "Sesión expirada") return onSessionExpired();
      setError(res.error ?? "No se pudo registrar");
      return;
    }
    onRegistered(
      `${res.registered.process_name ?? "Proceso"} registrado en ${res.registered.unit_code}` +
        (res.registered.missing_rate ? " (sin tarifa, se revisará en nómina)" : ""),
    );
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Escanear prenda</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {!unit && (
            <>
              {cameraOpen ? (
                <div className="space-y-2">
                  <div id="operator-qr-camera" ref={cameraDivRef} className="w-full overflow-hidden rounded-lg border" />
                  <Button variant="outline" className="w-full" onClick={() => setCameraOpen(false)}>
                    <X className="mr-1 h-4 w-4" /> Cerrar cámara
                  </Button>
                </div>
              ) : (
                <Button size="lg" className="h-14 w-full text-lg" onClick={() => setCameraOpen(true)}>
                  <Camera className="mr-2 h-6 w-6" /> Abrir cámara
                </Button>
              )}

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">O escribe el código de la prenda</p>
                <div className="flex gap-2">
                  <Input
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && lookup(manual)}
                    placeholder="OP-000009-WOO-4077-M-001"
                    className="h-12"
                  />
                  <Button className="h-12" onClick={() => lookup(manual)} disabled={loading || !manual.trim()}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                  </Button>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {unit && (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="text-lg font-bold">{unit.product_name ?? unit.unit_code}</div>
                <div className="text-sm text-muted-foreground">
                  {[unit.variant, unit.order_code].filter(Boolean).join(" · ")}
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">{unit.unit_code}</div>
              </Card>

              <div className="space-y-2">
                <p className="text-sm font-medium">Selecciona el proceso</p>
                {processes.map((p) => {
                  const disabled = !!p.blocked_reason;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => setSelected(p.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
                        selected === p.id ? "border-primary bg-accent" : "bg-card"
                      } ${disabled ? "opacity-50" : "hover:bg-accent"}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.process_name ?? p.process_type}</div>
                        {p.blocked_reason ? (
                          <div className="text-xs text-muted-foreground">{p.blocked_reason}</div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            {p.adds_to_payroll ? `Suma a nómina · ${formatAmount(p.amount, amountsVisible)}` : "No suma a nómina"}
                          </div>
                        )}
                      </div>
                      {p.status === "completed" ? (
                        <Badge variant="secondary" className="shrink-0">
                          Completado
                        </Badge>
                      ) : selected === p.id ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-12 flex-1"
                  onClick={() => {
                    setUnit(null);
                    setProcesses([]);
                    setSelected(null);
                    setManual("");
                  }}
                >
                  Otra prenda
                </Button>
                <Button className="h-12 flex-1" onClick={register} disabled={!selected || registering}>
                  {registering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Registrar proceso
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
