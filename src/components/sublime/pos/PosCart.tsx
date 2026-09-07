import { Minus, Plus, ShoppingCart, Sparkles, StickyNote, Trash2, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Shirt } from "lucide-react";
import { Money } from "@/lib/posMoney";
import { POS_TAX_PCT, type PosCartApi } from "./usePosCart";

export function PosCart({
  cart,
  rate,
  customerName,
  onPickCustomer,
  onClearCustomer,
  onCheckout,
  onEditNote,
}: {
  cart: PosCartApi;
  rate: number;
  customerName: string | null;
  onPickCustomer: () => void;
  onClearCustomer: () => void;
  onCheckout: () => void;
  onEditNote: () => void;
}) {
  const { lines } = cart;

  return (
    <aside className="flex flex-col min-h-0 h-full border-l border-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <h2 className="font-black tracking-tight text-foreground">Carrito</h2>
        </div>
        <Badge variant="secondary">{cart.units} und.</Badge>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {lines.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">
            Añade productos desde el catálogo.
          </p>
        )}
        {lines.map((l) => (
          <div key={l.key} className="flex gap-3 rounded-xl border border-border/60 p-2">
            <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {l.kind === "manual" ? (
                <Sparkles className="h-5 w-5 text-muted-foreground/60" />
              ) : (
                <Shirt className="h-5 w-5 text-muted-foreground/60" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
                  {l.title}
                </p>
                <button
                  type="button"
                  onClick={() => cart.remove(l.key)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  aria-label="Eliminar línea"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{l.subtitle}</p>

              {l.unitDiscount > 0 ? (
                <div className="mt-1 flex items-end gap-3 flex-wrap">
                  <LabelledPrice label="Precio full">
                    <Money value={l.regularPrice} rate={rate} size="xs" align="left" strike />
                  </LabelledPrice>
                  <LabelledPrice label="Precio actual">
                    <Money value={l.finalPrice} rate={rate} size="xs" align="left" tone="primary" />
                  </LabelledPrice>
                  <Badge className="text-[10px]">-{l.discountPct}%</Badge>
                </div>
              ) : (
                <div className="mt-1">
                  <Money value={l.finalPrice} rate={rate} size="xs" align="left" />
                </div>
              )}

              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => cart.changeQty(l.key, -1)}
                    aria-label="Restar"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="num w-7 text-center text-sm font-bold tabular-nums">{l.qty}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => cart.changeQty(l.key, 1)}
                    aria-label="Sumar"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Money value={l.lineTotal} rate={rate} size="sm" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          {customerName ? (
            <div className="flex items-center gap-2 min-w-0">
              <UserRound className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold truncate">{customerName}</span>
              <button type="button" onClick={onClearCustomer} aria-label="Quitar cliente">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Venta sin cliente</span>
          )}
          <Button variant="outline" size="sm" onClick={onPickCustomer}>
            {customerName ? "Cambiar" : "Seleccionar"}
          </Button>
        </div>

        <Separator />

        <SummaryRow label="Subtotal regular">
          <Money value={cart.subtotalRegular} rate={rate} size="xs" />
        </SummaryRow>

        {cart.discountTotal > 0 ? (
          <SummaryRow label="Descuentos">
            <Money value={cart.discountTotal} rate={rate} size="xs" sign="-" tone="destructive" />
          </SummaryRow>
        ) : null}

        <div className="flex items-center justify-between text-sm gap-2">
          <span className="text-muted-foreground">Descuento de carrito (REF)</span>
          <Input
            type="number"
            min={0}
            value={cart.cartDiscount || ""}
            onChange={(e) => cart.setCartDiscount(Number(e.target.value) || 0)}
            placeholder="0"
            className="h-8 w-24 text-right"
            aria-label="Descuento de carrito en REF"
          />
        </div>
        {cart.cartDiscount > 0 ? (
          <Input
            value={cart.cartDiscountReason}
            onChange={(e) => cart.setCartDiscountReason(e.target.value)}
            placeholder="Motivo del descuento (auditoría)"
            className="h-8 text-xs"
          />
        ) : null}

        <button
          type="button"
          onClick={onEditNote}
          className="w-full flex items-start gap-2 rounded-xl border border-border/60 p-2 text-left hover:border-primary/40 transition-colors"
        >
          <StickyNote className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span className="text-xs text-muted-foreground line-clamp-2">
            {cart.note || "Añadir nota al pedido"}
          </span>
        </button>

        <Separator />

        <div className="flex items-end justify-between">
          <div className="leading-tight">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span>
            <p className="text-[10px] text-muted-foreground">
              IVA {POS_TAX_PCT}% incluido en el precio
            </p>
          </div>
          <Money value={cart.total} rate={rate} size="lg" />
        </div>

        <Button
          size="lg"
          className="w-full h-14 text-base font-black"
          disabled={lines.length === 0}
          onClick={onCheckout}
        >
          COBRAR
        </Button>
      </div>
    </aside>
  );
}

function LabelledPrice({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="leading-tight">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
