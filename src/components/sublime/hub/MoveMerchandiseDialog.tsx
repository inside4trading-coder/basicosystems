import { useState } from "react";
import { ArrowRight, CheckCircle2, ScanLine, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { locationName, mockLocations, mockUnits, mockVariants, productOf } from "@/lib/sublimeMock";
import { MockNotice } from "./MockNotice";

const movable = mockUnits.filter((u) => u.status === "available");

export function MoveMerchandiseDialog({
  open,
  onOpenChange,
  defaultFrom = "loc-wh",
  defaultTo = "loc-bq",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultFrom?: string;
  defaultTo?: string;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [identified, setIdentified] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const reset = () => {
    setIdentified([]);
    setDone(false);
  };

  const identify = () => {
    const pool = movable.filter((u) => u.locationId === from && !identified.includes(u.id));
    const next = pool.slice(0, 1).map((u) => u.id);
    setIdentified((prev) => [...prev, ...next]);
  };

  const describe = (unitId: string) => {
    const u = mockUnits.find((x) => x.id === unitId)!;
    const v = mockVariants.find((x) => x.id === u.variantId);
    const p = productOf(u.variantId);
    return `${p?.title ?? "Producto"} · ${v?.size ?? ""}`;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mover mercancía</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <p className="text-lg font-bold">Movimiento realizado</p>
            <p className="text-sm text-muted-foreground">
              {locationName(from)} → {locationName(to)}
            </p>
            <p className="text-sm font-semibold">{identified.length} unidades</p>
            <Button variant="outline" onClick={reset}>
              Nuevo movimiento
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <MockNotice text="Movimiento simulado: no modifica el inventario real todavía." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Origen</Label>
                <Select value={from} onValueChange={setFrom}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {mockLocations.filter((l) => l.kind !== "transit").map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Destino</Label>
                <Select value={to} onValueChange={setTo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {mockLocations.filter((l) => l.kind !== "transit" && l.id !== from).map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button variant="outline" className="w-full h-12" onClick={identify}>
              <ScanLine className="h-4 w-4 mr-2" />
              Identificar prendas
            </Button>

            <div className="space-y-2">
              {identified.map((id) => {
                const u = mockUnits.find((x) => x.id === id)!;
                return (
                  <div key={id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2">
                    <div>
                      <p className="font-mono text-sm font-semibold">{u.unitCode}</p>
                      <p className="text-xs text-muted-foreground">{describe(id)}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setIdentified((p) => p.filter((x) => x !== id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              {identified.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Todavía no hay prendas identificadas.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
              <span className="text-sm font-semibold">{identified.length} prendas identificadas</span>
              <Button disabled={identified.length === 0} onClick={() => setDone(true)}>
                Confirmar movimiento
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
