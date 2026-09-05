import { useEffect, useState } from "react";
import { Plus, Pencil, CheckCircle2, XCircle, ImageIcon, Truck, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useUnassignedItems,
  useSublimePricingRules,
  type SublimeMerchItem,
} from "@/hooks/useSublimeMerch";
import {
  calculateTotalCost,
  calculateTotalUnits,
  findPricingRule,
  formatSizeSummary,
  getFinalPvp,
  MERCH_ESTADO_LABEL,
  resolvePhotoUrl,
  type MerchEstado,
} from "@/lib/sublimeMerch";

import { ItemEditorSheet } from "./ItemEditorSheet";
import { AssignToShipmentDialog } from "./AssignToShipmentDialog";
import { BulkAssignShipmentDialog } from "./BulkAssignShipmentDialog";
import { ConsignmentBadge } from "./ConsignmentBadge";

function ItemThumb({ item, size = 40 }: { item: SublimeMerchItem; size?: number }) {
  const [src, setSrc] = useState<string>("");
  const primary = item.fotos_origen?.[0] ?? item.fotos_web?.[0] ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!primary) {
      setSrc("");
      return;
    }
    resolvePhotoUrl(primary).then((r) => {
      if (!cancelled) setSrc(r);
    });
    return () => {
      cancelled = true;
    };
  }, [primary]);
  return (
    <div
      className="rounded-md bg-muted/40 border border-border/60 overflow-hidden flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
    </div>
  );
}

function PhotoCounts({ item }: { item: SublimeMerchItem }) {
  return (
    <div className="flex gap-1 text-[10px] text-muted-foreground">
      <span>O:{item.fotos_origen?.length ?? 0}</span>
      <span>W:{item.fotos_web?.length ?? 0}</span>
    </div>
  );
}

function isAssigned(item: SublimeMerchItem) {
  return Boolean(item.shipment_id || item.box_id);
}

