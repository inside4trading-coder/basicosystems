import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { bsFormat, refFormat } from "@/lib/posMoney";
import type { PosManualKind } from "./usePosCart";

const KINDS: { id: PosManualKind; label: string }[] = [
  { id: "producto", label: "Producto" },
  { id: "servicio", label: "Servicio" },
  { id: "extra", label: "Extra" },
];

/** Agregar un concepto que no viene del inventario. Precio con IVA incluido. */
export function PosManualItemDialog({
  open,
  onOpenChange,
  rate,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rate: number;
  onAdd: (item: { name: string; kind: PosManualKind; priceRef: number; qty: number }) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PosManualKind>("producto");
  const [currency, setCurrency] = useState<"VES" | "USD">("VES");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const value = Number(price) || 0;
  const priceRef = currency === "VES" ? value / rate : value;

  const reset = () => {
    setName("");
    setKind("producto");
    setCurrency("VES");
    setPrice("");
    setQty("1");
    setError(null);
  };

  const submit = () => {
    if (!name.trim()) return setError("Indica el nombre del concepto.");
    if (priceRef <= 0) return setError("Indica un precio válido.");
    const q = Math.max(1, Number(qty) || 1);
    onAdd({ name: name.trim(), kind, priceRef, qty: q });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar producto / servicio / extra</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Estampado personalizado"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                    kind === k.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Precio (IVA incluido)</Label>
              <Input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Moneda</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["VES", "USD"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={cn(
                      "rounded-xl border px-2 py-2 text-sm font-bold transition-colors",
                      currency === c
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/60 text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {c === "VES" ? "Bs." : "REF"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Cantidad</Label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>

          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Equivalencia</p>
            <p className="num font-black text-foreground">{bsFormat(priceRef, rate)}</p>
            <p className="num text-[11px] uppercase tracking-wider text-muted-foreground">
              {refFormat(priceRef)}
            </p>
          </div>

          {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}

          <Button className="w-full h-12 font-black" onClick={submit}>
            AGREGAR AL CARRITO
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
