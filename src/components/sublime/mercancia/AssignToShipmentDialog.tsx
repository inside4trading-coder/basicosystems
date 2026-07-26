import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useMerchMutations,
  useSublimeBoxes,
  useSublimeShipments,
  type SublimeMerchItem,
} from "@/hooks/useSublimeMerch";
import { BoxEditorDialog } from "./BoxEditorDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: SublimeMerchItem | null;
}

export function AssignToShipmentDialog({ open, onOpenChange, item }: Props) {
  const [shipmentId, setShipmentId] = useState<string>("");
  const [boxId, setBoxId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [openBox, setOpenBox] = useState(false);
  const { data: shipments = [] } = useSublimeShipments();
  const { data: boxes = [] } = useSublimeBoxes(shipmentId || null);
  const { assignItemToShipmentBox } = useMerchMutations();

  useEffect(() => {
    if (open) {
      setShipmentId(item?.shipment_id ?? "");
      setBoxId(item?.box_id ?? "");
    }
  }, [open, item]);

  useEffect(() => {
    if (shipmentId && boxId) {
      const belongs = boxes.some((b) => b.id === boxId);
      if (!belongs) setBoxId("");
    }
  }, [shipmentId, boxes, boxId]);

  const submit = async () => {
    if (!item) return;
    if (!shipmentId) return toast.error("Selecciona un envío.");
    if (!boxId) return toast.error("Selecciona una caja válida para este envío.");
    setSaving(true);
    try {
      await assignItemToShipmentBox.mutateAsync({
        itemId: item.id,
        shipmentId,
        boxId,
      });
      toast.success("Producto asignado y movido a En camino.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al asignar.");
    } finally {
      setSaving(false);
    }
  };

  const hasNoBoxes = Boolean(shipmentId) && boxes.length === 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar a envío / caja</DialogTitle>
            <DialogDescription>
              {item ? item.name : "Producto"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Envío</Label>
              <Select value={shipmentId} onValueChange={setShipmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un envío" />
                </SelectTrigger>
                <SelectContent>
                  {shipments.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.shipment_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Caja</Label>
              <Select
                value={boxId}
                onValueChange={setBoxId}
                disabled={!shipmentId || boxes.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !shipmentId
                        ? "Selecciona un envío primero"
                        : boxes.length === 0
                          ? "Sin cajas"
                          : "Selecciona una caja"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {boxes.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.box_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasNoBoxes ? (
              <div className="rounded-lg border border-dashed border-border p-3 text-sm space-y-2">
                <p className="text-muted-foreground">
                  Este envío no tiene cajas. Crea una caja antes de asignar productos.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOpenBox(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear caja
                </Button>
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving || !shipmentId || !boxId}>
              Confirmar asignación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BoxEditorDialog
        open={openBox}
        onOpenChange={setOpenBox}
        defaultShipmentId={shipmentId || undefined}
      />
    </>
  );
}