export function ItemsUnassignedTab() {
  const { data: items = [], isLoading } = useUnassignedItems();
  const { data: pricingRules = [] } = useSublimePricingRules();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SublimeMerchItem | null>(null);
  const [assigning, setAssigning] = useState<SublimeMerchItem | null>(null);
  const [openAssign, setOpenAssign] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openBulkAssign, setOpenBulkAssign] = useState(false);
  const isMobile = useIsMobile();
  const selectableItems = items.filter((item) => !isAssigned(item));
  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const allSelected = selectableItems.length > 0 && selectableItems.every((item) => selectedIds.includes(item.id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => selectableItems.some((item) => item.id === id)));
  }, [items]);

  const toggleItem = (item: SublimeMerchItem, checked: boolean) => {
    if (isAssigned(item)) return;
    setSelectedIds((current) => checked ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id));
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? selectableItems.map((item) => item.id) : []);
  };

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (item: SublimeMerchItem) => {
    setEditing(item);
    setOpen(true);
  };
  const openAssignFor = (item: SublimeMerchItem) => {
    setAssigning(item);
    setOpenAssign(true);
  };
  const clearSelection = () => setSelectedIds([]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {items.length} producto{items.length === 1 ? "" : "s"} sin asignar a envío
        </p>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar producto
        </Button>
      </div>

      {selectedIds.length > 0 ? (
        <div className="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-background p-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium">
            <PackageCheck className="h-4 w-4 text-primary" />
            {selectedIds.length} producto{selectedIds.length === 1 ? "" : "s"} seleccionado{selectedIds.length === 1 ? "" : "s"}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearSelection}>Limpiar</Button>
            <Button size="sm" onClick={() => setOpenBulkAssign(true)}>
              <Truck className="mr-2 h-4 w-4" />
              Asignar a envío
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Cargando…</Card>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No hay productos comprados sin asignar. Presiona <span className="font-semibold">Agregar producto</span> para comenzar.
        </Card>
      ) : isMobile ? (
        <div className="space-y-3">
          {items.map((item) => {
            const rule = findPricingRule(pricingRules, item.product_type);
            return (
              <MobileCard
                key={item.id}
                item={item}
                finalPvp={getFinalPvp(item, rule, null)}
                selected={selectedIds.includes(item.id)}
                assigned={isAssigned(item)}
                onSelect={(checked) => toggleItem(item, checked)}
                onEdit={() => openEdit(item)}
                onAssign={() => openAssignFor(item)}
              />
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      aria-label="Seleccionar todos"
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={(checked) => toggleAll(checked === true)}
                      disabled={selectableItems.length === 0}
                    />
                  </TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Cód. fabricante</TableHead>
                  <TableHead className="text-right">Precio compra</TableHead>
                  <TableHead className="text-right">Peso kg</TableHead>
                  <TableHead className="text-right">PVP tentativo</TableHead>
                  <TableHead>SKU web</TableHead>
                  <TableHead className="text-right">Costo total est.</TableHead>
                  <TableHead>Subido</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const rule = findPricingRule(pricingRules, item.product_type);
                  const finalPvp = getFinalPvp(item, rule, null);
                  const assigned = isAssigned(item);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          aria-label={`Seleccionar ${item.name}`}
                          checked={selectedIds.includes(item.id)}
                          disabled={assigned}
                          onCheckedChange={(checked) => toggleItem(item, checked === true)}
                        />
                      </TableCell>
                       <TableCell className="font-medium">
                         <div className="flex items-center gap-2">
                           <ItemThumb item={item} />
                           <div className="min-w-0">
                             <div className="flex items-center gap-2 min-w-0">
                               <div className="truncate">{item.name}</div>
                               {item.is_consignment ? <ConsignmentBadge percentage={item.consignment_commission_pct} /> : null}
                             </div>
                              <div className="text-[11px] text-muted-foreground truncate">{formatSizeSummary(item)} · {calculateTotalUnits(item)} uds</div>
                             <ProcessedAt value={item.created_at} className="text-[11px] text-muted-foreground" />
                             <PhotoCounts item={item} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{item.codigo_fabricante ?? "—"}</TableCell>
                      <TableCell className="text-right">{Number(item.precio_compra).toFixed(2)} €</TableCell>
                      <TableCell className="text-right">{Number(item.peso_kg).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span>{finalPvp == null ? "—" : `${finalPvp.toFixed(2)} €`}</span>
                          <Badge variant="outline" className="text-[9px] py-0 px-1">{item.use_manual_pvp ? "Manual" : "Sugerido"}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>{item.sku_web ?? "—"}</TableCell>
                      <TableCell className="text-right">{calculateTotalCost(item, null).toFixed(2)} €</TableCell>
                      <TableCell>{item.subido_al_sistema ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{MERCH_ESTADO_LABEL[item.estado as MerchEstado] ?? item.estado}</Badge>
                        {assigned ? <p className="mt-1 text-[10px] text-amber-600">Ya asignado</p> : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" title="Asignar a envío" onClick={() => openAssignFor(item)}><Truck className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" title="Editar producto" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <ItemEditorSheet open={open} onOpenChange={setOpen} item={editing} />
      <AssignToShipmentDialog open={openAssign} onOpenChange={setOpenAssign} item={assigning} />
      <BulkAssignShipmentDialog
        open={openBulkAssign}
        onOpenChange={setOpenBulkAssign}
        items={selectedItems}
        onAssigned={clearSelection}
      />
    </div>
  );
}

function MobileCard({
  item,
  finalPvp,
  selected,
  assigned,
  onSelect,
  onEdit,
  onAssign,
}: {
  item: SublimeMerchItem;
  finalPvp: number | null;
  selected: boolean;
  assigned: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onAssign: () => void;
}) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <Checkbox aria-label={`Seleccionar ${item.name}`} checked={selected} disabled={assigned} onCheckedChange={(checked) => onSelect(checked === true)} className="mt-1" />
          <ItemThumb item={item} size={56} />
           <div className="min-w-0">
             <div className="flex items-center gap-2 min-w-0">
               <p className="font-semibold truncate">{item.name}</p>
               {item.is_consignment ? <ConsignmentBadge percentage={item.consignment_commission_pct} /> : null}
             </div>
             <p className="text-xs text-muted-foreground">{item.codigo_fabricante ?? "sin código"} · {item.sku_web ?? "sin SKU"}</p>
             <p className="text-xs text-muted-foreground">{formatSizeSummary(item)} · {calculateTotalUnits(item)} uds</p>
             <ProcessedAt value={item.created_at} className="text-xs text-muted-foreground" />
             <PhotoCounts item={item} />
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onAssign} title="Asignar a envío"><Truck className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={onEdit} title="Editar producto"><Pencil className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div><p className="text-muted-foreground">Compra</p><p className="font-medium">{Number(item.precio_compra).toFixed(2)} €</p></div>
        <div><p className="text-muted-foreground">Peso</p><p className="font-medium">{Number(item.peso_kg).toFixed(2)} kg</p></div>
        <div><p className="text-muted-foreground">PVP tentativo</p><p className="font-medium flex items-center gap-1"><span>{finalPvp == null ? "—" : `${finalPvp.toFixed(2)} €`}</span><Badge variant="outline" className="text-[9px] py-0 px-1">{item.use_manual_pvp ? "Manual" : "Sugerido"}</Badge></p></div>
      </div>
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2"><Badge variant="secondary">{MERCH_ESTADO_LABEL[item.estado as MerchEstado] ?? item.estado}</Badge>{assigned ? <span className="text-xs text-amber-600">Ya asignado</span> : null}</div>
        {item.subido_al_sistema ? <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> subido</span> : <span className="text-xs text-muted-foreground">no subido</span>}
      </div>
    </Card>
  );
}
