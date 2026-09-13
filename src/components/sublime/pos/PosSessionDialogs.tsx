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
import { Button } from "@/components/ui/button";
import {
  SUSPENDED_STATUS_LABEL,
  type SuspendedCart,
} from "./useSublimeSuspendedCarts";
import { posChannelLabel } from "@/lib/posSalesChannels";

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

/** Cambiar caja: cada caja tiene su sesión real y su carrito activo independiente. */
export function PosRegisterDialog({
  open,
  onOpenChange,
  registers,
  currentRegisterId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  registers: { id: string; name: string }[];
  currentRegisterId: string | null;
  onSelect: (registerId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar caja</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Cada caja mantiene su propia sesión, su efectivo y su carrito. El inventario es de la
          sede y se comparte.
        </p>
        <div className="space-y-2">
          {registers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay cajas configuradas en esta sede.
            </p>
          ) : (
            registers.map((r) => (
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
              </button>
            ))
          )}
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

/** Carritos suspendidos REALES: persisten en el servidor, recuperables siempre. */
export function PosSuspendedDialog({
  open,
  onOpenChange,
  carts,
  rate,
  loading,
  busy,
  onResume,
  onCancelCart,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  carts: SuspendedCart[];
  rate: number;
  loading?: boolean;
  busy?: boolean;
  onResume: (cart: SuspendedCart) => void;
  onCancelCart: (cart: SuspendedCart) => void;
}) {
  const openCarts = carts.filter((c) => c.status === "open" || c.status === "recovered");
  const history = carts.filter((c) => c.status === "cancelled" || c.status === "converted_to_sale");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Carritos suspendidos</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Cargando…</p>
        ) : openCarts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No hay carritos suspendidos.
          </p>
        ) : (
          <div className="space-y-2">
            {openCarts.map((c) => (
              <Card key={c.id} className="p-3 rounded-xl space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm flex items-center gap-2 flex-wrap">
                      {c.cart_number}
                      <Badge variant="secondary">{c.register_code ?? "Sin caja"}</Badge>
                      <Badge variant="outline">{SUSPENDED_STATUS_LABEL[c.status]}</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.cashier_code ?? "Sin cajero"} · {c.customer_name ?? "Sin cliente"} ·{" "}
                      {new Date(c.suspended_at).toLocaleString("es-VE")}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.units} artículo(s) ·{" "}
                      {c.sale_origin ? posChannelLabel(c.sale_origin as any, c.origin_detail ?? "") : "Sin origen"} ·
                      sesión {c.origin_session_code ?? "—"}
                    </p>
                  </div>
                  <Money value={c.total_ref} rate={rate} size="sm" />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => onCancelCart(c)}
                    className="text-destructive"
                  >
                    Cancelar carrito
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => onResume(c)}>
                    Recuperar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {history.length > 0 ? (
          <div className="pt-2">
            <Section title="Histórico">
              <div className="space-y-1.5">
                {history.slice(0, 20).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                  >
                    <span className="truncate">
                      {c.cart_number} · {new Date(c.suspended_at).toLocaleString("es-VE")} ·{" "}
                      {SUSPENDED_STATUS_LABEL[c.status]}
                    </span>
                    <Money value={c.total_ref} rate={rate} size="xs" />
                  </div>
                ))}
              </div>
            </Section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
