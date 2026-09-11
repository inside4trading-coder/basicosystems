import { useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Lock, Unlock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { bsAmount, refAmount } from "@/lib/posMoney";
import { posMethod, type PosPaymentMethodId } from "@/lib/posPaymentMethods";
import { posChannelLabel, type PosSalesChannelId } from "@/lib/posSalesChannels";
import {
  cashMovementLabel,
  type SublimeCashMovement,
  type SublimeCashSession,
  type SublimeCashSessionSummary,
} from "./useSublimeCashSession";

export type PosCashCurrency = "USD" | "VES";

/**
 * Caja real: apertura, movimientos de efectivo, resumen de sesión y cierre
 * con conteo físico. Todo se guarda en el servidor dentro de la sesión de caja.
 */
export function PosCashDrawerDialog({
  open,
  onOpenChange,
  registerName,
  cashierName,
  session,
  movements,
  summary,
  busy,
  onOpenSession,
  onMovement,
  onCloseSession,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  registerName: string;
  cashierName: string;
  session: SublimeCashSession | null;
  movements: SublimeCashMovement[];
  summary: SublimeCashSessionSummary | null;
  busy: boolean;
  onOpenSession: (p: { ref: number; bs: number; note: string }) => void;
  onMovement: (p: {
    type: "cash_in" | "cash_out";
    currency: PosCashCurrency;
    amount: number;
    note: string;
  }) => void;
  onCloseSession: (p: { countedRef: number; countedBs: number; note: string }) => void;
}) {
  const [bs, setBs] = useState("");
  const [ref, setRef] = useState("");
  const [openReason, setOpenReason] = useState("");

  const [movType, setMovType] = useState<"cash_in" | "cash_out">("cash_in");
  const [movCurrency, setMovCurrency] = useState<PosCashCurrency>("VES");
  const [movAmount, setMovAmount] = useState("");
  const [movReason, setMovReason] = useState("");

  const [closing, setClosing] = useState(false);
  const [countRef, setCountRef] = useState("");
  const [countBs, setCountBs] = useState("");
  const [closeNote, setCloseNote] = useState("");

  const [error, setError] = useState<string | null>(null);

  const expectedRef = Number(summary?.expected_ref ?? 0);
  const expectedBs = Number(summary?.expected_bs ?? 0);

  const submitOpen = () => {
    const nbs = Number(bs) || 0;
    const nref = Number(ref) || 0;
    if (nbs < 0 || nref < 0) return setError("Los montos no pueden ser negativos.");
    onOpenSession({ ref: nref, bs: nbs, note: openReason.trim() });
    setBs("");
    setRef("");
    setOpenReason("");
    setError(null);
  };

  const submitMovement = () => {
    const amount = Number(movAmount) || 0;
    if (amount <= 0) return setError("Indica el monto del movimiento.");
    if (!movReason.trim()) return setError("Indica el motivo del movimiento.");
    onMovement({ type: movType, currency: movCurrency, amount, note: movReason.trim() });
    setMovAmount("");
    setMovReason("");
    setError(null);
  };

  const submitClose = () => {
    const cref = Number(countRef) || 0;
    const cbs = Number(countBs) || 0;
    if (cref < 0 || cbs < 0) return setError("El efectivo contado no puede ser negativo.");
    onCloseSession({ countedRef: cref, countedBs: cbs, note: closeNote.trim() });
    setError(null);
    setClosing(false);
    setCountRef("");
    setCountBs("");
    setCloseNote("");
  };

  const diffRef = (Number(countRef) || 0) - expectedRef;
  const diffBs = (Number(countBs) || 0) - expectedBs;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
            {session ? <Unlock className="h-5 w-5 text-primary" /> : <Lock className="h-5 w-5" />}
            Caja · {registerName}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          {session
            ? `${session.session_number} · responsable ${session.cashier_name ?? cashierName} · abierta ${new Date(session.opened_at).toLocaleString("es-VE")}`
            : "Sin sesión abierta en esta caja."}
        </p>

        {!session ? (
          <Card className="p-4 rounded-2xl border-border/60 space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground">
              Apertura de caja
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Efectivo inicial en Bs.</Label>
                <Input
                  type="number"
                  min={0}
                  value={bs}
                  onChange={(e) => setBs(e.target.value)}
                  placeholder="0,00"
                  className="h-12 text-lg font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Efectivo inicial en REF</Label>
                <Input
                  type="number"
                  min={0}
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  placeholder="0,00"
                  className="h-12 text-lg font-bold"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Bs. y REF se llevan por separado: no se convierte una moneda en la otra.
            </p>
            <div className="space-y-1.5">
              <Label>Motivo / observación</Label>
              <Input
                value={openReason}
                onChange={(e) => setOpenReason(e.target.value)}
                placeholder="Fondo inicial del turno"
              />
            </div>
            {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
            <Button className="w-full h-12 font-black" onClick={submitOpen} disabled={busy}>
              {busy ? "ABRIENDO…" : "ABRIR CAJA"}
            </Button>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Balance label="Efectivo esperado Bs." value={`Bs. ${bsAmount(expectedBs, 1)}`} />
              <Balance label="Efectivo esperado REF" value={`REF ${refAmount(expectedRef)}`} />
            </div>

            {summary ? (
              <Card className="p-4 rounded-2xl border-border/60 space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground">
                  Resumen de la sesión
                </p>
                <Row label="Ventas realizadas" value={String(summary.sales_count)} />
                <Row label="Venta bruta" value={`REF ${refAmount(summary.gross_ref)}`} />
                <Row label="Descuentos" value={`REF ${refAmount(summary.discount_ref)}`} />
                <Row label="Total neto" value={`REF ${refAmount(summary.net_ref)}`} strong />
                {summary.by_method.length ? (
                  <>
                    <Separator className="my-2" />
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Por método de pago
                    </p>
                    {summary.by_method.map((m) => (
                      <Row
                        key={`${m.method}-${m.currency}`}
                        label={posMethod(m.method as PosPaymentMethodId).label}
                        value={
                          m.currency === "VES"
                            ? `Bs. ${bsAmount(Number(m.amount), 1)}`
                            : `REF ${refAmount(Number(m.amount))}`
                        }
                      />
                    ))}
                  </>
                ) : null}
                {summary.by_origin.length ? (
                  <>
                    <Separator className="my-2" />
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Por origen
                    </p>
                    {summary.by_origin.map((o) => (
                      <Row
                        key={o.origin}
                        label={`${posChannelLabel(o.origin as PosSalesChannelId, "")} · ${o.sales}`}
                        value={`REF ${refAmount(Number(o.total_ref))}`}
                      />
                    ))}
                  </>
                ) : null}
              </Card>
            ) : null}

            {!closing ? (
              <Card className="p-4 rounded-2xl border-border/60 space-y-3">
                <p className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground">
                  Movimiento de efectivo
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Toggle active={movType === "cash_in"} onClick={() => setMovType("cash_in")}>
                    <ArrowDownCircle className="h-4 w-4 mr-2" />
                    Entrada de efectivo
                  </Toggle>
                  <Toggle active={movType === "cash_out"} onClick={() => setMovType("cash_out")}>
                    <ArrowUpCircle className="h-4 w-4 mr-2" />
                    Retiro de efectivo
                  </Toggle>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Moneda</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["VES", "USD"] as const).map((c) => (
                        <Toggle key={c} active={movCurrency === c} onClick={() => setMovCurrency(c)}>
                          {c === "VES" ? "Bs." : "REF"}
                        </Toggle>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Monto</Label>
                    <Input
                      type="number"
                      min={0}
                      value={movAmount}
                      onChange={(e) => setMovAmount(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Motivo (obligatorio)</Label>
                  <Input
                    value={movReason}
                    onChange={(e) => setMovReason(e.target.value)}
                    placeholder={movType === "cash_in" ? "Reposición de vuelto" : "Retiro a bóveda"}
                  />
                </div>
                {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
                <Button className="w-full h-11 font-black" onClick={submitMovement} disabled={busy}>
                  {movType === "cash_in" ? "REGISTRAR ENTRADA" : "REGISTRAR RETIRO"}
                </Button>
              </Card>
            ) : (
              <Card className="p-4 rounded-2xl border-primary/40 space-y-3">
                <p className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground">
                  Cierre de caja · conteo físico
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Efectivo contado Bs.</Label>
                    <Input
                      type="number"
                      min={0}
                      value={countBs}
                      onChange={(e) => setCountBs(e.target.value)}
                      placeholder="0,00"
                      className="h-12 text-lg font-bold"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Esperado Bs. {bsAmount(expectedBs, 1)} · diferencia {diffBs >= 0 ? "+" : "−"}
                      {bsAmount(Math.abs(diffBs), 1)}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Efectivo contado REF</Label>
                    <Input
                      type="number"
                      min={0}
                      value={countRef}
                      onChange={(e) => setCountRef(e.target.value)}
                      placeholder="0,00"
                      className="h-12 text-lg font-bold"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Esperado REF {refAmount(expectedRef)} · diferencia {diffRef >= 0 ? "+" : "−"}
                      {refAmount(Math.abs(diffRef))}
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Observación del cierre</Label>
                  <Input
                    value={closeNote}
                    onChange={(e) => setCloseNote(e.target.value)}
                    placeholder="Sin novedad"
                  />
                </div>
                {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => setClosing(false)} disabled={busy}>
                    Volver
                  </Button>
                  <Button className="font-black" onClick={submitClose} disabled={busy}>
                    {busy ? "CERRANDO…" : "CONFIRMAR CIERRE"}
                  </Button>
                </div>
              </Card>
            )}

            <Separator />

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground">
                Movimientos de la sesión
              </p>
              {movements.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Sin movimientos.</p>
              ) : (
                movements.map((m) => (
                  <Card key={m.id} className="p-3 rounded-xl flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm flex items-center gap-2">
                        {cashMovementLabel(m.movement_type)}
                        <Badge variant="secondary">{m.currency === "VES" ? "Bs." : "REF"}</Badge>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {m.note ?? "Sin nota"} · {new Date(m.created_at).toLocaleString("es-VE")}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "num font-black tabular-nums shrink-0",
                        m.movement_type === "cash_out" ? "text-destructive" : "text-foreground"
                      )}
                    >
                      {m.movement_type === "cash_out" ? "−" : "+"}
                      {m.currency === "VES"
                        ? `Bs. ${bsAmount(Number(m.amount), 1)}`
                        : `REF ${refAmount(Number(m.amount))}`}
                    </span>
                  </Card>
                ))
              )}
            </div>

            {!closing ? (
              <Button variant="outline" className="w-full" onClick={() => setClosing(true)}>
                <Lock className="h-4 w-4 mr-2" />
                Cerrar caja
              </Button>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground truncate">{label}</span>
      <span className={cn("num tabular-nums", strong ? "font-black" : "font-semibold")}>{value}</span>
    </div>
  );
}

function Balance({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4 rounded-2xl border-border/60">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="num font-black text-xl tabular-nums text-foreground">{value}</p>
    </Card>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border/60 text-muted-foreground hover:border-primary/40"
      )}
    >
      {children}
    </button>
  );
}
