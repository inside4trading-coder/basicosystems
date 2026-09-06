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
  calculateShippingCost,
  calculateSuggestedBasePvp,
  calculateIvaAmount,
  calculateConsignmentCommission,
  calculateConsignmentNet,
  getConsignmentBreakdown,
  getFinalPvp,
  findPricingRule,
  IVA_RATE,
  getDefaultSizesForGroup,
  normalizeSizeQuantities,
  validatePhotoFile,
  validatePhotoUrl,
  uploadSublimeMerchPhoto,
} from "@/lib/sublimeMerch";
import { useMerchBrandConfig } from "./brand";
import { Badge } from "@/components/ui/badge";

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
  is_consignment: false,
  consignment_commission_pct: 0,
  consignment_commission_amount: 0,
});


interface PendingFile {
  file: File;
  previewUrl: string;
}

export function ItemEditorSheet({ open, onOpenChange, item }: Props) {
  const { label: brandLabel } = useMerchBrandConfig();
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
              is_consignment: Boolean(item.is_consignment),
              consignment_commission_pct: Number(item.consignment_commission_pct ?? 0),
              consignment_commission_amount: Number(item.consignment_commission_amount ?? 0),
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
    files: FileList | File[] | null,

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
    if (form.is_consignment && (form.consignment_commission_pct < 0 || form.consignment_commission_pct > 100))
      return toast.error("La comisión debe estar entre 0% y 100%.");

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

    const commissionAmount = calculateConsignmentCommission(form, currentRule, currentShipment);

    const inputToSave: MerchItemInput = {
      ...form,
      consignment_commission_pct: form.is_consignment ? Number(form.consignment_commission_pct ?? 0) : 0,
      consignment_commission_amount: commissionAmount,
    };

    setSaving(true);
    try {
      if (isEdit && item) {
        await updateItem.mutateAsync({ id: item.id, input: inputToSave, wasUploaded });
        toast.success("Producto guardado.");
        onOpenChange(false);
      } else {
        const created = await createItem.mutateAsync(inputToSave);
        const totalPhotos =
          pendingOrigen.length + pendingWebFiles.length + pendingWebUrls.length;
        let done = 0;
        let uploaded = 0;
        let failures = 0;
        const tick = () => {
          done++;
          setProgress({ done, total: totalPhotos });
        };
        if (totalPhotos > 0) setProgress({ done: 0, total: totalPhotos });
        for (const p of pendingOrigen) {
          try {
            const url = await uploadSublimeMerchPhoto(created.id, "origen", p.file);
            await addPhotoToItem.mutateAsync({ itemId: created.id, type: "origen", url });
            uploaded++;
          } catch {
            failures++;
          }
          tick();
        }
        for (const p of pendingWebFiles) {
          try {
            const url = await uploadSublimeMerchPhoto(created.id, "web", p.file);
            await addPhotoToItem.mutateAsync({ itemId: created.id, type: "web", url });
            uploaded++;
          } catch {
            failures++;
          }
          tick();
        }
        for (const u of pendingWebUrls) {
          try {
            await addWebPhotoUrl.mutateAsync({ itemId: created.id, url: u });
            uploaded++;
          } catch {
            failures++;
          }
          tick();
        }
        if (failures > 0) {
          toast.warning(
            "Producto creado, pero algunas fotos no pudieron subirse. Puedes agregarlas editando el producto.",
          );
        } else {
          toast.success(
            uploaded > 0
              ? `Producto creado con ${uploaded} foto${uploaded === 1 ? "" : "s"}.`
              : "Producto creado.",
          );
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
  onAdd: (files: FileList | File[] | null) => void;
  onRemove: (idx: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

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
          onClick={() => setCameraOpen(true)}
        >
          <Camera className="h-4 w-4 mr-2" />
          Cámara
        </Button>
        <CameraCaptureDialog
          open={cameraOpen}
          onOpenChange={setCameraOpen}
          onCapture={(files) => onAdd(files)}
          onUnavailable={() => cameraRef.current?.click()}
        />
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
  const { label: brandLabel } = useMerchBrandConfig();
  const hasShipment = !!(shipment && shipment.cost_per_kg_eur != null);
  const units = Math.max(1, calculateTotalUnits(form));
  const perUnitBuy = Number(form.precio_compra ?? 0);
  const buyTotal = perUnitBuy * units;
  const shippingCost = hasShipment ? calculateShippingCost(form, shipment) : 0;
  const totalCost = buyTotal + shippingCost;
  const perUnitCost = totalCost / units;
  const pct = rule ? Number(rule.profit_percentage ?? 0) : 0;
  const baseSuggested = calculateSuggestedBasePvp(perUnitCost, pct);
  const iva = calculateIvaAmount(baseSuggested);
  const suggestedFinal = baseSuggested + iva;
  const finalPvp = getFinalPvp(form, rule, hasShipment ? shipment : null);
  const manualBelow =
    form.use_manual_pvp &&
    form.pvp_manual != null &&
    Number(form.pvp_manual) > 0 &&
    Number(form.pvp_manual) < suggestedFinal;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-3 bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm">
          {hasShipment ? "PVP sugerido final con envío" : "PVP sugerido tentativo"}
        </Label>
        <Badge variant={hasShipment ? "default" : "secondary"} className="text-[10px]">
          {hasShipment ? "Final" : "Tentativo"}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {hasShipment
          ? "Este precio incluye el envío calculado por peso y costo por kg del envío asignado."
          : "Este precio aún no incluye envío. Se calcula con el costo de compra, la ganancia configurada y el IVA 16%. El PVP final puede cambiar al asignar un envío."}
      </p>

      <div className="text-xs space-y-1">
        <Row k="Tipo de artículo" v={rule?.label ?? "—"} />
        <Row k={`Costo compra lote (${units}u)`} v={`${buyTotal.toFixed(2)} €`} />
        <Row k="Costo unitario compra" v={`${perUnitBuy.toFixed(2)} €`} />
        {hasShipment ? (
          <>
            <Row k="Peso total" v={`${Number(form.peso_kg ?? 0).toFixed(3)} kg`} />
            <Row
              k="Costo por kg del envío"
              v={`${Number(shipment?.cost_per_kg_eur ?? 0).toFixed(2)} €`}
            />
            <Row k="Envío calculado" v={`${shippingCost.toFixed(2)} €`} />
            <Row k="Costo total con envío" v={`${totalCost.toFixed(2)} €`} />
          </>
        ) : null}
        <Row k="Ganancia configurada" v={`${pct}%`} />
        <Row
          k={hasShipment ? "PVP base final" : "PVP base tentativo"}
          v={`${baseSuggested.toFixed(2)} €`}
        />
        <Row k={`IVA ${(IVA_RATE * 100).toFixed(0)}%`} v={`${iva.toFixed(2)} €`} />
        <Row
          k={
            hasShipment
              ? "PVP sugerido final (unit.)"
              : "PVP sugerido tentativo (unit.)"
          }
          v={<span className="font-semibold">{suggestedFinal.toFixed(2)} €</span>}
        />
      </div>
      {!hasShipment ? (
        <p className="text-[11px] text-amber-600 dark:text-amber-500 italic">
          Falta envío: asigna este producto a un envío para obtener el PVP final.
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
        <span className="text-muted-foreground">
          {form.use_manual_pvp
            ? "PVP manual aplicado (unit.)"
            : hasShipment
              ? "PVP final aplicado (unit.)"
              : "PVP aplicado tentativo (unit.)"}
        </span>
        <span className="font-semibold">
          {finalPvp != null ? `${finalPvp.toFixed(2)} €` : "—"}
        </span>
      </div>

      <Separator />

      <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Venta en consignación</Label>
              {form.is_consignment ? (
                <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400 text-[10px] whitespace-nowrap">
                  CONSIGNACIÓN · {Number(form.consignment_commission_pct ?? 0)}% {brandLabel}
                </Badge>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              La comisión se descuenta del PVP final y nunca se suma al coste de compra.
            </p>
          </div>
          <Switch
            checked={form.is_consignment}
            onCheckedChange={(value) => onChange({
              is_consignment: value,
              consignment_commission_pct: value ? Number(form.consignment_commission_pct ?? 0) : 0,
              consignment_commission_amount: 0,
            })}
          />
        </div>

        {form.is_consignment ? (
          <>
            <div className="space-y-2">
              <Label>Comisión {brandLabel} (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.consignment_commission_pct}
                onChange={(e) => onChange({
                  consignment_commission_pct: e.target.value === "" ? 0 : Number(e.target.value),
                })}
              />
            </div>
            {(() => {
              const b = getConsignmentBreakdown(form, rule, hasShipment ? shipment : null);
              const eur = (n: number) => `${n.toFixed(2)} €`;
              return (
                <div className="space-y-1 rounded-md border border-border/60 bg-background p-2 text-xs">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Por unidad</div>
                  <Row k="PVP base (propietario)" v={b == null ? "—" : eur(b.basePvpUnit)} />
                  <Row k={`PVP final con IVA (base ÷ (1 − ${b?.pct ?? 0}%))`} v={b == null ? "—" : <span className="font-semibold">{eur(b.finalPvpUnit)}</span>} />
                  <Row k={`− IVA incluido (${(IVA_RATE * 100).toFixed(0)}%)`} v={b == null ? "—" : eur(b.ivaUnit)} />
                  <Row k={`− Comisión ${brandLabel} (${b?.pct ?? 0}%)`} v={b == null ? "—" : eur(b.commissionUnit)} />
                  <Row k="= Neto propietario" v={b == null ? "—" : eur(b.netOwnerUnit)} />
                  <Separator className="my-1" />
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Total {b?.units ?? units} unidad{(b?.units ?? units) === 1 ? "" : "es"}
                  </div>
                  <Row k="PVP final total" v={b == null ? "—" : <span className="font-semibold">{eur(b.finalPvpTotal)}</span>} />
                  <Row k="IVA incluido total" v={b == null ? "—" : eur(b.ivaTotal)} />
                  <Row k={`Comisión ${brandLabel} total`} v={b == null ? "—" : eur(b.commissionTotal)} />
                  <Row k="Neto propietario total" v={b == null ? "—" : eur(b.netOwnerTotal)} />

                </div>
              );
            })()}

          </>
        ) : null}
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
