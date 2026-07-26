import { useEffect, useRef, useState } from "react";
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
});

interface PendingFile {
  file: File;
  previewUrl: string;
}

export function ItemEditorSheet({ open, onOpenChange, item }: Props) {
  const [form, setForm] = useState<MerchItemInput>(empty());
  const { createItem, updateItem, addPhotoToItem, addWebPhotoUrl } = useMerchMutations();
  const isEdit = Boolean(item?.id);
  const wasUploaded = Boolean(item?.subido_al_sistema);
  const { data: liveItem } = useSublimeItem(isEdit && open ? item?.id : null);
  const currentItem = liveItem ?? item ?? null;

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

    if (form.subido_al_sistema) {
      const check = canMarkUploaded(form);
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
