import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package } from "lucide-react";
import { usePendingExternalEvents } from "@/hooks/useExternalPurchaseOrders";
import { useReplenishmentPolicies } from "@/hooks/useWooCoreMap";
import { formatCurrencySafe } from "@/lib/formatCurrency";
import { ExternalOrderPreviewDialog } from "./ExternalOrderPreviewDialog";

export function ExternalPendingEventsList() {
  const { data: events = [], isLoading } = usePendingExternalEvents();
  const { data: policies = [] } = useReplenishmentPolicies();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);

  const policyByCore = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of policies) if (p.core_product_id) m.set(p.core_product_id, p);
    return m;
  }, [policies]);

  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  };
  const toggleAll = () => {
    if (selected.size === events.length) setSelected(new Set());
    else setSelected(new Set(events.map(e => e.id)));
  };

  const selectedEvents = events.filter(e => selected.has(e.id));
  const missingSupplier = selectedEvents.filter(e => {
    const p = e.core_product_id ? policyByCore.get(e.core_product_id) : null;
    return !e.external_supplier_name && !(p?.external_supplier_name);
  });

  if (isLoading) return <div className="p-4"><Loader2 className="w-4 h-4 animate-spin" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {events.length} eventos pendientes · {selected.size} seleccionados
        </div>
        <Button
          size="sm"
          disabled={selected.size === 0}
          onClick={() => setPreviewOpen(true)}
        >
          <Package className="w-4 h-4 mr-1" /> Crear orden externa
        </Button>
      </div>

      {missingSupplier.length > 0 && (
        <Card className="p-3 border-destructive/50 bg-destructive/5 text-sm">
          <b>{missingSupplier.length}</b> producto(s) sin proveedor configurado en la política.
          Este producto está marcado como proveedor externo, pero no tiene proveedor configurado.
          Puedes editar el proveedor en el preview o abrir la política del producto.
        </Card>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-2 py-2 w-8">
                <Checkbox checked={selected.size === events.length && events.length > 0} onCheckedChange={toggleAll} />
              </th>
              <th className="px-2 py-2">Producto</th>
              <th className="px-2 py-2">Variante</th>
              <th className="px-2 py-2">Proveedor</th>
              <th className="px-2 py-2 text-right">Cantidad</th>
              <th className="px-2 py-2 text-right">Costo unit.</th>
              <th className="px-2 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr><td colSpan={7} className="text-center text-muted-foreground py-6">Sin eventos pendientes.</td></tr>
            )}
            {events.map(e => {
              const policy = e.core_product_id ? policyByCore.get(e.core_product_id) : null;
              const supplier = e.external_supplier_name ?? policy?.external_supplier_name ?? "—";
              const cost = e.external_supplier_unit_cost_usd ?? e.unit_cost ?? 0;
              return (
                <tr key={e.id} className="border-t hover:bg-muted/20">
                  <td className="px-2 py-2"><Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggle(e.id)} /></td>
                  <td className="px-2 py-2">{policy?.product_name_snapshot ?? e.core_product_id ?? "—"}</td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">{e.core_variant_id ?? "—"}</td>
                  <td className="px-2 py-2">{supplier === "—" ? <Badge variant="destructive">Sin proveedor</Badge> : supplier}</td>
                  <td className="px-2 py-2 text-right">{e.quantity ?? 0}</td>
                  <td className="px-2 py-2 text-right">{formatCurrencySafe(cost, "USD", { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-2"><Badge variant="secondary">{e.status}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <ExternalOrderPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        events={selectedEvents}
        onCreated={() => { setSelected(new Set()); setPreviewOpen(false); }}
      />
    </div>
  );
}
