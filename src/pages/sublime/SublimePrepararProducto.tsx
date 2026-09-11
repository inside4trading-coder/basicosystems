import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Circle, Loader2, Save, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { InvThumb } from "@/components/sublime/inventario/InvThumb";
import { supabase } from "@/integrations/supabase/client";
import {
  useSublimeInventory,
  useSublimeLocations,
  useUpdateSublimeProduct,
  useUpdateSublimeVariant,
} from "@/hooks/useSublimeInventory";
import { POS_BLOCK_LABEL, posBlockers, posWarnings, variantDisplay } from "@/lib/sublimeInventory";
import { PREP_CHECKLIST, prepDone, prepPercent, prepStatus } from "@/lib/sublimePrep";
import { detectSkuConvention, displaySku, isValidSku, nextSublimeSku, normalizeSku, skuConflict } from "@/lib/sublimeSku";
import { PREPARATION_LABEL } from "@/types/sublimeHub";

interface VariantDraft {
  id: string;
  sku: string;
  size: string;
  color: string;
  full: string;
  current: string;
  active: boolean;
}

export default function SublimePrepararProducto() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useSublimeInventory();
  const { data: locations = [] } = useSublimeLocations();
  const updProduct = useUpdateSublimeProduct();
  const updVariant = useUpdateSublimeVariant();

  const rows = useMemo(() => (data?.rows ?? []).filter((r) => r.product.id === id), [data, id]);
  const product = rows[0]?.product ?? null;
  const allVariants = data?.variants ?? [];

  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [productActive, setProductActive] = useState(true);
  const [drafts, setDrafts] = useState<VariantDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!product) return;
    setTitle(product.name ?? "");
    setBrand(product.brand ?? "");
    setCategory(product.category ?? "");
    setDescription(product.notes ?? "");
    setImageUrl(product.main_image_url ?? "");
    setProductActive(!!product.is_active);
    setDrafts(
      rows.map((r) => ({
        id: r.variant.id,
        sku: displaySku(r.variant.sku) ?? "",
        size: r.variant.size ?? "",
        color: r.variant.color ?? "",
        full: r.variant.full_price_ref == null ? "" : String(r.variant.full_price_ref),
        current: r.variant.current_price_ref == null ? "" : String(r.variant.current_price_ref),
        active: !!r.variant.is_active,
      }))
    );
  }, [product?.id, rows.length, data]);

  /** SKU provenientes de Abastecimiento (lotes de compra) para poder adoptarlos. */
  const lotIds = rows.flatMap((r) => r.lots.map((l) => l.merch_item_id)).filter(Boolean);
  const { data: sourceSkus = {} } = useQuery({
    queryKey: ["sublime_prep_source_skus", id, lotIds.join(",")],
    enabled: lotIds.length > 0,
    queryFn: async () => {
      const { data: items } = await (supabase as any)
        .from("sublime_merch_items")
        .select("id, sku_web")
        .in("id", Array.from(new Set(lotIds)));
      const map: Record<string, string> = {};
      for (const it of items ?? []) if (isValidSku(it.sku_web)) map[it.id] = normalizeSku(it.sku_web);
      return map;
    },
  });

  const convention = useMemo(() => detectSkuConvention(allVariants.map((v) => v.sku)), [allVariants]);

  const posLocationIds = useMemo(
    () => new Set(locations.filter((l) => l.sells_in_pos && l.is_active).map((l) => l.id)),
    [locations]
  );

  const prepInput = {
    product: { name: title, notes: description, main_image_url: imageUrl },
    variants: drafts.map((d) => ({ sku: d.sku, size: d.size, current_price_ref: Number(d.current) || 0 })),
  };
  const pct = prepPercent(prepInput);
  const done = prepDone(prepInput);
  const status = prepStatus(pct, !!product?.woo_product_id);

  const setDraft = (vid: string, patch: Partial<VariantDraft>) =>
    setDrafts((prev) => prev.map((d) => (d.id === vid ? { ...d, ...patch } : d)));

  const generateSku = (vid: string) => {
    const taken = [
      ...allVariants.filter((v) => !drafts.some((d) => d.id === v.id)).map((v) => v.sku),
      ...drafts.filter((d) => d.id !== vid).map((d) => d.sku),
    ];
    setDraft(vid, { sku: nextSublimeSku(taken, convention) });
  };

  const sourceSkuFor = (vid: string) => {
    const row = rows.find((r) => r.variant.id === vid);
    for (const lot of row?.lots ?? []) {
      const s = sourceSkus[lot.merch_item_id];
      if (s) return s;
    }
    return null;
  };

  const save = async () => {
    if (!product) return;
    // Validación de SKU: únicos, no vacíos, sin placeholders.
    const seen = new Set<string>();
    for (const d of drafts) {
      if (!d.sku.trim()) continue;
      const conflict = skuConflict(d.sku, d.id, allVariants.map((v) => ({ id: v.id, sku: v.sku })));
      if (conflict) return toast.error(conflict);
      const norm = normalizeSku(d.sku);
      if (seen.has(norm)) return toast.error(`El SKU ${norm} está repetido en este producto.`);
      seen.add(norm);
    }

    setSaving(true);
    try {
      await updProduct.mutateAsync({
        id: product.id,
        patch: {
          name: title.trim() || product.name,
          brand: brand.trim(),
          category: category.trim() || null,
          notes: description.trim() || null,
          main_image_url: imageUrl.trim() || null,
          is_active: productActive,
        } as any,
      });
      for (const d of drafts) {
        await updVariant.mutateAsync({
          id: d.id,
          patch: {
            sku: d.sku.trim() ? normalizeSku(d.sku) : null,
            size: d.size.trim() || null,
            color: d.color.trim() || null,
            full_price_ref: d.full.trim() === "" ? null : Number(d.full),
            current_price_ref: d.current.trim() === "" ? null : Number(d.current),
            is_active: d.active,
          } as any,
        });
      }
      toast.success("Preparación guardada. Se recalculó la elegibilidad POS.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar la preparación.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando producto…</p>;
  if (!product)
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/sublime/abastecimiento/preparacion")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver a Preparación
        </Button>
        <Card className="p-8 rounded-2xl text-center text-sm text-muted-foreground">
          Este producto ya no existe en el catálogo Sublime.
        </Card>
      </div>
    );

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={() => navigate("/sublime/abastecimiento/preparacion")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> Volver a Preparación
      </Button>

      <HubHeader
        icon={Sparkles}
        title={product.name}
        subtitle="Completa los datos comerciales de este producto real"
        actions={
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar preparación
          </Button>
        }
      />

      <Card className="p-5 rounded-2xl border-border/60 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <InvThumb url={imageUrl || product.main_image_url} alt={product.name} />
            <div>
              <p className="text-xs text-muted-foreground">Preparación web</p>
              <p className="text-lg font-bold tabular-nums">{pct}%</p>
            </div>
          </div>
          <Badge variant={status === "published" ? "default" : "secondary"}>{PREPARATION_LABEL[status]}</Badge>
        </div>
        <Progress value={pct} />
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {PREP_CHECKLIST.map((item) => (
            <span
              key={item.key}
              className={`inline-flex items-center gap-1 text-xs ${done[item.key] ? "text-foreground" : "text-muted-foreground"}`}
            >
              {done[item.key] ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
              {item.label}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          La preparación web no bloquea la venta física: una variante con SKU, precio y stock en tienda ya puede
          venderse aunque falten descripción o imágenes.
        </p>
      </Card>

      <Card className="p-5 rounded-2xl border-border/60 space-y-4">
        <p className="text-sm font-semibold">Datos comerciales</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Título comercial</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Marca</Label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Imagen principal (URL o ruta guardada)</Label>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Descripción</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Producto activo</p>
            <p className="text-xs text-muted-foreground">Si se desactiva, ninguna variante puede venderse.</p>
          </div>
          <Switch checked={productActive} onCheckedChange={setProductActive} />
        </div>
      </Card>

      <Card className="rounded-2xl border-border/60 overflow-x-auto">
        <div className="p-4 pb-0">
          <p className="text-sm font-semibold">Variantes y SKU definitivo</p>
          <p className="text-xs text-muted-foreground">
            Convención detectada: {convention.prefix}
            {"0".repeat(Math.max(0, convention.digits - 1))}1 · siguiente libre {nextSublimeSku(allVariants.map((v) => v.sku), convention)}
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variante</TableHead>
              <TableHead>Talla</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>SKU definitivo</TableHead>
              <TableHead className="text-right">Precio full</TableHead>
              <TableHead className="text-right">Precio vigente</TableHead>
              <TableHead className="text-right">Stock tienda</TableHead>
              <TableHead>Activa</TableHead>
              <TableHead>POS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drafts.map((d) => {
              const row = rows.find((r) => r.variant.id === d.id)!;
              const posStock = row.stocks
                .filter((s) => posLocationIds.has(s.location_id))
                .reduce((a, s) => a + Number(s.quantity_available ?? 0), 0);
              const blockers = posBlockers({
                product: { is_active: productActive, category },
                variant: {
                  is_active: d.active,
                  sku: d.sku,
                  size: d.size,
                  full_price_ref: d.full === "" ? null : Number(d.full),
                  current_price_ref: d.current === "" ? null : Number(d.current),
                },
                posStock,
              });
              const warnings = posWarnings({
                product: { category, main_image_url: imageUrl },
                variant: {
                  size: d.size,
                  color: d.color,
                  full_price_ref: d.full === "" ? null : Number(d.full),
                  current_price_ref: d.current === "" ? null : Number(d.current),
                },
              });
              const source = sourceSkuFor(d.id);
              return (
                <TableRow key={d.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {variantDisplay({ size: d.size || null, color: d.color || null })}
                  </TableCell>
                  <TableCell>
                    <Input className="w-24" value={d.size} onChange={(e) => setDraft(d.id, { size: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input className="w-28" value={d.color} onChange={(e) => setDraft(d.id, { color: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        className="w-36 font-mono"
                        placeholder="Sin asignar"
                        value={d.sku}
                        onChange={(e) => setDraft(d.id, { sku: e.target.value.toUpperCase() })}
                      />
                      <Button size="sm" variant="outline" onClick={() => generateSku(d.id)}>
                        <Wand2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {source && normalizeSku(d.sku) !== source && (
                      <button
                        type="button"
                        className="mt-1 text-xs text-primary underline"
                        onClick={() => setDraft(d.id, { sku: source })}
                      >
                        Adoptar {source} (Abastecimiento)
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      className="w-24 text-right"
                      inputMode="decimal"
                      value={d.full}
                      onChange={(e) => setDraft(d.id, { full: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      className="w-24 text-right"
                      inputMode="decimal"
                      value={d.current}
                      onChange={(e) => setDraft(d.id, { current: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{posStock}</TableCell>
                  <TableCell>
                    <Switch checked={d.active} onCheckedChange={(v) => setDraft(d.id, { active: v })} />
                  </TableCell>
                  <TableCell>
                    {blockers.length === 0 ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">Listo para POS</Badge>
                    ) : (
                      <div className="space-y-1">
                        <Badge variant="outline">No listo</Badge>
                        <p className="text-[11px] text-muted-foreground">
                          {blockers.map((b) => POS_BLOCK_LABEL[b]).join(" · ")}
                        </p>
                      </div>
                    )}
                    {warnings.length > 0 && (
                      <p className="text-[11px] text-amber-600 mt-1">Web: {warnings.join(" · ")}</p>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
