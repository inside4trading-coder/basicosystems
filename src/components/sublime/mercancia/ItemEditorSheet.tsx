import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { Upload, Camera, Link as LinkIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  canMarkUploaded,
  calculateTotalCost,
  calculateTotalUnits,
  calculateSuggestedBasePvp,
  calculateIvaAmount,
  getFinalPvp,
  findPricingRule,
  IVA_RATE,
  getDefaultSizesForGroup,
  normalizeSizeQuantities,
  validatePhotoFile,
  validatePhotoUrl,
  uploadSublimeMerchPhoto,
} from "@/lib/sublimeMerch";
import {
  useMerchMutations,
  useSublimeBoxes,
  useSublimeShipments,
  useSublimeItem,
  useSublimePricingRules,
  type MerchItemInput,
  type SublimeMerchItem,
} from "@/hooks/useSublimeMerch";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  size_group: "franelas_hoodies",
  no_size: false,
  unit_count: 1,
  size_quantities: {},
  product_type: "franelas_hoodies",
  use_manual_pvp: false,
  pvp_manual: null,
});


interface PendingFile {
  file: File;
  previewUrl: string;
}

export function ItemEditorSheet({ open, onOpenChange, item }: Props) {
  const [form, setForm] = useState<MerchItemInput>(empty());
  const { createItem, updateItem, addPhotoToItem, addWebPhotoUrl } = useMerchMutations();
  const { data: pricingRules = [] } = useSublimePricingRules();
  const isEdit = Boolean(item?.id);
  const wasUploaded = Boolean(item?.subido_al_sistema);
  const { data: liveItem } = useSublimeItem(isEdit && open ? item?.id : null);
  const currentItem = liveItem ?? item ?? null;
  const { data: shipmentsForCalc = [] } = useSublimeShipments();
  const currentShipment =
    currentItem?.shipment_id
      ? shipmentsForCalc.find((s) => s.id === currentItem.shipment_id) ?? null
      : null;


  const [pendingOrigen, setPendingOrigen] = useState<PendingFile[]>([]);
  const [pendingWebFiles, setPendingWebFiles] = useState<PendingFile[]>([]);
  const [pendingWebUrls, setPendingWebUrls] = useState<string[]>([]);
  const [webUrlInput, setWebUrlInput] = useState("");
  const [saving, setSaving] = useState(false);

  const revokeAll = () => {
    pendingOrigen.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    pendingWebFiles.forEach((p) => URL.revokeObjectURL(p.previewUrl));
  };

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
              size_group: (item.size_group as string) ?? "franelas_hoodies",
              no_size: Boolean(item.no_size),
              unit_count: Math.max(1, Number(item.unit_count ?? 1)),
              size_quantities: (item.size_quantities as Record<string, number>) ?? {},
              product_type: (item.product_type as string) ?? "franelas_hoodies",
              use_manual_pvp: Boolean(item.use_manual_pvp),
              pvp_manual: item.pvp_manual == null ? null : Number(item.pvp_manual),
            }

          : empty(),
      );
      setPendingOrigen([]);
      setPendingWebFiles([]);
      setPendingWebUrls([]);
      setWebUrlInput("");
    } else {
      revokeAll();
      setPendingOrigen([]);
      setPendingWebFiles([]);
      setPendingWebUrls([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  useEffect(() => {
    return () => revokeAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof MerchItemInput>(k: K, v: MerchItemInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const currentRule = findPricingRule(pricingRules, form.product_type);
  const toggleUploaded = (checked: boolean) => {
    if (!checked) {
      set("subido_al_sistema", false);
      return;
    }
    const check = canMarkUploaded(form, currentRule, currentShipment);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }
    set("subido_al_sistema", true);
  };


  const addPending = (
    files: FileList | null,
    kind: "origen" | "web",
  ) => {
    if (!files) return;
    const accepted: PendingFile[] = [];
    for (const file of Array.from(files)) {
      const check = validatePhotoFile(file);
      if (!check.ok) {
        toast.error(check.message);
        continue;
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    if (accepted.length === 0) return;
    if (kind === "origen") setPendingOrigen((p) => [...p, ...accepted]);
    else setPendingWebFiles((p) => [...p, ...accepted]);
  };

  const removePending = (idx: number, kind: "origen" | "web") => {
    if (kind === "origen") {
      setPendingOrigen((p) => {
        const removed = p[idx];
        if (removed) URL.revokeObjectURL(removed.previewUrl);
        return p.filter((_, i) => i !== idx);
      });
    } else {
      setPendingWebFiles((p) => {
        const removed = p[idx];
        if (removed) URL.revokeObjectURL(removed.previewUrl);
        return p.filter((_, i) => i !== idx);
      });
    }
  };

  const addPendingWebUrl = () => {
    const trimmed = webUrlInput.trim();
    const check = validatePhotoUrl(trimmed);
    if (!check.ok) return toast.error(check.message);
    if (pendingWebUrls.includes(trimmed)) {
      setWebUrlInput("");
      return;
    }
    setPendingWebUrls((p) => [...p, trimmed]);
    setWebUrlInput("");
  };

  const submit = async () => {
    if (!form.name.trim()) return toast.error("El nombre es obligatorio.");
    if (form.precio_compra < 0)
      return toast.error("Precio de compra no puede ser negativo.");
    if (form.peso_kg < 0) return toast.error("Peso no puede ser negativo.");
    if (form.pvp != null && form.pvp < 0)
      return toast.error("PVP no puede ser negativo.");

    // Sizes validation
    if (form.no_size) {
      if (!form.unit_count || form.unit_count < 1) {
        return toast.error("Unidades debe ser al menos 1.");
      }
    } else {
      const normalized = normalizeSizeQuantities(form.size_quantities);
      const total = Object.values(normalized).reduce((a, b) => a + b, 0);
      if (total <= 0) {
        return toast.error("Agrega al menos una talla o marca Sin talla.");
      }
      form.size_quantities = normalized;
    }

    if (form.subido_al_sistema) {
      const check = canMarkUploaded(form, currentRule, currentShipment);
      if (!check.ok) return toast.error(check.message);
    }

    setSaving(true);
    try {
      if (isEdit && item) {
        await updateItem.mutateAsync({ id: item.id, input: form, wasUploaded });
        toast.success("Producto actualizado.");
        onOpenChange(false);
      } else {
        const created = await createItem.mutateAsync(form);
        let failures = 0;
        for (const p of pendingOrigen) {
          try {
            const url = await uploadSublimeMerchPhoto(created.id, "origen", p.file);
            await addPhotoToItem.mutateAsync({ itemId: created.id, type: "origen", url });
          } catch {
            failures++;
          }
        }
        for (const p of pendingWebFiles) {
          try {
            const url = await uploadSublimeMerchPhoto(created.id, "web", p.file);
            await addPhotoToItem.mutateAsync({ itemId: created.id, type: "web", url });
          } catch {
            failures++;
          }
        }
        for (const u of pendingWebUrls) {
          try {
            await addWebPhotoUrl.mutateAsync({ itemId: created.id, url: u });
          } catch {
            failures++;
          }
        }
        if (failures > 0) {
          toast.warning(
            "Producto creado, pero algunas fotos no pudieron subirse. Puedes agregarlas editando el producto.",
          );
        } else {
          toast.success("Producto creado.");
        }
        onOpenChange(false);
      }
    } catch (e: any) {
      const msg = e?.message ?? "Error al guardar";
      if (msg.includes("sublime_merch_items_sku_web_key") || msg.includes("duplicate key")) {
        toast.error("Ese SKU web ya existe. Usa uno distinto.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  void calculateTotalCost;

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

          <div className="space-y-2">
            <Label>SKU web</Label>
            <Input
              value={form.sku_web ?? ""}
              onChange={(e) => set("sku_web", e.target.value.trim() || null)}
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de artículo</Label>
            <Select
              value={form.product_type}
              onValueChange={(v) => set("product_type", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(pricingRules.filter((r) => r.active).length
                  ? pricingRules.filter((r) => r.active)
                  : []
                ).map((r) => (
                  <SelectItem key={r.product_type} value={r.product_type}>
                    {r.label}
                  </SelectItem>
                ))}
                {/* Mostrar tipo inactivo si el producto lo tiene */}
                {currentRule && currentRule.active === false ? (
                  <SelectItem value={currentRule.product_type}>
                    {currentRule.label} (inactivo)
                  </SelectItem>
                ) : null}
                {/* Fallback si no cargó nada */}
                {pricingRules.length === 0 ? (
                  <SelectItem value="franelas_hoodies">Franelas / Hoodies</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              rows={3}
              value={form.notas ?? ""}
              onChange={(e) => set("notas", e.target.value || null)}
            />
          </div>

          <SizesSection
            form={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          />

          <SuggestedPricePanel
            form={form}
            rule={currentRule}
            shipment={currentShipment}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          />


          <Separator />

          <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
            <div className="space-y-1">
              <Label className="text-sm">Subido al sistema</Label>
              <p className="text-xs text-muted-foreground">
                {currentShipment && currentShipment.cost_per_kg_eur != null
                  ? "Requiere SKU web y PVP final válido."
                  : "Requiere SKU web y PVP válido. Aviso: el PVP actual es tentativo porque aún no incluye envío."}
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

          <Separator />

          <div className="space-y-3 rounded-lg border border-border/60 p-3">
            <div>
              <Label className="text-sm">Fotos referencia / origen</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Fotos tomadas con el teléfono o adjuntadas para que el equipo
                identifique la prenda al recibirla.
              </p>
            </div>
            {isEdit && currentItem ? (
              <PhotoGallery
                itemId={currentItem.id}
                type="origen"
                photos={currentItem.fotos_origen ?? []}
              />
            ) : (
              <PendingPhotoPicker
                kind="origen"
                pending={pendingOrigen}
                onAdd={(files) => addPending(files, "origen")}
                onRemove={(i) => removePending(i, "origen")}
              />
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 p-3">
            <div>
              <Label className="text-sm">Fotos web / banco de imágenes</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Fotos que se usarán para subir el producto a la web.
              </p>
            </div>
            {isEdit && currentItem ? (
              <PhotoGallery
                itemId={currentItem.id}
                type="web"
                photos={currentItem.fotos_web ?? []}
                allowUrlInput
                showBankTools
              />
            ) : (
              <div className="space-y-3">
                <PendingPhotoPicker
                  kind="web"
                  pending={pendingWebFiles}
                  onAdd={(files) => addPending(files, "web")}
                  onRemove={(i) => removePending(i, "web")}
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="https://…"
                    value={webUrlInput}
                    onChange={(e) => setWebUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPendingWebUrl();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={addPendingWebUrl}
                    disabled={!webUrlInput.trim()}
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Agregar
                  </Button>
                </div>
                {pendingWebUrls.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {pendingWebUrls.map((u, i) => (
                      <div
                        key={u}
                        className="relative group rounded-lg border border-border/60 overflow-hidden bg-muted/30 aspect-square"
                      >
                        <img src={u} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() =>
                            setPendingWebUrls((p) => p.filter((_, idx) => idx !== i))
                          }
                          className="absolute top-1 right-1 rounded bg-destructive/90 text-destructive-foreground p-1 opacity-0 group-hover:opacity-100 transition"
                          title="Quitar"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground italic">
                  Puedes tomar o adjuntar fotos ahora. Se subirán automáticamente al
                  guardar el producto.
                </p>
              </div>
            )}
          </div>

          {isEdit && item ? (
            <ShipmentBoxAssigner item={item} />
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
              Guarda el producto para poder asignarlo a un envío/caja.
            </div>
          )}
        </div>

        <SheetFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={createItem.isPending || updateItem.isPending || saving}
          >
            {isEdit ? "Guardar cambios" : "Crear producto"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function PendingPhotoPicker({
  kind,
  pending,
  onAdd,
  onRemove,
}: {
  kind: "origen" | "web";
  pending: PendingFile[];
  onAdd: (files: FileList | null) => void;
  onRemove: (idx: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            onAdd(e.target.files);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            onAdd(e.target.files);
            if (cameraRef.current) cameraRef.current.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          Subir
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="h-4 w-4 mr-2" />
          Cámara
        </Button>
      </div>

      <p className="text-xs text-muted-foreground italic">
        Puedes tomar o adjuntar fotos ahora. Se subirán automáticamente al guardar el
        producto.
      </p>

      {pending.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {pending.map((p, i) => (
            <div
              key={`${kind}-${i}-${p.previewUrl}`}
              className="relative group rounded-lg border border-border/60 overflow-hidden bg-muted/30 aspect-square"
            >
              <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute top-1 right-1 rounded bg-destructive/90 text-destructive-foreground p-1 opacity-0 group-hover:opacity-100 transition"
                title="Quitar"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShipmentBoxAssigner({ item }: { item: SublimeMerchItem }) {
  const [shipmentId, setShipmentId] = useState<string>(item.shipment_id ?? "");
  const [boxId, setBoxId] = useState<string>(item.box_id ?? "");
  const [saving, setSaving] = useState(false);
  const { data: shipments = [] } = useSublimeShipments();
  const { data: boxes = [] } = useSublimeBoxes(shipmentId || null);
  const { assignItemToShipmentBox } = useMerchMutations();

  useEffect(() => {
    if (shipmentId && boxId) {
      const belongs = boxes.some((b) => b.id === boxId);
      if (!belongs) setBoxId("");
    }
  }, [shipmentId, boxes, boxId]);

  const onChangeShipment = (v: string) => {
    setShipmentId(v);
    setBoxId("");
  };

  const save = async () => {
    if (!shipmentId) return toast.error("Selecciona un envío.");
    if (!boxId) return toast.error("Selecciona una caja válida para este envío.");
    setSaving(true);
    try {
      await assignItemToShipmentBox.mutateAsync({
        itemId: item.id,
        shipmentId,
        boxId,
      });
      toast.success("Asignación guardada. Producto en camino.");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al asignar.");
    } finally {
      setSaving(false);
    }
  };

  const noBoxes = Boolean(shipmentId) && boxes.length === 0;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-3">
      <div>
        <Label className="text-sm">Asignación a envío / caja</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Al guardar la asignación, el producto pasa a "En camino".
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Envío</Label>
        <Select value={shipmentId} onValueChange={onChangeShipment}>
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
        <Label className="text-xs">Caja</Label>
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
      {noBoxes ? (
        <p className="text-xs text-muted-foreground italic">
          Este envío no tiene cajas. Crea una caja desde "Gestionar envíos".
        </p>
      ) : null}
      <Button
        type="button"
        size="sm"
        onClick={save}
        disabled={saving || !shipmentId || !boxId}
      >
        Guardar asignación
      </Button>
    </div>
  );
}

function SizesSection({
  form,
  onChange,
}: {
  form: MerchItemInput;
  onChange: (patch: Partial<MerchItemInput>) => void;
}) {
  const defaults = getDefaultSizesForGroup(form.size_group);
  const q = form.size_quantities ?? {};
  const customSizes = form.size_group === "custom" ? Object.keys(q) : [];
  const [newSize, setNewSize] = useState("");
  const [newQty, setNewQty] = useState<number>(1);

  const setQty = (size: string, value: number) => {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    const next = { ...q, [size]: n };
    onChange({ size_quantities: next });
  };

  const setGroup = (g: string) => {
    onChange({ size_group: g, size_quantities: {} });
  };

  const addCustom = () => {
    const key = newSize.trim();
    if (!key) return toast.error("Talla no puede estar vacía.");
    if (q[key] != null) return toast.error("Esa talla ya existe.");
    const n = Math.max(1, Math.floor(Number(newQty) || 1));
    onChange({ size_quantities: { ...q, [key]: n } });
    setNewSize("");
    setNewQty(1);
  };

  const removeCustom = (key: string) => {
    const next = { ...q };
    delete next[key];
    onChange({ size_quantities: next });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-3">
      <div>
        <Label className="text-sm">Tallas y cantidades</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Define cuántas unidades vienen por talla, o marca “Sin talla”.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-2">
        <div className="space-y-0.5">
          <Label className="text-sm">Sin talla</Label>
          <p className="text-[11px] text-muted-foreground">
            Ej. accesorios, artículos únicos sin talla.
          </p>
        </div>
        <Switch
          checked={form.no_size}
          onCheckedChange={(v) =>
            onChange({ no_size: v, size_quantities: v ? {} : form.size_quantities })
          }
        />
      </div>

      {form.no_size ? (
        <div className="space-y-2">
          <Label>Unidades</Label>
          <Input
            type="number"
            min={1}
            step={1}
            value={form.unit_count}
            onChange={(e) =>
              onChange({ unit_count: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
            }
          />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label>Tipo de tallas</Label>
            <Select value={form.size_group} onValueChange={setGroup}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="franelas_hoodies">Franelas / Hoodies</SelectItem>
                <SelectItem value="pantalones">Pantalones</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.size_group !== "custom" ? (
            <div className="grid grid-cols-5 gap-2">
              {defaults.map((s) => (
                <div key={s} className="space-y-1">
                  <Label className="text-xs text-center block">{s}</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={q[s] ?? 0}
                    onChange={(e) => setQty(s, Number(e.target.value))}
                    className="text-center"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {customSizes.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sin tallas. Agrega la primera abajo.
                </p>
              ) : (
                <div className="space-y-1">
                  {customSizes.map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <span className="text-sm font-medium w-24 truncate">{s}</span>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={q[s] ?? 0}
                        onChange={(e) => setQty(s, Number(e.target.value))}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCustom(s)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2 pt-1">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Nueva talla</Label>
                  <Input
                    placeholder="Ej. XXL, 38, One Size"
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                  />
                </div>
                <div className="w-20 space-y-1">
                  <Label className="text-xs">Cant.</Label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={newQty}
                    onChange={(e) => setNewQty(Number(e.target.value))}
                  />
                </div>
                <Button type="button" size="sm" onClick={addCustom}>
                  Agregar
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SuggestedPricePanel({
  form,
  rule,
  shipment,
  onChange,
}: {
  form: MerchItemInput;
  rule: ReturnType<typeof findPricingRule>;
  shipment: { cost_per_kg_eur: number | null } | null;
  onChange: (patch: Partial<MerchItemInput>) => void;
}) {
  const totalCost = calculateTotalCost(form, shipment);
  const units = Math.max(1, calculateTotalUnits(form));
  const perUnitCost = totalCost / units;
  const pct = rule ? Number(rule.profit_percentage ?? 0) : 0;
  const baseSuggested = calculateSuggestedBasePvp(perUnitCost, pct);
  const iva = calculateIvaAmount(baseSuggested);
  const suggestedFinal = baseSuggested + iva;
  const finalPvp = getFinalPvp(form, rule, shipment);
  const manualBelow =
    form.use_manual_pvp &&
    form.pvp_manual != null &&
    Number(form.pvp_manual) > 0 &&
    Number(form.pvp_manual) < suggestedFinal;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-3 bg-muted/20">
      <div>
        <Label className="text-sm">Precio sugerido</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Se calcula desde el costo total, la ganancia del tipo y el IVA 16%.
        </p>
      </div>
      <div className="text-xs space-y-1">
        <Row k="Tipo de artículo" v={rule?.label ?? "—"} />
        <Row k={`Costo total (lote, ${units}u)`} v={`${totalCost.toFixed(2)} €`} />
        <Row k="Costo unitario" v={`${perUnitCost.toFixed(2)} €`} />
        <Row k="Ganancia configurada" v={`${pct}%`} />
        <Row k="PVP base sugerido" v={`${baseSuggested.toFixed(2)} €`} />
        <Row k={`IVA ${(IVA_RATE * 100).toFixed(0)}%`} v={`${iva.toFixed(2)} €`} />
        <Row
          k="PVP sugerido final (unit.)"
          v={<span className="font-semibold">{suggestedFinal.toFixed(2)} €</span>}
        />
      </div>
      {!shipment ? (
        <p className="text-[11px] text-muted-foreground italic">
          Este costo puede cambiar cuando se asigne un envío con costo por kg.
        </p>
      ) : null}

      <Separator />

      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label className="text-sm">Usar PVP manual</Label>
          <p className="text-[11px] text-muted-foreground">
            Ignora el sugerido y usa un precio propio.
          </p>
        </div>
        <Switch
          checked={form.use_manual_pvp}
          onCheckedChange={(v) => onChange({ use_manual_pvp: v })}
        />
      </div>

      {form.use_manual_pvp ? (
        <div className="space-y-2">
          <Label>PVP manual (unit.)</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={form.pvp_manual ?? ""}
            onChange={(e) =>
              onChange({
                pvp_manual: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
          {manualBelow ? (
            <p className="text-[11px] text-amber-600 dark:text-amber-500">
              Este PVP está por debajo del sugerido para este tipo de artículo.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-md border border-border/60 bg-background p-2 text-xs flex items-center justify-between">
        <span className="text-muted-foreground">PVP final aplicado (unit.)</span>
        <span className="font-semibold">
          {finalPvp != null ? `${finalPvp.toFixed(2)} €` : "—"}
        </span>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  );
}
