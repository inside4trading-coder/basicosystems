import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, Truck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  getNextShipmentNumber,
  useMerchMutations,
  useSublimeBoxes,
  useSublimeShipments,
  type ShipmentInput,
  type SublimeMerchBox,
  type SublimeMerchItem,
  type SublimeMerchShipment,
} from "@/hooks/useSublimeMerch";
import { calculateTotalUnits } from "@/lib/sublimeMerch";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: SublimeMerchItem[];
  onAssigned: () => void;
}

const eligibleShipment = (shipment: SublimeMerchShipment) =>
  !["received", "cancelled"].includes(shipment.status);

const shipmentStatusLabel: Record<string, string> = {
  draft: "En preparación",
  in_transit: "En camino",
  partially_received: "Parcial recibido",
};

const emptyShipment = (shipmentNumber: string): ShipmentInput => ({
  shipment_number: shipmentNumber,
  sent_at: null,
  carrier: null,
  tracking_number: null,
  cost_per_kg_eur: 0,
  status: "draft",
  notes: null,
});

export function BulkAssignShipmentDialog({ open, onOpenChange, items, onAssigned }: Props) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [shipmentId, setShipmentId] = useState("");
  const [boxId, setBoxId] = useState("");
  const [newShipment, setNewShipment] = useState<ShipmentInput>(emptyShipment(""));
  const [newBoxNumber, setNewBoxNumber] = useState("Caja 1");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: shipments = [] } = useSublimeShipments();
  const { data: boxes = [] } = useSublimeBoxes(shipmentId || null);
  const { createShipment, createBox, bulkAssignItemsToShipmentBox } = useMerchMutations();
  const availableShipments = useMemo(() => shipments.filter(eligibleShipment), [shipments]);
  const selectedShipment = shipments.find((shipment) => shipment.id === shipmentId) ?? null;
  const selectedBox = boxes.find((box) => box.id === boxId) ?? null;
  const unitCount = items.reduce((total, item) => total + calculateTotalUnits(item), 0);

  useEffect(() => {
    if (!open) return;
    setMode("existing");
    setShipmentId("");
    setBoxId("");
    setNewBoxNumber("Caja 1");
    getNextShipmentNumber(brand)
      .then((number) => setNewShipment(emptyShipment(number)))
      .catch(() => setNewShipment(emptyShipment("")));
  }, [open]);

  useEffect(() => {
    if (shipmentId && !boxes.some((box) => box.id === boxId)) setBoxId("");
  }, [shipmentId, boxes, boxId]);

  const setNewShipmentField = <K extends keyof ShipmentInput>(key: K, value: ShipmentInput[K]) => {
    setNewShipment((current) => ({ ...current, [key]: value }));
  };

  const openConfirmation = () => {
    if (!items.length) return toast.error("No hay productos seleccionados.");
    if (mode === "existing" && (!selectedShipment || !selectedBox)) {
      return toast.error("Selecciona un envío y una caja válidos.");
    }
    if (mode === "new" && (!newShipment.shipment_number.trim() || !newBoxNumber.trim())) {
      return toast.error("Completa el número de envío y de caja.");
    }
    setConfirmOpen(true);
  };

  const assign = async () => {
    setSaving(true);
    try {
      let targetShipmentId = shipmentId;
      let targetBoxId = boxId;
      if (mode === "new") {
        const shipment = await createShipment.mutateAsync({
          ...newShipment,
          shipment_number: newShipment.shipment_number.trim(),
        });
        const box = await createBox.mutateAsync({
          shipment_id: shipment.id,
          box_number: newBoxNumber.trim(),
          weight_kg: 0,
          status: "pending",
          notes: null,
        });
        targetShipmentId = shipment.id;
        targetBoxId = box.id;
      }
      const assigned = await bulkAssignItemsToShipmentBox.mutateAsync({
        itemIds: items.map((item) => item.id),
        shipmentId: targetShipmentId,
        boxId: targetBoxId,
      });
      if (assigned.length !== items.length) {
        throw new Error("Algunos productos ya no estaban disponibles para asignar.");
      }
      toast.success(`${items.length} productos / ${unitCount} unidades asignados correctamente.`);
      setConfirmOpen(false);
      onOpenChange(false);
      onAssigned();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo completar la asignación.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Asignar mercancía seleccionada</DialogTitle>
            <DialogDescription>
              {items.length} productos · {unitCount} unidades. Cada compra se asignará individualmente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={mode === "existing" ? "default" : "outline"}
                onClick={() => setMode("existing")}
              >
                <Truck className="mr-2 h-4 w-4" />
                Envío existente
              </Button>
              <Button
                type="button"
                variant={mode === "new" ? "default" : "outline"}
                onClick={() => setMode("new")}
              >
                <Plus className="mr-2 h-4 w-4" />
                Crear nuevo envío
              </Button>
            </div>

            {mode === "existing" ? (
              <>
                <div className="space-y-2">
                  <Label>Envío</Label>
                  <Select value={shipmentId} onValueChange={setShipmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un envío" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableShipments.map((shipment) => (
                        <SelectItem key={shipment.id} value={shipment.id}>
                          {shipment.shipment_number} · {shipmentStatusLabel[shipment.status] ?? shipment.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedShipment ? (
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                    <p className="font-medium">{selectedShipment.shipment_number}</p>
                    <p className="text-muted-foreground">
                      Estado: {shipmentStatusLabel[selectedShipment.status] ?? selectedShipment.status}
                      {selectedShipment.carrier ? ` · ${selectedShipment.carrier}` : ""}
                    </p>
                    {selectedShipment.tracking_number ? (
                      <p className="text-muted-foreground">Seguimiento: {selectedShipment.tracking_number}</p>
                    ) : null}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label>Caja</Label>
                  <Select value={boxId} onValueChange={setBoxId} disabled={!shipmentId || !boxes.length}>
                    <SelectTrigger>
                      <SelectValue placeholder={!shipmentId ? "Selecciona un envío primero" : "Selecciona una caja"} />
                    </SelectTrigger>
                    <SelectContent>
                      {boxes.map((box) => (
                        <SelectItem key={box.id} value={box.id}>
                          {box.box_number} · {boxStatusLabel(box)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {shipmentId && !boxes.length ? (
                    <p className="text-xs text-muted-foreground">Este envío todavía no tiene cajas.</p>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="space-y-4 rounded-md border border-border p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Número de envío *</Label>
                    <Input
                      value={newShipment.shipment_number}
                      onChange={(event) => setNewShipmentField("shipment_number", event.target.value)}
                      placeholder="S001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={newShipment.status} onValueChange={(value) => setNewShipmentField("status", value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">En preparación</SelectItem>
                        <SelectItem value="in_transit">En camino</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Transportista</Label>
                    <Input value={newShipment.carrier ?? ""} onChange={(event) => setNewShipmentField("carrier", event.target.value || null)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nº seguimiento</Label>
                    <Input value={newShipment.tracking_number ?? ""} onChange={(event) => setNewShipmentField("tracking_number", event.target.value || null)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Número de caja *</Label>
                  <Input value={newBoxNumber} onChange={(event) => setNewBoxNumber(event.target.value)} placeholder="Caja 1" />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={openConfirmation} disabled={saving || !items.length}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar asignación</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a asignar {items.length} productos / {unitCount} unidades al envío{" "}
              <strong>{mode === "existing" ? selectedShipment?.shipment_number : newShipment.shipment_number}</strong>. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void assign(); }} disabled={saving}>
              {saving ? "Asignando…" : "Confirmar asignación"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function boxStatusLabel(box: SublimeMerchBox): string {
  if (box.status === "received") return "recibida";
  if (box.status === "in_transit") return "en camino";
  return "pendiente";
}
