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
  getNextShipmentNumber,
  type ShipmentInput,
  type SublimeMerchShipment,
} from "@/hooks/useSublimeMerch";

const SHIPMENT_STATUSES = [
  { value: "draft", label: "Borrador" },
  { value: "in_transit", label: "En camino" },
  { value: "partially_received", label: "Parcial recibido" },
  { value: "received", label: "Recibido" },
  { value: "cancelled", label: "Cancelado" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shipment?: SublimeMerchShipment | null;
}

const empty = (): ShipmentInput => ({
  shipment_number: "",
  sent_at: null,
  carrier: null,
  tracking_number: null,
  cost_per_kg_eur: 0,
  status: "draft",
  notes: null,
});

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function ShipmentEditorDialog({ open, onOpenChange, shipment }: Props) {
  const [form, setForm] = useState<ShipmentInput>(empty());
  const [saving, setSaving] = useState(false);
  const { createShipment, updateShipment } = useMerchMutations();
  const isEdit = Boolean(shipment?.id);

  useEffect(() => {
    if (open) {
      if (shipment) {
        setForm({
          shipment_number: shipment.shipment_number,
          sent_at: shipment.sent_at,
          carrier: shipment.carrier,
          tracking_number: shipment.tracking_number,
          cost_per_kg_eur: Number(shipment.cost_per_kg_eur ?? 0),
          status: shipment.status,
          notes: shipment.notes,
        });
      } else {
        setForm(empty());
        getNextShipmentNumber()
          .then((n) => setForm((f) => ({ ...f, shipment_number: n })))
          .catch(() => undefined);
      }
    }
  }, [open, shipment]);

  const regenerateNumber = async () => {
    try {
      const n = await getNextShipmentNumber();
      setForm((f) => ({ ...f, shipment_number: n }));
    } catch {
      toast.error("No se pudo regenerar el número.");
    }
  };

  const set = <K extends keyof ShipmentInput>(k: K, v: ShipmentInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.shipment_number.trim())
      return toast.error("El número de envío es obligatorio.");
    if (form.cost_per_kg_eur < 0)
      return toast.error("El costo por kg no puede ser negativo.");
    setSaving(true);
    try {
      if (isEdit && shipment) {
        await updateShipment.mutateAsync({ id: shipment.id, input: form });
        toast.success("Envío actualizado.");
      } else {
        await createShipment.mutateAsync(form);
        toast.success("Envío creado.");
      }
      onOpenChange(false);
    } catch (e: any) {
      const msg = e?.message ?? "Error al guardar envío";
      if (msg.includes("duplicate key") || msg.includes("shipment_number")) {
        toast.error("Ese número de envío ya existe.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar envío" : "Nuevo envío"}</DialogTitle>
          <DialogDescription>
            Datos del envío para agrupar cajas y productos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Número de envío *</Label>
            <div className="flex gap-2">
              <Input
                value={form.shipment_number}
                readOnly={!isEdit}
                onChange={(e) => set("shipment_number", e.target.value)}
                placeholder="S001"
              />
              {!isEdit && (
                <Button type="button" variant="outline" onClick={regenerateNumber}>
                  Regenerar
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fecha envío</Label>
              <Input
                type="date"
                value={toDateInput(form.sent_at)}
                onChange={(e) =>
                  set(
                    "sent_at",
                    e.target.value ? new Date(e.target.value).toISOString() : null,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Costo por kg (EUR) *</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.cost_per_kg_eur}
                onChange={(e) => set("cost_per_kg_eur", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Transportista</Label>
              <Input
                value={form.carrier ?? ""}
                onChange={(e) => set("carrier", e.target.value || null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Nº seguimiento</Label>
              <Input
                value={form.tracking_number ?? ""}
                onChange={(e) => set("tracking_number", e.target.value || null)}
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
                {SHIPMENT_STATUSES.map((s) => (
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
            {isEdit ? "Guardar cambios" : "Crear envío"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
