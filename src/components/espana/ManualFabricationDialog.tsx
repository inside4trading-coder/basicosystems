import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertTriangle, Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const MANUAL_REASONS: { value: string; label: string }[] = [
  { value: "reemplazo", label: "Reemplazo" },
  { value: "error_pedido", label: "Error de pedido" },
  { value: "defecto", label: "Defecto" },
  { value: "cambio_talla", label: "Cambio de talla" },
  { value: "muestra", label: "Muestra" },
  { value: "colaboracion", label: "Colaboración / regalo" },
  { value: "produccion_interna", label: "Producción interna" },
  { value: "pedido_especial", label: "Pedido especial" },
  { value: "otro", label: "Otro" },
];

export const MANUAL_REASON_LABEL: Record<string, string> = Object.fromEntries(
  MANUAL_REASONS.map((r) => [r.value, r.label]),
);

interface ProductRow { id: string; name: string; sku: string | null }
interface VariantRow { id: string; size: string | null; color: string | null; variant_sku: string | null }

const emptyShip = {
  ship_to_name: "",
  ship_to_phone: "",
  ship_to_address: "",
  ship_to_city: "",
  ship_to_province: "",
  ship_to_postal_code: "",
  ship_to_country: "España",
};

export default function ManualFabricationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [variantId, setVariantId] = useState<string>("");
  const [productOpen, setProductOpen] = useState(false);
  const [quantity, setQuantity] = useState<string>("1");
  const [noShipping, setNoShipping] = useState(false);
  const [ship, setShip] = useState({ ...emptyShip });
  const [reason, setReason] = useState<string>("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("normal");
  const [saving, setSaving] = useState(false);
  const [recipe, setRecipe] = useState<{ loading: boolean; ok: boolean | null; reason?: string }>({ loading: false, ok: null });

  useEffect(() => {
    if (!open) return;
    setProducts([]);
    supabase
      .from("esp_products")
      .select("id,name,sku")
      .order("name")
      .limit(2000)
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setProducts((data || []) as ProductRow[]);
      });
  }, [open]);

  useEffect(() => {
    setVariantId("");
    setVariants([]);
    setRecipe({ loading: false, ok: null });
    if (!productId) return;
    supabase
      .from("esp_product_variants")
      .select("id,size,color,variant_sku")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setVariants((data || []) as VariantRow[]);
      });
  }, [productId]);

  // Preflight de receta (sin crear nada): usa las recetas activas existentes.
  useEffect(() => {
    if (!productId) { setRecipe({ loading: false, ok: null }); return; }
    let cancelled = false;
    setRecipe({ loading: true, ok: null });
    const t = setTimeout(async () => {
      let query = supabase
        .from("esp_product_material_recipes")
        .select("id,variant_id")
        .eq("status", "active")
        .eq("product_id", productId);
      const { data, error } = await query;
      if (cancelled) return;
      if (error) { setRecipe({ loading: false, ok: null }); return; }
      const rows = data || [];
      const hasVariant = variantId ? rows.some((r: any) => r.variant_id === variantId) : false;
      const hasProduct = rows.some((r: any) => !r.variant_id);
      setRecipe({ loading: false, ok: hasVariant || hasProduct, reason: "no_recipe" });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [productId, variantId]);

  const selectedProduct = useMemo(() => products.find((p) => p.id === productId) || null, [products, productId]);
  const selectedVariant = useMemo(() => variants.find((v) => v.id === variantId) || null, [variants, variantId]);

  const variantLabel = (v: VariantRow | null) =>
    v ? [v.size, v.color].filter(Boolean).join(" · ") || v.variant_sku || "Variante" : null;

  const qtyNum = Number(quantity);
  const shippingValid =
    noShipping ||
    (ship.ship_to_name.trim() &&
      ship.ship_to_phone.trim() &&
      ship.ship_to_address.trim() &&
      ship.ship_to_city.trim() &&
      ship.ship_to_province.trim() &&
      ship.ship_to_postal_code.trim() &&
      ship.ship_to_country.trim());

  const canSubmit =
    !!productId &&
    (variants.length === 0 || !!variantId) &&
    Number.isInteger(qtyNum) &&
    qtyNum > 0 &&
    !!reason &&
    (reason !== "otro" || reasonDetail.trim().length > 0) &&
    !!shippingValid &&
    recipe.ok === true &&
    !saving;

  const reset = () => {
    setProductId(""); setVariantId(""); setQuantity("1"); setNoShipping(false);
    setShip({ ...emptyShip }); setReason(""); setReasonDetail(""); setNotes(""); setPriority("normal");
    setRecipe({ loading: false, ok: null });
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    const payload: any = {
      source_type: "manual",
      product_id: productId,
      variant_id: variantId || null,
      sku: selectedVariant?.variant_sku || selectedProduct?.sku || null,
      product_name: selectedProduct?.name || null,
      variant_label: variantLabel(selectedVariant),
      quantity: qtyNum,
      status: "pending",
      priority,
      notes: notes.trim() || null,
      manual_reason: reason,
      manual_reason_detail: reason === "otro" ? reasonDetail.trim() : (reasonDetail.trim() || null),
      requires_shipping: !noShipping,
      ...(noShipping ? {} : ship),
    };
    const { data: userRes } = await supabase.auth.getUser();
    if (userRes?.user?.id) payload.created_by = userRes.user.id;

    const { error } = await supabase.from("esp_fabrication_requests").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Orden manual creada · pendiente de fabricación");
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Nueva orden manual de fabricación</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Producto */}
          <div className="space-y-1.5">
            <Label>Producto WooCommerce *</Label>
            <Popover open={productOpen} onOpenChange={setProductOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedProduct ? (
                    <span className="truncate">{selectedProduct.name}{selectedProduct.sku ? ` · ${selectedProduct.sku}` : ""}</span>
                  ) : <span className="text-muted-foreground">Buscar por nombre o SKU…</span>}
                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                  <CommandInput placeholder="Nombre o SKU…" />
                  <CommandList>
                    <CommandEmpty>Sin resultados.</CommandEmpty>
                    <CommandGroup>
                      {products.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.name} ${p.sku || ""}`}
                          onSelect={() => { setProductId(p.id); setProductOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", productId === p.id ? "opacity-100" : "opacity-0")} />
                          <span className="truncate">{p.name}</span>
                          {p.sku && <span className="ml-2 text-xs font-mono text-muted-foreground">{p.sku}</span>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Variante + cantidad */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Variante *</Label>
              <Select value={variantId} onValueChange={setVariantId} disabled={!productId || variants.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={!productId ? "Selecciona un producto" : variants.length === 0 ? "Sin variantes" : "Selecciona talla / variante"} />
                </SelectTrigger>
                <SelectContent>
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {variantLabel(v)}{v.variant_sku ? ` · ${v.variant_sku}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cantidad *</Label>
              <Input type="number" min={1} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>

          {/* Receta */}
          {productId && (
            recipe.loading ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Comprobando receta…</p>
            ) : recipe.ok === false ? (
              <Card className="p-3 border-l-4 border-l-amber-500 bg-amber-500/5 text-xs">
                <p className="font-bold flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Producto sin receta activa</p>
                <p className="text-muted-foreground mt-1">No se puede crear la orden. Crea una receta en Blanks / DTF → Recetas.</p>
              </Card>
            ) : recipe.ok === true ? (
              <p className="text-xs text-emerald-600 flex items-center gap-1"><Check className="h-3 w-3" /> Receta disponible</p>
            ) : null
          )}

          {/* Envío */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center gap-2">
              <Checkbox id="noship" checked={noShipping} onCheckedChange={(v) => setNoShipping(!!v)} />
              <Label htmlFor="noship" className="font-normal">No requiere envío / recogida interna</Label>
            </div>
            {!noShipping && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Nombre *</Label><Input value={ship.ship_to_name} onChange={(e) => setShip({ ...ship, ship_to_name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Teléfono *</Label><Input value={ship.ship_to_phone} onChange={(e) => setShip({ ...ship, ship_to_phone: e.target.value })} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Dirección *</Label><Input value={ship.ship_to_address} onChange={(e) => setShip({ ...ship, ship_to_address: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Ciudad *</Label><Input value={ship.ship_to_city} onChange={(e) => setShip({ ...ship, ship_to_city: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Provincia *</Label><Input value={ship.ship_to_province} onChange={(e) => setShip({ ...ship, ship_to_province: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Código postal *</Label><Input value={ship.ship_to_postal_code} onChange={(e) => setShip({ ...ship, ship_to_postal_code: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>País *</Label><Input value={ship.ship_to_country} onChange={(e) => setShip({ ...ship, ship_to_country: e.target.value })} /></div>
              </div>
            )}
          </div>

          {/* Motivo / prioridad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t pt-3">
            <div className="space-y-1.5">
              <Label>Motivo *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue placeholder="Selecciona un motivo" /></SelectTrigger>
                <SelectContent>
                  {MANUAL_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {reason === "otro" && (
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Describe el motivo *</Label>
                <Input value={reasonDetail} onChange={(e) => setReasonDetail(e.target.value)} maxLength={300} />
              </div>
            )}
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Notas internas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            La orden se crea en estado Pendiente. Los materiales solo se consumen al pulsar “Fabricar”. No se crea ni modifica nada en WooCommerce.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Crear orden manual
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
