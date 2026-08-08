import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertTriangle, Check, ChevronsUpDown, Loader2, Plus, Trash2 } from "lucide-react";
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

interface Line {
  key: string;
  productId: string;
  variantId: string;
  quantity: string;
  variants: VariantRow[];
  recipe: { loading: boolean; ok: boolean | null };
}

const newLine = (): Line => ({
  key: Math.random().toString(36).slice(2),
  productId: "",
  variantId: "",
  quantity: "1",
  variants: [],
  recipe: { loading: false, ok: null },
});

const variantLabel = (v: VariantRow | null | undefined) =>
  v ? [v.size, v.color].filter(Boolean).join(" · ") || v.variant_sku || "Variante" : null;

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
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [recipient, setRecipient] = useState("");
  const [reason, setReason] = useState("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("normal");
  const [saving, setSaving] = useState(false);
  const [openProductFor, setOpenProductFor] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
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

  const patchLine = (key: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const selectProduct = async (key: string, productId: string) => {
    patchLine(key, { productId, variantId: "", variants: [], recipe: { loading: true, ok: null } });
    const { data } = await supabase
      .from("esp_product_variants")
      .select("id,size,color,variant_sku")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true });
    patchLine(key, { variants: (data || []) as VariantRow[] });
    void checkRecipe(key, productId, "");
  };

  const checkRecipe = async (key: string, productId: string, variantId: string) => {
    if (!productId) { patchLine(key, { recipe: { loading: false, ok: null } }); return; }
    patchLine(key, { recipe: { loading: true, ok: null } });
    const { data, error } = await supabase
      .from("esp_product_material_recipes")
      .select("id,variant_id")
      .eq("status", "active")
      .eq("product_id", productId);
    if (error) { patchLine(key, { recipe: { loading: false, ok: null } }); return; }
    const rows = data || [];
    const ok = rows.some((r: any) => !r.variant_id) || (!!variantId && rows.some((r: any) => r.variant_id === variantId));
    patchLine(key, { recipe: { loading: false, ok } });
  };

  const totalUnits = useMemo(
    () => lines.reduce((s, l) => s + (Number.isInteger(Number(l.quantity)) ? Math.max(0, Number(l.quantity)) : 0), 0),
    [lines],
  );

  const linesValid = lines.length > 0 && lines.every((l) => {
    const q = Number(l.quantity);
    return !!l.productId && (l.variants.length === 0 || !!l.variantId) && Number.isInteger(q) && q > 0 && l.recipe.ok === true;
  });

  const missingRecipe = lines.filter((l) => l.productId && l.recipe.ok === false);

  const canSubmit =
    recipient.trim().length > 0 &&
    linesValid &&
    !!reason &&
    (reason !== "otro" || reasonDetail.trim().length > 0) &&
    !saving;

  const reset = () => {
    setLines([newLine()]); setRecipient(""); setReason(""); setReasonDetail(""); setNotes(""); setPriority("normal");
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const createdBy = userRes?.user?.id || null;

    const payloads: any[] = [];
    for (const l of lines) {
      const product = products.find((p) => p.id === l.productId) || null;
      const variant = l.variants.find((v) => v.id === l.variantId) || null;
      const qty = Number(l.quantity);
      for (let i = 0; i < qty; i++) {
        payloads.push({
          source_type: "manual",
          product_id: l.productId,
          variant_id: l.variantId || null,
          sku: variant?.variant_sku || product?.sku || null,
          product_name: product?.name || null,
          variant_label: variantLabel(variant),
          quantity: 1,
          status: "pending",
          priority,
          notes: notes.trim() || null,
          manual_reason: reason,
          manual_reason_detail: reason === "otro" ? reasonDetail.trim() : (reasonDetail.trim() || null),
          requires_shipping: true,
          ship_to_name: recipient.trim(),
          ...(createdBy ? { created_by: createdBy } : {}),
        });
      }
    }

    const { error } = await supabase.from("esp_fabrication_requests").insert(payloads);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${payloads.length} órdenes manuales creadas · pendientes`);
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Nueva orden manual de fabricación</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <Label>Nombre / destinatario *</Label>
            <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Ej. Juan Pérez / Tienda Arturo Soria" maxLength={200} />
          </div>

          <div className="space-y-2 border-t pt-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Prendas</Label>
            {lines.map((l, idx) => {
              const product = products.find((p) => p.id === l.productId) || null;
              return (
                <Card key={l.key} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">Prenda {idx + 1}</span>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      disabled={lines.length === 1}
                      onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-6">
                      <Popover open={openProductFor === l.key} onOpenChange={(o) => setOpenProductFor(o ? l.key : null)}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                            {product ? (
                              <span className="truncate">{product.name}</span>
                            ) : <span className="text-muted-foreground">Producto WooCommerce…</span>}
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
                                    onSelect={() => { setOpenProductFor(null); void selectProduct(l.key, p.id); }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", l.productId === p.id ? "opacity-100" : "opacity-0")} />
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

                    <div className="sm:col-span-4">
                      <Select
                        value={l.variantId}
                        onValueChange={(v) => { patchLine(l.key, { variantId: v }); void checkRecipe(l.key, l.productId, v); }}
                        disabled={!l.productId || l.variants.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={!l.productId ? "Variante" : l.variants.length === 0 ? "Sin variantes" : "Talla / variante"} />
                        </SelectTrigger>
                        <SelectContent>
                          {l.variants.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {variantLabel(v)}{v.variant_sku ? ` · ${v.variant_sku}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="sm:col-span-2">
                      <Input
                        type="number" min={1} step={1} value={l.quantity}
                        onChange={(e) => patchLine(l.key, { quantity: e.target.value })}
                      />
                    </div>
                  </div>

                  {l.productId && (
                    l.recipe.loading ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Comprobando receta…</p>
                    ) : l.recipe.ok === true ? (
                      <p className="text-xs text-emerald-600 flex items-center gap-1"><Check className="h-3 w-3" /> Receta disponible</p>
                    ) : l.recipe.ok === false ? (
                      <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Sin receta activa · crea la receta en Blanks / DTF</p>
                    ) : null
                  )}
                </Card>
              );
            })}

            <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, newLine()])}>
              <Plus className="h-4 w-4 mr-1" /> Agregar otra prenda
            </Button>
          </div>

          {missingRecipe.length > 0 && (
            <Card className="p-3 border-l-4 border-l-amber-500 bg-amber-500/5 text-xs">
              <p className="font-bold flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Recetas faltantes</p>
              <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                {missingRecipe.map((l) => {
                  const p = products.find((x) => x.id === l.productId);
                  const v = l.variants.find((x) => x.id === l.variantId);
                  return <li key={l.key}>{p?.name || "Producto"}{v ? ` · ${variantLabel(v)}` : ""}</li>;
                })}
              </ul>
            </Card>
          )}

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
            {totalUnits > 0 && <span className="font-bold text-foreground">Se crearán {totalUnits} órdenes individuales de fabricación. </span>}
            Cada unidad es una solicitud independiente en estado Pendiente. Los materiales solo se consumen al pulsar “Fabricar”. No se crea ni modifica nada en WooCommerce.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Crear órdenes{totalUnits > 0 ? ` (${totalUnits})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
