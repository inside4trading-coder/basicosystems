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
import {
  drawerBalance,
  type PosCashCurrency,
  type PosDrawerState,
} from "./usePosCashDrawer";

/**
 * Apertura de caja y movimientos de efectivo (añadir / retirar).
 * Todo simulado: sirve para fijar el flujo visual.
 */
export function PosCashDrawerDialog({
  open,
  onOpenChange,
  drawer,
  registerName,
  sessionCode,
  cashierName,
  rate,
  onOpenRegister,
  onCloseRegister,
  onAddCash,
  onRemoveCash,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  drawer: PosDrawerState;
  registerName: string;
  sessionCode: string;
  cashierName: string;
  rate: number;
  onOpenRegister: (p: { bs: number; ref: number; responsible: string; reason: string }) => void;
  onCloseRegister: () => void;
  onAddCash: (p: {
    currency: PosCashCurrency;
    amount: number;
    reason: string;
    responsible: string;
  }) => void;
  onRemoveCash: (p: {
    currency: PosCashCurrency;
    amount: number;
    reason: string;
    responsible: string;
  }) => void;
}) {
  const [bs, setBs] = useState("");
  const [ref, setRef] = useState("");
  const [openReason, setOpenReason] = useState("");

  const [movType, setMovType] = useState<"in" | "out">("in");
  const [movCurrency, setMovCurrency] = useState<PosCashCurrency>("VES");
  const [movAmount, setMovAmount] = useState("");
  const [movReason, setMovReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const balanceBs = drawerBalance(drawer.movements, "VES");
  const balanceRef = drawerBalance(drawer.movements, "USD");

  const submitOpen = () => {
    const nbs = Number(bs) || 0;
    const nref = Number(ref) || 0;
    if (nbs <= 0 && nref <= 0) {
      setError("Indica el efectivo inicial en Bs. o en REF.");
      return;
    }
    onOpenRegister({ bs: nbs, ref: nref, responsible: cashierName, reason: openReason.trim() });
    setBs("");
    setRef("");
    setOpenReason("");
    setError(null);
  };

  const submitMovement = () => {
    const amount = Number(movAmount) || 0;
    if (amount <= 0) return setError("Indica el monto del movimiento.");
    if (!movReason.trim()) return setError("Indica el motivo del movimiento.");
    const payload = {
      currency: movCurrency,
      amount,
      reason: movReason.trim(),
      responsible: cashierName,
    };
    if (movType === "in") onAddCash(payload);
    else onRemoveCash(payload);
    setMovAmount("");
    setMovReason("");
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
            {drawer.open ? <Unlock className="h-5 w-5 text-primary" /> : <Lock className="h-5 w-5" />}
            Caja · {registerName}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          {sessionCode} · responsable {cashierName}
          {drawer.openedAt ? ` · abierta ${drawer.openedAt}` : ""}
        </p>

        {!drawer.open ? (
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
            <div className="space-y-1.5">
              <Label>Motivo / observación</Label>
              <Input
                value={openReason}
                onChange={(e) => setOpenReason(e.target.value)}
                placeholder="Fondo inicial del turno"
              />
            </div>
            {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
            <Button className="w-full h-12 font-black" onClick={submitOpen}>
              ABRIR CAJA
            </Button>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Balance label="Saldo en efectivo Bs." value={`Bs. ${bsAmount(balanceBs, 1)}`} />
              <Balance label="Saldo en efectivo REF" value={`REF ${refAmount(balanceRef)}`} />
            </div>

            <Card className="p-4 rounded-2xl border-border/60 space-y-3">
              <p className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground">
                Movimiento de efectivo
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Toggle active={movType === "in"} onClick={() => setMovType("in")}>
                  <ArrowDownCircle className="h-4 w-4 mr-2" />
                  Añadir efectivo
                </Toggle>
                <Toggle active={movType === "out"} onClick={() => setMovType("out")}>
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                  Retirar efectivo
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
                <Label>Motivo</Label>
                <Input
                  value={movReason}
                  onChange={(e) => setMovReason(e.target.value)}
                  placeholder={movType === "in" ? "Reposición de vuelto" : "Retiro a bóveda"}
                />
              </div>
              {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
              <Button className="w-full h-11 font-black" onClick={submitMovement}>
                {movType === "in" ? "REGISTRAR ENTRADA" : "REGISTRAR RETIRO"}
              </Button>
            </Card>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground">
                Movimientos de la sesión
              </p>
              {drawer.movements.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Sin movimientos.</p>
              ) : (
                drawer.movements.map((m) => (
                  <Card
                    key={m.id}
                    className="p-3 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sm flex items-center gap-2">
                        {m.type === "opening"
                          ? "Apertura"
                          : m.type === "in"
                            ? "Entrada"
                            : "Retiro"}
                        <Badge variant="secondary">{m.currency === "VES" ? "Bs." : "REF"}</Badge>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {m.reason} · {m.responsible} · {m.at}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "num font-black tabular-nums shrink-0",
                        m.type === "out" ? "text-destructive" : "text-foreground"
                      )}
                    >
                      {m.type === "out" ? "−" : "+"}
                      {m.currency === "VES" ? `Bs. ${bsAmount(m.amount, 1)}` : `REF ${refAmount(m.amount)}`}
                    </span>
                  </Card>
                ))
              )}
            </div>

            <Button variant="outline" className="w-full" onClick={onCloseRegister}>
              <Lock className="h-4 w-4 mr-2" />
              Cerrar caja
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
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
