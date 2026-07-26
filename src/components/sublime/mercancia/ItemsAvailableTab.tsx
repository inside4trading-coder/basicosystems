import { useEffect, useMemo, useState } from "react";
import { Pencil, ImageIcon, CheckCircle2, XCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useAvailableItems,
  useSublimeShipments,
  useSublimeBoxes,
  useSublimePricingRules,
  useMerchMutations,
  type SublimeMerchItem,
  type SublimeMerchShipment,
  type SublimeMerchBox,
} from "@/hooks/useSublimeMerch";
import {
  calculateShippingCost,
  calculateTotalCost,
  calculateMargin,
  calculateTotalUnits,
  findPricingRule,
  formatSizeSummary,
  getFinalPvp,
  canMarkUploaded,
  MERCH_ESTADO_LABEL,
  resolvePhotoUrl,
  type MerchEstado,
} from "@/lib/sublimeMerch";

import { ItemEditorSheet } from "./ItemEditorSheet";

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

export function ItemsAvailableTab() {
  const { data: items = [], isLoading } = useAvailableItems();
  const { data: shipments = [] } = useSublimeShipments();
  const { data: allBoxes = [] } = useSublimeBoxes(null);
  const { data: pricingRules = [] } = useSublimePricingRules();

  const { markItemAvailable, toggleItemUploaded } = useMerchMutations();
  const [editing, setEditing] = useState<SublimeMerchItem | null>(null);
  const [openEditor, setOpenEditor] = useState(false);
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

  const doMarkAvailable = async (i: SublimeMerchItem) => {
    try {
      await markItemAvailable.mutateAsync(i.id);
      toast.success("Marcado como disponible");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al marcar disponible");
    }
  };

  const doToggleUploaded = async (i: SublimeMerchItem, value: boolean) => {
    if (value) {
      const check = canMarkUploaded(i);
      if (!check.ok) {
        toast.error(check.message ?? "Faltan datos para marcar como subido");
        return;
      }
    }
    try {
      await toggleItemUploaded.mutateAsync({ itemId: i.id, value });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al actualizar");
    }
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
        Sin productos recibidos aún.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {items.length} producto{items.length === 1 ? "" : "s"} recibido/disponible
      </p>

      {isMobile ? (
        <div className="space-y-3">
          {items.map((i) => {
            const shipment = i.shipment_id ? shipMap.get(i.shipment_id) : null;
            const box = i.box_id ? boxMap.get(i.box_id) : null;
            const shipping = calculateShippingCost(i, shipment ?? null);
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
                        SKU: {i.sku_web ?? "—"} · Cód: {i.codigo_fabricante ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {shipment?.shipment_number ?? "—"} · {box?.box_number ?? "—"} ·{" "}
                        Recibido: {fmtDate(i.received_at)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatSizeSummary(i)} · {calculateTotalUnits(i)} uds
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
                    <p className="font-medium">{Number(i.precio_compra).toFixed(2)} €</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-medium">{total.toFixed(2)} €</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Margen</p>
                    <p className="font-medium">
                      {margin == null ? "—" : `${margin.toFixed(2)} €`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <Badge
                    variant={i.estado === "available" ? "default" : "secondary"}
                  >
                    {MERCH_ESTADO_LABEL[i.estado as MerchEstado] ?? i.estado}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Subido</span>
                    <Switch
                      checked={i.subido_al_sistema}
                      onCheckedChange={(v) => doToggleUploaded(i, v)}
                    />
                  </div>
                </div>
                {i.estado === "received" ? (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => doMarkAvailable(i)}
                    disabled={markItemAvailable.isPending}
                  >
                    Marcar disponible
                  </Button>
                ) : null}
                <p className="text-[10px] text-muted-foreground">
                  Envío €{shipping.toFixed(2)} · PVP{" "}
                  {i.pvp == null ? "—" : `${Number(i.pvp).toFixed(2)} €`}
                </p>
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
                  <TableHead>Recibido</TableHead>
                  <TableHead className="text-right">Compra</TableHead>
                  <TableHead className="text-right">Peso</TableHead>
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
                  const shipping = calculateShippingCost(i, shipment ?? null);
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
                            <div className="text-[10px] text-muted-foreground truncate">
                              {formatSizeSummary(i)} · {calculateTotalUnits(i)} uds
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
                      <TableCell className="text-xs">{fmtDate(i.received_at)}</TableCell>
                      <TableCell className="text-right">
                        {Number(i.precio_compra).toFixed(2)} €
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(i.peso_kg).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {shipping.toFixed(2)} €
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
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={i.subido_al_sistema}
                            onCheckedChange={(v) => doToggleUploaded(i, v)}
                          />
                          {i.subido_al_sistema ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={i.estado === "available" ? "default" : "secondary"}
                        >
                          {MERCH_ESTADO_LABEL[i.estado as MerchEstado] ?? i.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {i.estado === "received" ? (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => doMarkAvailable(i)}
                              disabled={markItemAvailable.isPending}
                            >
                              <Download className="h-3.5 w-3.5 mr-1" />
                              Disponible
                            </Button>
                          ) : null}
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
    </div>
  );
}
