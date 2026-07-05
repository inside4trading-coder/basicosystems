import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronDown, RefreshCw, Loader2, Pencil, RotateCcw, Copy } from "lucide-react";
import { logCoreAudit } from "@/lib/coreAudit";

type Variant = {
  id: string;
  core_product_id: string;
  size: string | null;
  color: string | null;
  variant_sku: string | null;
  woo_variation_id: number | null;
  woo_regular_price: number | null;
  cost_structure_id: string | null;
  uses_parent_cost_structure: boolean;
  cost_override_enabled: boolean;
  variant_unit_cost_usd: number | null;
  status: string;
};

export function CoreVariantCostPanel({
  wooProductId,
  baseStructureId,
  onOpenVariantEditor,
}: {
  wooProductId: number | null;
  baseStructureId: string;
  onOpenVariantEditor: (variantId: string) => void;
}) {
  const [coreProductId, setCoreProductId] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [advancedEnabled, setAdvancedEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  async function loadCoreProduct() {
    if (!wooProductId) return null;
    const { data } = await supabase
      .from("core_products")
      .select("id")
      .eq("woo_product_id", wooProductId)
      .maybeSingle();
    return data?.id ?? null;
  }

  async function loadVariants(pid: string) {
    const { data } = await supabase
      .from("core_product_variants")
      .select("id, core_product_id, size, color, variant_sku, woo_variation_id, woo_regular_price, cost_structure_id, uses_parent_cost_structure, cost_override_enabled, variant_unit_cost_usd, status")
      .eq("core_product_id", pid)
      .order("color", { ascending: true, nullsFirst: true })
      .order("size", { ascending: true });
    const list = (data as Variant[]) ?? [];
    setVariants(list);
    // Auto-enable advanced mode if any variant has override
    if (list.some(v => v.cost_override_enabled)) {
      setAdvancedEnabled(true);
      setOpen(true);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!wooProductId) return;
      setLoading(true);
      const pid = await loadCoreProduct();
      if (cancelled) return;
      setCoreProductId(pid);
      if (pid) await loadVariants(pid);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [wooProductId]);

  async function ensureCoreProduct(): Promise<string | null> {
    if (coreProductId) return coreProductId;
    if (!wooProductId) return null;
    // Preview via edge function to get Woo parent info without needing core_product_id
    const { data: preview, error: pErr } = await supabase.functions.invoke("core-woo-import-variants", {
      body: { woo_product_id: wooProductId, apply: false },
    });
    if (pErr) throw pErr;
    if (preview?.error) throw new Error(preview.error);
    const p = preview?.parent ?? {};
    const coreSku = (p.sku && String(p.sku).trim()) || `WOO-${wooProductId}`;
    const name = p.name || `Woo ${wooProductId}`;
    const insertPayload: any = {
      core_sku: coreSku,
      name,
      cost_structure_id: baseStructureId,
      woo_product_id: wooProductId,
      woo_product_name: p.name ?? null,
      woo_sku: p.sku ?? null,
      woo_permalink: p.permalink ?? null,
      woo_regular_price: p.regular_price ?? null,
      woo_sale_price: p.sale_price ?? null,
      sku_source: p.sku ? "woo" : "auto",
      sync_status: "synced",
    };
    const { data: inserted, error: iErr } = await supabase
      .from("core_products")
      .insert(insertPayload)
      .select("id")
      .single();
    if (iErr) throw iErr;
    const newId = inserted!.id as string;
    setCoreProductId(newId);
    return newId;
  }

  async function handleSync() {
    if (!wooProductId) { toast.error("Falta Woo Product ID"); return; }
    setSyncing(true);
    try {
      const pid = await ensureCoreProduct();
      if (!pid) throw new Error("No se pudo crear/vincular producto Core");
      const { data, error } = await supabase.functions.invoke("core-woo-import-variants", {
        body: { woo_product_id: wooProductId, core_product_id: pid, apply: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Sincronizadas ${data?.total ?? 0} variantes (${data?.created ?? 0} nuevas, ${data?.updated ?? 0} actualizadas)`);
      await loadVariants(pid);
    } catch (e: any) {
      toast.error("Error sincronizando: " + (e?.message ?? "desconocido"));
    } finally {
      setSyncing(false);
    }
  }

  async function setVariantMode(v: Variant, mode: "inherit" | "custom") {
    const patch = mode === "inherit"
      ? { uses_parent_cost_structure: true, cost_override_enabled: false, cost_updated_at: new Date().toISOString() }
      : { uses_parent_cost_structure: false, cost_override_enabled: true, cost_updated_at: new Date().toISOString() };
    const { error } = await supabase.from("core_product_variants").update(patch as any).eq("id", v.id);
    if (error) { toast.error(error.message); return; }
    await logCoreAudit({
      table: "core_product_variants",
      recordId: v.id,
      action: mode === "inherit" ? "variant_cost_reset" : "variant_cost_override",
      field: "cost_override_enabled",
      oldValue: v.cost_override_enabled,
      newValue: mode === "custom",
    });
    if (coreProductId) await loadVariants(coreProductId);
    toast.success(mode === "inherit" ? "Variante ahora hereda base" : "Variante marcada como personalizada");
  }

  const overrideCount = variants.filter(v => v.cost_override_enabled).length;

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Costos por variante</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            La mayoría de productos usan un solo costo base para todas las tallas y colores. Actívalo únicamente si algunas variantes consumen materias primas distintas.
          </p>
        </div>
        {overrideCount > 0 && (
          <Badge variant="default" className="gap-1">
            {overrideCount} variante{overrideCount === 1 ? "" : "s"} con costo propio
          </Badge>
        )}
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <Checkbox
          checked={advancedEnabled}
          onCheckedChange={(v) => { setAdvancedEnabled(!!v); if (v) setOpen(true); }}
          className="mt-0.5"
        />
        <div>
          <div className="text-sm font-medium">Este producto tiene costos diferentes por variante/color/talla</div>
          <div className="text-xs text-muted-foreground">Actívalo solo si algunas variantes consumen materias primas o costos distintos. Si todas cuestan igual, déjalo apagado.</div>
        </div>
      </label>

      {advancedEnabled && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center justify-between border-t pt-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                {open ? "Ocultar variantes" : `Mostrar variantes (${variants.length})`}
              </Button>
            </CollapsibleTrigger>
            <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing || !wooProductId}>
              {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Sincronizar variantes Woo
            </Button>
          </div>

          <CollapsibleContent>
            {loading ? (
              <div className="text-sm text-muted-foreground py-4">Cargando…</div>
            ) : variants.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg mt-3">
                Sin variantes cargadas. Pulsa <strong>Sincronizar variantes Woo</strong> para importarlas.
              </div>
            ) : (
              <div className="mt-3 border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Woo ID</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Talla</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead className="text-right">Precio Woo</TableHead>
                      <TableHead>Modo costo</TableHead>
                      <TableHead className="text-right">Costo unitario</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">{v.woo_variation_id ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{v.variant_sku ?? "—"}</TableCell>
                        <TableCell>{v.size ?? "—"}</TableCell>
                        <TableCell>{v.color ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                          {v.woo_regular_price != null ? v.woo_regular_price.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={v.cost_override_enabled ? "custom" : "inherit"}
                            onValueChange={(val) => setVariantMode(v, val as any)}
                          >
                            <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inherit">Heredar base</SelectItem>
                              <SelectItem value="custom">Personalizar</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {v.cost_override_enabled
                            ? (v.variant_unit_cost_usd != null ? v.variant_unit_cost_usd.toFixed(2) : <span className="text-muted-foreground text-xs">sin editar</span>)
                            : <span className="text-muted-foreground text-xs">hereda base</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {v.cost_override_enabled && (
                            <div className="inline-flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => onOpenVariantEditor(v.id)}>
                                <Pencil className="h-3 w-3 mr-1" />Editar
                              </Button>
                              <Button size="sm" variant="ghost" title="Volver a heredar base"
                                onClick={() => setVariantMode(v, "inherit")}>
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
              Copiar desde base: usa <strong>Editar</strong> y luego <em>Copiar líneas de base</em> dentro del editor de la variante.
            </p>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
}
