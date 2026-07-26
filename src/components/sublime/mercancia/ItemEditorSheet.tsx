import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  canMarkUploaded,
  calculateTotalCost,
} from "@/lib/sublimeMerch";
import {
  useMerchMutations,
  type MerchItemInput,
  type SublimeMerchItem,
} from "@/hooks/useSublimeMerch";
import { PhotoGallery } from "./PhotoGallery";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item?: SublimeMerchItem | null;
}

const empty = (): MerchItemInput => ({
  name: "",
  precio_compra: 0,
  codigo_fabricante: null,
  peso_kg: 0,
  pvp: null,
  sku_web: null,
  notas: null,
  subido_al_sistema: false,
});

export function ItemEditorSheet({ open, onOpenChange, item }: Props) {
  const [form, setForm] = useState<MerchItemInput>(empty());
  const { createItem, updateItem } = useMerchMutations();
  const isEdit = Boolean(item?.id);
  const wasUploaded = Boolean(item?.subido_al_sistema);

  useEffect(() => {
    if (open) {
      setForm(
        item
          ? {
              id: item.id,
              name: item.name,
              precio_compra: Number(item.precio_compra ?? 0),
              codigo_fabricante: item.codigo_fabricante,
              peso_kg: Number(item.peso_kg ?? 0),
              pvp: item.pvp == null ? null : Number(item.pvp),
              sku_web: item.sku_web,
              notas: item.notas,
              subido_al_sistema: item.subido_al_sistema,
            }
          : empty(),
      );
    }
  }, [open, item]);

  const set = <K extends keyof MerchItemInput>(k: K, v: MerchItemInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleUploaded = (checked: boolean) => {
    if (!checked) {
      set("subido_al_sistema", false);
      return;
    }
    const check = canMarkUploaded(form);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }
    set("subido_al_sistema", true);
  };

  const submit = async () => {
    if (!form.name.trim()) return toast.error("El nombre es obligatorio.");
    if (form.precio_compra < 0)
      return toast.error("Precio de compra no puede ser negativo.");
    if (form.peso_kg < 0) return toast.error("Peso no puede ser negativo.");
    if (form.pvp != null && form.pvp < 0)
      return toast.error("PVP no puede ser negativo.");

    if (form.subido_al_sistema) {
      const check = canMarkUploaded(form);
      if (!check.ok) return toast.error(check.message);
    }

    try {
      if (isEdit && item) {
        await updateItem.mutateAsync({ id: item.id, input: form, wasUploaded });
        toast.success("Producto actualizado.");
      } else {
        await createItem.mutateAsync(form);
        toast.success("Producto creado.");
      }
      onOpenChange(false);
    } catch (e: any) {
      const msg = e?.message ?? "Error al guardar";
      if (msg.includes("sublime_merch_items_sku_web_key") || msg.includes("duplicate key")) {
        toast.error("Ese SKU web ya existe. Usa uno distinto.");
      } else {
        toast.error(msg);
      }
    }
  };

  const totalEst = calculateTotalCost(form, null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar producto" : "Agregar producto"}</SheetTitle>
          <SheetDescription>
            Producto comprado sin asignar a envío o caja.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ej. Hoodie vintage Nike"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Precio compra (EUR)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.precio_compra}
                onChange={(e) => set("precio_compra", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Peso (kg)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.peso_kg}
                onChange={(e) => set("peso_kg", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Código fabricante</Label>
            <Input
              value={form.codigo_fabricante ?? ""}
              onChange={(e) => set("codigo_fabricante", e.target.value || null)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>PVP</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.pvp ?? ""}
                onChange={(e) =>
                  set("pvp", e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>SKU web</Label>
              <Input
                value={form.sku_web ?? ""}
                onChange={(e) => set("sku_web", e.target.value.trim() || null)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              rows={3}
              value={form.notas ?? ""}
              onChange={(e) => set("notas", e.target.value || null)}
            />
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Costo total estimado</span>
              <span className="font-semibold">{totalEst.toFixed(2)} €</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Sin envío asignado en Fase 1 → costo total = precio de compra.
            </p>
          </div>

          <Separator />

          <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
            <div className="space-y-1">
              <Label className="text-sm">Subido al sistema</Label>
              <p className="text-xs text-muted-foreground">
                Requiere SKU web y PVP asignados.
              </p>
            </div>
            <Switch
              checked={form.subido_al_sistema}
              onCheckedChange={toggleUploaded}
            />
          </div>

          <div className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
            Impuestos preparados para fase posterior. No afectan el costo total
            actualmente.
          </div>

          <div className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
            Asignación a envío/caja disponible en la siguiente fase.
          </div>
        </div>

        <SheetFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={createItem.isPending || updateItem.isPending}
          >
            {isEdit ? "Guardar cambios" : "Crear producto"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
