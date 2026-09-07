import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Money } from "@/lib/posMoney";
import {
  POS_CASHIERS,
  POS_REGISTERS,
  POS_SHIFTS,
  POS_STORE,
  posSessionOf,
} from "@/lib/posSession";
import type { PosSuspendedCart } from "./usePosCart";

/** Cambiar cajero: la caja y su sesión no cambian. */
export function PosCashierDialog({
  open,
  onOpenChange,
  currentCashierId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentCashierId: string;
  onSelect: (cashierId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar cajero</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Cambiar de cajero no cambia de caja: el carrito activo pertenece a la caja.
        </p>
        <div className="space-y-2">
          {POS_CASHIERS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "w-full rounded-xl border p-3 text-left transition-colors",
                c.id === currentCashierId
                  ? "border-primary bg-primary/10"
                  : "border-border/60 hover:border-primary/40"
              )}
            >
              <p className="font-bold text-foreground">{c.name}</p>
              <p className="text-xs text-muted-foreground">{POS_STORE.name}</p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Cambiar caja: cada caja tiene su sesión y su carrito activo independiente. */
export function PosRegisterDialog({
  open,
  onOpenChange,
  currentRegisterId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentRegisterId: string;
  onSelect: (registerId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar caja</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Cada caja mantiene su propio carrito activo. El inventario es de la sede y se comparte.
        </p>
        <div className="space-y-2">
          {POS_REGISTERS.map((r) => {
            const s = posSessionOf(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelect(r.id)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors",
                  r.id === currentRegisterId
                    ? "border-primary bg-primary/10"
                    : "border-border/60 hover:border-primary/40"
                )}
              >
                <p className="font-bold text-foreground">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.code} · abierta {s.openedAt}
                </p>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Cierres separados: turno de cajero, sesión de caja y cierre diario. */
export function PosClosuresDialog({
  open,
  onOpenChange,
  rate,
  date,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rate: number;
  date: string;
}) {
  const byRegister = POS_REGISTERS.map((r) => {
    const shifts = POS_SHIFTS.filter((s) => s.registerName === r.name);
    return { register: r, shifts, totalRef: shifts.reduce((a, s) => a + s.totalRef, 0) };
  });
  const dayTotal = POS_SHIFTS.reduce((a, s) => a + s.totalRef, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cierres</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Filtros previstos: sede · caja · sesión · cajero · fecha. Vista de referencia, sin cálculo real.
        </p>

        <Section title="Cierre de cajero / turno">
          {POS_SHIFTS.map((s) => (
            <Card key={`${s.cashierName}-${s.from}`} className="p-3 rounded-xl flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-sm">{s.cashierName}</p>
                <p className="text-xs text-muted-foreground">
                  {s.registerName} · {s.from}–{s.to} · {s.salesCount} ventas
                </p>
              </div>
              <Money value={s.totalRef} rate={rate} size="sm" />
            </Card>
          ))}
        </Section>

        <Section title="Cierre de caja / sesión">
          {byRegister.map(({ register, shifts, totalRef }) => (
            <Card key={register.id} className="p-3 rounded-xl flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-sm">
                  {register.name} · {posSessionOf(register.id).code}
                </p>
                <p className="text-xs text-muted-foreground">{shifts.length} turnos</p>
              </div>
              <Money value={totalRef} rate={rate} size="sm" />
            </Card>
          ))}
        </Section>

        <Section title="Cierre diario de tienda">
          <Card className="p-4 rounded-xl flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-sm">{POS_STORE.name}</p>
              <p className="text-xs text-muted-foreground">{date} · consolidado</p>
            </div>
            <Money value={dayTotal} rate={rate} size="lg" />
          </Card>
        </Section>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

/** Carritos suspendidos, recuperables por caja. */
export function PosSuspendedDialog({
  open,
  onOpenChange,
  carts,
  rate,
  onResume,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  carts: PosSuspendedCart[];
  rate: number;
  onResume: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Carritos suspendidos</DialogTitle>
        </DialogHeader>
        {carts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No hay carritos suspendidos.
          </p>
        ) : (
          <div className="space-y-2">
            {carts.map((c) => (
              <Card key={c.id} className="p-3 rounded-xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm flex items-center gap-2">
                    {c.id}
                    <Badge variant="secondary">{c.registerName}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.cashierName} · {c.customerName ?? "Sin cliente"} · {c.at}
                  </p>
                </div>
                <Money value={c.totalRef} rate={rate} size="sm" />
                <button
                  type="button"
                  onClick={() => onResume(c.id)}
                  className="text-xs font-bold text-primary hover:underline shrink-0"
                >
                  Recuperar
                </button>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
