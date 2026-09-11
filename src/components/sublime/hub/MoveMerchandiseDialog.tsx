import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSublimeInventory, useSublimeLocations, useTransferStock } from "@/hooks/useSublimeInventory";
import { variantDisplay } from "@/lib/sublimeInventory";

/** Traslado real de unidades entre ubicaciones oficiales. */
export function MoveMerchandiseDialog({
  open,
  onOpenChange,
  defaultFromId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultFromId?: string;
}) {
  const { data } = useSublimeInventory();
  const { data: locations = [] } = useSublimeLocations();
  const transfer = useTransferStock();

  const active = locations.filter((l) => l.is_active);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [done, setDone] = useState<{ qty: number; from: string; to: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const initialFrom = defaultFromId ?? active[0]?.id ?? "";
    setFrom(initialFrom);
    setTo(active.find((l) => l.id !== initialFrom)?.id ?? "");
    setVariantId("");
    setQty("1");
    setNote("");
    setQ("");
    setDone(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultFromId, locations.length]);

  const candidates = useMemo(() => {
    if (!from) return [];
    return (data?.rows ?? [])
      .map((r) => {
        const stock = r.stocks.find((s) => s.location_id === from);
        return {
          id: r.variant.id,
          label: `${r.product.name} · ${variantDisplay(r.variant)}`,
          sku: r.variant.sku ?? "",
          available: Number(stock?.quantity_available ?? 0),
        };
      })
      .filter((c) => c.available > 0)
      .filter((c) => q.trim() === "" || `${c.label} ${c.sku}`.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 50);
  }, [data, from, q]);

  const selected = candidates.find((c) => c.id === variantId) ?? null;
  const qtyNum = Math.floor(Number(qty) || 0);
  const maxQty = selected?.available ?? 0;
  const invalid =
    !from || !to || from === to || !variantId || qtyNum <= 0 || qtyNum > maxQty;

  const locName = (id: string) => active.find((l) => l.id === id)?.name ?? "—";

  const submit = async () => {
    try {
      await transfer.mutateAsync({ variantId, fromLocationId: from, toLocationId: to, qty: qtyNum, note });
      setDone({ qty: qtyNum, from: locName(from), to: locName(to) });
      toast.success("Traslado registrado.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo mover la mercancía.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mover mercancía</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <p className="text-lg font-bold">Movimiento realizado</p>
            <p className="text-sm text-muted-foreground">{done.from} → {done.to}</p>
            <p className="text-sm font-semibold">{done.qty} unidades</p>
            <Button variant="outline" onClick={() => setDone(null)}>Nuevo movimiento</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Origen</Label>
                <Select
                  value={from}
                  onValueChange={(v) => {
                    setFrom(v);
                    setVariantId("");
                    if (v === to) setTo(active.find((l) => l.id !== v)?.id ?? "");
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Ubicación" /></SelectTrigger>
                  <SelectContent>
                    {active.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Destino</Label>
                <Select value={to} onValueChange={setTo}>
                  <SelectTrigger><SelectValue placeholder="Ubicación" /></SelectTrigger>
                  <SelectContent>
                    {active.filter((l) => l.id !== from).map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Buscar prenda</Label>
              <Input placeholder="Producto o SKU…" value={q} onChange={(e) => setQ(e.target.value)} />
              <Select value={variantId} onValueChange={setVariantId}>
                <SelectTrigger><SelectValue placeholder="Selecciona la variante" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label} {c.sku ? `· ${c.sku}` : ""} · {c.available} disp.
                    </SelectItem>
                  ))}
                  {candidates.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Sin existencias disponibles en origen.</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Cantidad {selected ? `(máx. ${maxQty})` : ""}</Label>
              <Input
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Nota (opcional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-3">
              <Button disabled={invalid || transfer.isPending} onClick={submit}>
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
