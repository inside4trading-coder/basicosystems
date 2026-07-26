import { useEffect, useMemo, useState } from "react";
import { Pencil, CheckCircle2, XCircle, ImageIcon, Truck } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useInTransitItems,
  useSublimeShipments,
  useSublimeBoxes,
  type SublimeMerchItem,
  type SublimeMerchShipment,
  type SublimeMerchBox,
} from "@/hooks/useSublimeMerch";
import {
  calculateShippingCost,
  calculateTotalCost,
  calculateMargin,
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

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "—";
  }
}

export function ItemsInTransitTab() {
  const { data: items = [], isLoading } = useInTransitItems();
  const { data: shipments = [] } = useSublimeShipments();
  const { data: allBoxes = [] } = useSublimeBoxes(null);
  const [editing, setEditing] = useState<SublimeMerchItem | null>(null);
  const [openEditor, setOpenEditor] = useState(false);
  const [assigning, setAssigning] = useState<SublimeMerchItem | null>(null);
  const [openAssign, setOpenAssign] = useState(false);
  const isMobile = useIsMobile();

  const shipMap = useMemo(() => {
    const m = new Map<string, SublimeMerchShipment>();
    for (const s of shipments) m.set(s.id, s);
    return m;
  }, [shipments]);
  const boxMap = useMemo(() => {
    const m = new Map<string, SublimeMerchBox>();
    for (const b of allBoxes) m.set(b.id, b);
    return m;
  }, [allBoxes]);

  const openEdit = (i: SublimeMerchItem) => {
    setEditing(i);
    setOpenEditor(true);
  };
  const openReassign = (i: SublimeMerchItem) => {
    setAssigning(i);
    setOpenAssign(true);
  };

  if (isLoading) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Cargando…
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        No hay productos en camino. Asigna un producto desde{" "}
        <span className="font-semibold">Compras sin asignar</span>.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {items.length} producto{items.length === 1 ? "" : "s"} en camino
      </p>

      {isMobile ? (
        <div className="space-y-3">
          {items.map((i) => {
            const shipment = i.shipment_id ? shipMap.get(i.shipment_id) : null;
            const box = i.box_id ? boxMap.get(i.box_id) : null;
            const shippingCost = calculateShippingCost(i, shipment ?? null);
            const total = calculateTotalCost(i, shipment ?? null);
            const margin = calculateMargin(i, shipment ?? null);
            return (
              <Card key={i.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <ItemThumb item={i} size={56} />
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{i.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {shipment?.shipment_number ?? "sin envío"} ·{" "}
                        {box?.box_number ?? "sin caja"}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(i)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Compra</p>
                    <p className="font-medium">
                      {Number(i.precio_compra).toFixed(2)} €
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Envío</p>
                    <p className="font-medium">{shippingCost.toFixed(2)} €</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-medium">{total.toFixed(2)} €</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <Badge variant="secondary">
                    {MERCH_ESTADO_LABEL[i.estado as MerchEstado] ?? i.estado}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Margen: {margin == null ? "—" : `${margin.toFixed(2)} €`}
                  </span>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openReassign(i)}
                  >
                    <Truck className="h-3.5 w-3.5 mr-1" />
                    Reasignar
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            disabled
                          >
                            Marcar recibido
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Recepción disponible en Fase 3.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </Card>
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
                  <TableHead>Envío / Caja</TableHead>
                  <TableHead>Fecha envío</TableHead>
                  <TableHead className="text-right">Compra</TableHead>
                  <TableHead className="text-right">Peso kg</TableHead>
                  <TableHead className="text-right">€/kg</TableHead>
                  <TableHead className="text-right">Envío</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">PVP</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Subido</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => {
                  const shipment = i.shipment_id ? shipMap.get(i.shipment_id) : null;
                  const box = i.box_id ? boxMap.get(i.box_id) : null;
                  const shippingCost = calculateShippingCost(i, shipment ?? null);
                  const total = calculateTotalCost(i, shipment ?? null);
                  const margin = calculateMargin(i, shipment ?? null);
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <ItemThumb item={i} />
                          <div className="min-w-0">
                            <div className="truncate">{i.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {i.codigo_fabricante ?? "—"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {shipment?.shipment_number ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {box?.box_number ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {fmtDate(shipment?.sent_at ?? null)}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(i.precio_compra).toFixed(2)} €
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(i.peso_kg).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {shipment
                          ? `${Number(shipment.cost_per_kg_eur).toFixed(2)} €`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {shippingCost.toFixed(2)} €
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {total.toFixed(2)} €
                      </TableCell>
                      <TableCell className="text-right">
                        {i.pvp == null ? "—" : `${Number(i.pvp).toFixed(2)} €`}
                      </TableCell>
                      <TableCell className="text-right">
                        {margin == null ? "—" : `${margin.toFixed(2)} €`}
                      </TableCell>
                      <TableCell>{i.sku_web ?? "—"}</TableCell>
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
                            title="Reasignar"
                            onClick={() => openReassign(i)}
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <ItemEditorSheet open={openEditor} onOpenChange={setOpenEditor} item={editing} />
      <AssignToShipmentDialog
        open={openAssign}
        onOpenChange={setOpenAssign}
        item={assigning}
      />
    </div>
  );
}
