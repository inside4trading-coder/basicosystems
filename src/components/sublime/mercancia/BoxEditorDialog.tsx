import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  useMerchMutations,
  useSublimeShipments,
  type BoxInput,
  type SublimeMerchBox,
} from "@/hooks/useSublimeMerch";

const BOX_STATUSES = [
  { value: "pending", label: "Pendiente" },
  { value: "in_transit", label: "En camino" },
  { value: "received", label: "Recibida" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  box?: SublimeMerchBox | null;
  defaultShipmentId?: string;
}

const empty = (shipmentId?: string): BoxInput => ({
  shipment_id: shipmentId ?? "",
  box_number: "",
  weight_kg: 0,
  status: "pending",
  notes: null,
});

export function BoxEditorDialog({
  open,
  onOpenChange,
  box,
  defaultShipmentId,
}: Props) {
  const [form, setForm] = useState<BoxInput>(empty(defaultShipmentId));
  const [saving, setSaving] = useState(false);
  const { createBox, updateBox } = useMerchMutations();
  const { data: shipments = [] } = useSublimeShipments();
  const isEdit = Boolean(box?.id);

  useEffect(() => {
    if (open) {
      setForm(
        box
          ? {
              shipment_id: box.shipment_id,
              box_number: box.box_number,
              weight_kg: Number(box.weight_kg ?? 0),
              status: box.status,
              notes: box.notes,
            }
          : empty(defaultShipmentId),
      );
    }
  }, [open, box, defaultShipmentId]);

  const set = <K extends keyof BoxInput>(k: K, v: BoxInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.shipment_id) return toast.error("Selecciona un envío.");
    if (!form.box_number.trim())
      return toast.error("El número de caja es obligatorio.");
    if (form.weight_kg < 0)
      return toast.error("El peso no puede ser negativo.");
    setSaving(true);
    try {
      if (isEdit && box) {
        await updateBox.mutateAsync({ id: box.id, input: form });
        toast.success("Caja actualizada.");
      } else {
        await createBox.mutateAsync(form);
        toast.success("Caja creada.");
      }
      onOpenChange(false);
    } catch (e: any) {
      const msg = e?.message ?? "Error al guardar caja";
      if (msg.includes("duplicate key") || msg.includes("box_number")) {
        toast.error("Ese número de caja ya existe en este envío.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar caja" : "Nueva caja"}</DialogTitle>
          <DialogDescription>
            La caja siempre pertenece a un envío.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Envío *</Label>
            <Select
              value={form.shipment_id}
              onValueChange={(v) => set("shipment_id", v)}
              disabled={isEdit}
            >
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Número caja *</Label>
              <Input
                value={form.box_number}
                onChange={(e) => set("box_number", e.target.value)}
                placeholder="Caja 1"
              />
            </div>
            <div className="space-y-2">
              <Label>Peso (kg)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.weight_kg}
                onChange={(e) => set("weight_kg", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOX_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value || null)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {isEdit ? "Guardar cambios" : "Crear caja"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
