import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Package } from "lucide-react";
import { usePendingExternalEvents, type PendingExternalEvent } from "@/hooks/useExternalPurchaseOrders";
import { useReplenishmentPolicies } from "@/hooks/useWooCoreMap";
import { formatCurrencySafe } from "@/lib/formatCurrency";
import { ExternalOrderPreviewDialog } from "./ExternalOrderPreviewDialog";

export function ExternalPendingEventsList() {
  const { data: rows = [], isLoading } = usePendingExternalEvents();
  const { data: policies = [] } = useReplenishmentPolicies();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);

  const policyByCore = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of policies) if (p.core_product_id) m.set(p.core_product_id, p);
    return m;
  }, [policies]);

  const selectableIds = useMemo(
    () => rows.filter(r => !!r.event_id).map(r => r.event_id as string),
    [rows],
  );

  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  };
  const toggleAll = () => {
    if (selected.size === selectableIds.length) setSelected(new Set());
    else setSelected(new Set(selectableIds));
  };

  const selectedEvents = rows
    .filter(r => r.event_id && selected.has(r.event_id))
    .map(r => ({ ...r, id: r.event_id as string })) as unknown as PendingExternalEvent[];

  const missingSupplier = rows.filter(r => {
    if (!r.event_id || !selected.has(r.event_id)) return false;
    const p = r.core_product_id ? policyByCore.get(r.core_product_id) : null;
    return !r.external_supplier_name && !(p?.external_supplier_name);
  });

  if (isLoading) return <div className="p-4"><Loader2 className="w-4 h-4 animate-spin" /></div>;

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {rows.length} prenda(s) pendiente(s) de compra · {selected.size} seleccionada(s)
          </div>
          <Button size="sm" disabled={selected.size === 0} onClick={() => setPreviewOpen(true)}>
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
                  <Checkbox
                    checked={selectableIds.length > 0 && selected.size === selectableIds.length}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="px-2 py-2">Producto</th>
                <th className="px-2 py-2">Variante/talla</th>
                <th className="px-2 py-2">Proveedor</th>
                <th className="px-2 py-2 text-right">Cantidad</th>
                <th className="px-2 py-2 text-right">Costo unit.</th>
                <th className="px-2 py-2">Pedido / ítem</th>
                <th className="px-2 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className="text-center text-muted-foreground py-6">Sin pendientes de compra.</td></tr>
              )}
              {rows.map(r => {
                const policy = r.core_product_id ? policyByCore.get(r.core_product_id) : null;
                const supplier = r.external_supplier_name ?? policy?.external_supplier_name ?? "—";
                const cost = r.external_supplier_unit_cost_usd ?? r.unit_cost ?? 0;
                const name = r.product_name ?? policy?.product_name_snapshot ?? "—";
                return (
                  <tr key={r.movement_id} className="border-t hover:bg-muted/20">
                    <td className="px-2 py-2">
                      {r.event_id ? (
                        <Checkbox checked={selected.has(r.event_id)} onCheckedChange={() => toggle(r.event_id as string)} />
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex"><Checkbox disabled /></span>
                          </TooltipTrigger>
                          <TooltipContent>
                            No se puede crear orden externa porque falta evento external_supplier_review.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-medium">{name}</div>
                      {r.sku && <div className="text-xs text-muted-foreground">{r.sku}</div>}
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">{r.variant_label ?? "—"}</td>
                    <td className="px-2 py-2">{supplier === "—" ? <Badge variant="destructive">Sin proveedor</Badge> : supplier}</td>
                    <td className="px-2 py-2 text-right">{r.quantity ?? 0}</td>
                    <td className="px-2 py-2 text-right">{formatCurrencySafe(cost, "USD", { minimumFractionDigits: 2 })}</td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">
                      {r.source_order_id ?? "—"}{r.source_order_item_id ? ` / ${r.source_order_item_id}` : ""}
                    </td>
                    <td className="px-2 py-2">
                      {r.event_id
                        ? <Badge variant="secondary">Pendiente de compra</Badge>
                        : <Badge variant="outline">Sin evento</Badge>}
                    </td>
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
    </TooltipProvider>
  );
}
