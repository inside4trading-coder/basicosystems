import { useEffect, useState } from "react";
import { Plus, Pencil, CheckCircle2, XCircle, ImageIcon, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      )}
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

export function ItemsUnassignedTab() {
  const { data: items = [], isLoading } = useUnassignedItems();
  const { data: pricingRules = [] } = useSublimePricingRules();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SublimeMerchItem | null>(null);
  const [assigning, setAssigning] = useState<SublimeMerchItem | null>(null);
  const [openAssign, setOpenAssign] = useState(false);
  const isMobile = useIsMobile();

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (i: SublimeMerchItem) => {
    setEditing(i);
    setOpen(true);
  };
  const openAssignFor = (i: SublimeMerchItem) => {
    setAssigning(i);
    setOpenAssign(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {items.length} producto{items.length === 1 ? "" : "s"} sin asignar a envío
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar producto
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Cargando…
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No hay productos comprados sin asignar. Presiona{" "}
          <span className="font-semibold">Agregar producto</span> para comenzar.
        </Card>
      ) : isMobile ? (
        <div className="space-y-3">
          {items.map((i) => {
            const rule = findPricingRule(pricingRules, i.product_type);
            const finalPvp = getFinalPvp(i, rule, null);
            return (
              <MobileCard
                key={i.id}
                item={i}
                finalPvp={finalPvp}
                onEdit={() => openEdit(i)}
                onAssign={() => openAssignFor(i)}
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
                  <TableHead>Nombre</TableHead>
                  <TableHead>Cód. fabricante</TableHead>
                  <TableHead className="text-right">Precio compra</TableHead>
                  <TableHead className="text-right">Peso kg</TableHead>
                  <TableHead className="text-right">PVP</TableHead>
                  <TableHead>SKU web</TableHead>
                  <TableHead className="text-right">Costo total est.</TableHead>
                  <TableHead>Subido</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <ItemThumb item={i} />
                        <div className="min-w-0">
                          <div className="truncate">{i.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {formatSizeSummary(i)} · {calculateTotalUnits(i)} uds
                          </div>
                          <PhotoCounts item={i} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{i.codigo_fabricante ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {Number(i.precio_compra).toFixed(2)} €
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(i.peso_kg).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {i.pvp == null ? "—" : `${Number(i.pvp).toFixed(2)} €`}
                    </TableCell>
                    <TableCell>{i.sku_web ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {calculateTotalCost(i, null).toFixed(2)} €
                    </TableCell>
                    <TableCell>
                      {i.subido_al_sistema ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {MERCH_ESTADO_LABEL[i.estado as MerchEstado] ?? i.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Asignar a envío"
                          onClick={() => openAssignFor(i)}
                        >
                          <Truck className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(i)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <ItemEditorSheet open={open} onOpenChange={setOpen} item={editing} />
      <AssignToShipmentDialog
        open={openAssign}
        onOpenChange={setOpenAssign}
        item={assigning}
      />
    </div>
  );
}

function MobileCard({
  item,
  onEdit,
  onAssign,
}: {
  item: SublimeMerchItem;
  onEdit: () => void;
  onAssign: () => void;
}) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <ItemThumb item={item} size={56} />
          <div className="min-w-0">
            <p className="font-semibold truncate">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {item.codigo_fabricante ?? "sin código"} · {item.sku_web ?? "sin SKU"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatSizeSummary(item)} · {calculateTotalUnits(item)} uds
            </p>
            <PhotoCounts item={item} />
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onAssign} title="Asignar a envío">
            <Truck className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Compra</p>
          <p className="font-medium">{Number(item.precio_compra).toFixed(2)} €</p>
        </div>
        <div>
          <p className="text-muted-foreground">Peso</p>
          <p className="font-medium">{Number(item.peso_kg).toFixed(2)} kg</p>
        </div>
        <div>
          <p className="text-muted-foreground">PVP</p>
          <p className="font-medium">
            {item.pvp == null ? "—" : `${Number(item.pvp).toFixed(2)} €`}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-1">
        <Badge variant="secondary">
          {MERCH_ESTADO_LABEL[item.estado as MerchEstado] ?? item.estado}
        </Badge>
        {item.subido_al_sistema ? (
          <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> subido
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">no subido</span>
        )}
      </div>
    </Card>
  );
}
