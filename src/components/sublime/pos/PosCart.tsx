import { Minus, Plus, ShoppingCart, Trash2, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Shirt } from "lucide-react";
import { usdFormat, variantLabel } from "@/lib/sublimeMock";
import { POS_TAX_PCT, type PosCartLine } from "./usePosCart";

export function PosCart({
  lines,
  units,
  subtotal,
  discountUsd,
  setDiscountUsd,
  taxEnabled,
  setTaxEnabled,
  taxUsd,
  total,
  rate,
  customerName,
  onPickCustomer,
  onClearCustomer,
  onChangeQty,
  onRemove,
  onCheckout,
}: {
  lines: PosCartLine[];
  units: number;
  subtotal: number;
  discountUsd: number;
  setDiscountUsd: (n: number) => void;
  taxEnabled: boolean;
  setTaxEnabled: (v: boolean) => void;
  taxUsd: number;
  total: number;
  rate: number;
  customerName: string | null;
  onPickCustomer: () => void;
  onClearCustomer: () => void;
  onChangeQty: (variantId: string, delta: number) => void;
  onRemove: (variantId: string) => void;
  onCheckout: () => void;
}) {
  return (
    <aside className="flex flex-col min-h-0 h-full border-l border-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <h2 className="font-black tracking-tight text-foreground">Carrito</h2>
        </div>
        <Badge variant="secondary">{units} und.</Badge>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {lines.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">
            Añade productos desde el catálogo.
          </p>
        )}
        {lines.map((l) => (
          <div key={l.variant.id} className="flex gap-3 rounded-xl border border-border/60 p-2">
            <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Shirt className="h-5 w-5 text-muted-foreground/60" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
                  {l.product.title}
                </p>
                <button
                  type="button"
                  onClick={() => onRemove(l.variant.id)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  aria-label="Eliminar línea"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{variantLabel(l.variant)}</p>
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => onChangeQty(l.variant.id, -1)}
                    aria-label="Restar"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="num w-7 text-center text-sm font-bold tabular-nums">{l.qty}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => onChangeQty(l.variant.id, 1)}
                    aria-label="Sumar"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="text-right leading-tight">
                  <p className="text-[11px] text-muted-foreground">{usdFormat(l.variant.pvp)} c/u</p>
                  <p className="num text-sm font-black tabular-nums">{usdFormat(l.lineTotal)}</p>
                </div>
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

        <Row label="Subtotal" value={usdFormat(subtotal)} />
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Descuento</span>
          <Input
            type="number"
            min={0}
            value={discountUsd || ""}
            onChange={(e) => setDiscountUsd(Number(e.target.value) || 0)}
            placeholder="0"
            className="h-8 w-24 text-right"
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => setTaxEnabled(!taxEnabled)}
            className="text-muted-foreground underline-offset-2 hover:underline"
          >
            Impuesto {POS_TAX_PCT}% {taxEnabled ? "(aplicado)" : "(no aplica)"}
          </button>
          <span className="num tabular-nums">{usdFormat(taxUsd)}</span>
        </div>

        <Separator />

        <div className="flex items-end justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span>
          <div className="text-right">
            <p className="num text-3xl font-black tabular-nums text-foreground leading-none">
              {usdFormat(total)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Bs. {(total * rate).toLocaleString("es-VE", { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <Button size="lg" className="w-full h-14 text-base font-black" disabled={lines.length === 0} onClick={onCheckout}>
          COBRAR
        </Button>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="num tabular-nums">{value}</span>
    </div>
  );
}
