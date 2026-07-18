import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Download, Link as LinkIcon, RefreshCw, DollarSign, Truck, Ban, Repeat, Tag, ChevronRight, ChevronDown, Wand2, Trash2, EyeOff, Eye } from "lucide-react";
import { logStrategyDecision, upsertPolicy } from "@/hooks/useWooCoreMap";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  useWooProductMap,
  useReplenishmentPolicies,
  useCoreProductsLite,
  useStrategyAudit,
  useCostStructuresByWoo,
  type WooProductMapRow,
  type ReplenishmentPolicyRow,
  type CoreProductLite,
  type CostStructureLite,
} from "@/hooks/useWooCoreMap";
import {
  LIFECYCLE_LABELS,
  ROUTE_LABELS,
  BRAND_ROLE_LABELS,
  MAPPING_STATUS_LABELS,
  VARIANT_SYNC_LABELS,
  REPLACEMENT_BEHAVIOR_LABELS,
  resolveDisplayCost,
} from "@/lib/coreReplenishment";
import { LinkWooIdDialog } from "@/components/core/woocore/LinkWooIdDialog";
import { LinkToCoreDialog } from "@/components/core/woocore/LinkToCoreDialog";
import { CreateCoreFromWooDialog } from "@/components/core/woocore/CreateCoreFromWooDialog";
import { SyncVariantsDialog } from "@/components/core/woocore/SyncVariantsDialog";
import { ManualCostDialog } from "@/components/core/woocore/ManualCostDialog";
import { ReplenishmentRouteDialog } from "@/components/core/woocore/ReplenishmentRouteDialog";
import { LifecycleStatusDialog } from "@/components/core/woocore/LifecycleStatusDialog";

import { NoRestockConfigDialog } from "@/components/core/woocore/NoRestockConfigDialog";
import { BrandRoleDialog } from "@/components/core/woocore/BrandRoleDialog";
import { WooCoreVariantsRow } from "@/components/core/woocore/WooCoreVariantsRow";
import { StrategyAuditPanel } from "@/components/core/woocore/StrategyAuditPanel";
import { PolicyReviewPanel } from "@/components/core/woocore/PolicyReviewPanel";
import { ExternalReplenishmentPanel } from "@/components/core/woocore/external/ExternalReplenishmentPanel";


type RowCtx = {
  map: WooProductMapRow;
  core: CoreProductLite | null;
  policy: ReplenishmentPolicyRow | null;
  structures: CostStructureLite[];
  activeStructure: CostStructureLite | null;
  connState: "core_full" | "core_no_structure" | "structure_only" | "needs_review" | "none";
};

type DialogState =
  | { kind: "linkWoo" }
  | { kind: "linkToCore"; ctx: RowCtx }
  | { kind: "createCore"; ctx: RowCtx }
  | { kind: "syncVariants"; ctx: RowCtx }
  | { kind: "manualCost"; ctx: RowCtx }
  | { kind: "route"; ctx: RowCtx }
  | { kind: "lifecycle"; ctx: RowCtx }
  

  | { kind: "brandRole"; ctx: RowCtx }
  | null;

export default function CoreWooCoreMap() {
  const qc = useQueryClient();
  const { data: mapRows = [], isLoading: loadingMap } = useWooProductMap();
  const { data: policies = [] } = useReplenishmentPolicies();
  const { data: coreProducts = [] } = useCoreProductsLite();
  const { data: structuresByWoo } = useCostStructuresByWoo();
  const auditQ = useStrategyAudit();

  const [tab, setTab] = useState("mapa");
  const [search, setSearch] = useState("");
  const [filterMapping, setFilterMapping] = useState<string>("all");
  const [filterLifecycle, setFilterLifecycle] = useState<string>("all");
  const [filterRoute, setFilterRoute] = useState<string>("all");
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [noRestockDialog, setNoRestockDialog] = useState<{ open: boolean; initialCtx?: RowCtx | null; initialStatus?: "no_restock" | "exit" | "replaced" }>({ open: false });
  const [importing, setImporting] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [highlightedWoo, setHighlightedWoo] = useState<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const consumedActionRef = useRef(false);

  const coreById = useMemo(() => new Map(coreProducts.map(c => [c.id, c])), [coreProducts]);
  const policyByWoo = useMemo(() => {
    const m = new Map<number, ReplenishmentPolicyRow>();
    for (const p of policies) if (p.woo_product_id) m.set(p.woo_product_id, p);
    return m;
  }, [policies]);
  const policyByCore = useMemo(() => {
    const m = new Map<string, ReplenishmentPolicyRow>();
    for (const p of policies) if (p.core_product_id) m.set(p.core_product_id, p);
    return m;
  }, [policies]);

  const rowsCtx: RowCtx[] = useMemo(() => {
    return mapRows.map(m => {
      const core = m.core_product_id ? coreById.get(m.core_product_id) ?? null : null;
      const policy = policyByWoo.get(m.woo_product_id) ?? (m.core_product_id ? policyByCore.get(m.core_product_id) ?? null : null);
      const structures = structuresByWoo?.get(m.woo_product_id) ?? [];
      const activeStructure = structures.find(s => s.status === "active") ?? structures[0] ?? null;
      let connState: RowCtx["connState"] = "none";
      if (m.mapping_status === "needs_review") connState = "needs_review";
      else if (core && activeStructure) connState = "core_full";
      else if (core) connState = "core_no_structure";
      else if (activeStructure) connState = "structure_only";
      return { map: m, core, policy, structures, activeStructure, connState };
    });
  }, [mapRows, coreById, policyByWoo, policyByCore, structuresByWoo]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rowsCtx.filter(r => {
      // Ocultar productos marcados como "ignorado" salvo que se filtre explícitamente por ellos
      if (filterMapping !== "ignored" && r.map.mapping_status === "ignored") return false;
      if (filterMapping !== "all" && r.map.mapping_status !== filterMapping) return false;
      const lc = r.policy?.lifecycle_status ?? "active";
      if (filterLifecycle !== "all" && lc !== filterLifecycle) return false;
      const rt = r.policy?.replenishment_route ?? "internal_factory";
      if (filterRoute !== "all" && rt !== filterRoute) return false;
      const br = r.policy?.brand_role ?? "regular";
      if (filterBrand !== "all" && br !== filterBrand) return false;
      if (!s) return true;
      return (
        String(r.map.woo_product_id).includes(s) ||
        (r.map.woo_product_name ?? "").toLowerCase().includes(s) ||
        (r.map.woo_product_sku ?? "").toLowerCase().includes(s) ||
        (r.core?.core_sku ?? "").toLowerCase().includes(s) ||
        (r.core?.name ?? "").toLowerCase().includes(s)
      );
    }).sort((a, b) => {
      const tier = (r: RowCtx) => {
        if (r.core) return 2;
        const hasCost = !!r.activeStructure || !!r.policy?.manual_unit_cost_usd || !!r.core?.manual_unit_cost_usd;
        return hasCost ? 1 : 0;
      };
      return tier(a) - tier(b);
    });
  }, [rowsCtx, search, filterMapping, filterLifecycle, filterRoute, filterBrand]);

  const ignoredCount = useMemo(
    () => rowsCtx.filter(r => r.map.mapping_status === "ignored").length,
    [rowsCtx],
  );

  const missingCostRows = useMemo(
    () => rowsCtx.filter(r => {
      if (r.map.mapping_status === "ignored") return false;
      const hasStructure = !!r.core?.cost_structure_id || !!r.activeStructure;
      const hasManual = !!(r.policy?.manual_unit_cost_usd || r.core?.manual_unit_cost_usd);
      return !hasStructure && !hasManual;
    }),
    [rowsCtx],
  );
  const externalRows = useMemo(
    () => rowsCtx.filter(r => r.map.mapping_status !== "ignored" && r.policy?.replenishment_route === "external_supplier"),
    [rowsCtx],
  );
  const needsReplacementActivationRows = useMemo(
    () => rowsCtx.filter(r => {
      if (r.map.mapping_status === "ignored") return false;
      const p = r.policy;
      const hasRef = !!(p?.replacement_product_id || p?.replacement_woo_product_id);
      return hasRef && p?.lifecycle_status !== "replaced";
    }),
    [rowsCtx],
  );
  const noRestockRows = useMemo(
    () => {
      const seen = new Set<string>();
      const out: RowCtx[] = [];
      for (const r of rowsCtx) {
        if (r.map.mapping_status === "ignored") continue;
        const lc = r.policy?.lifecycle_status;
        const active = lc === "no_restock" || lc === "exit" || lc === "replaced";
        const needsAct = !!(r.policy?.replacement_product_id || r.policy?.replacement_woo_product_id) && lc !== "replaced";
        if ((active || needsAct) && !seen.has(r.map.id)) {
          seen.add(r.map.id);
          out.push(r);
        }
      }
      return out;
    },
    [rowsCtx],
  );


  // Read query params (from Necesidades) and auto-open the appropriate action for the target product.
  useEffect(() => {
    const initialSearch = searchParams.get("search");
    if (initialSearch && !search) setSearch(initialSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (consumedActionRef.current) return;
    if (loadingMap) return;
    const wooRaw = searchParams.get("woo_product_id");
    const action = searchParams.get("action");
    const searchQ = searchParams.get("search");
    if (!wooRaw && !searchQ) return;

    let ctx: RowCtx | null = null;
    if (wooRaw) {
      const wooId = Number(wooRaw);
      if (!Number.isFinite(wooId)) return;
      ctx = rowsCtx.find((r) => r.map.woo_product_id === wooId) ?? null;
      // Force the row visible even if hidden by "ignored" filter
      if (ctx && ctx.map.mapping_status === "ignored") setFilterMapping("ignored");
      // Apply search so the row is filtered/visible
      if (!search) setSearch(String(wooId));
      if (!ctx) {
        toast({
          title: "Producto no encontrado",
          description: `No se encontró el producto Woo #${wooId} en Mapa Woo/Core. Intenta importar Woo o buscarlo manualmente.`,
          variant: "destructive",
        });
        consumedActionRef.current = true;
        // Clean the action param so we don't retry
        const next = new URLSearchParams(searchParams);
        next.delete("action");
        next.delete("woo_product_id");
        setSearchParams(next, { replace: true });
        return;
      }
      setHighlightedWoo(wooId);
      setTimeout(() => setHighlightedWoo((cur) => (cur === wooId ? null : cur)), 3000);
    }

    if (ctx && action) {
      if (action === "cost") {
        setDialog({ kind: "manualCost", ctx });
      } else if (action === "policy") {
        setDialog({ kind: "route", ctx });
      } else if (action === "map") {
        toast({ title: "Producto abierto desde Necesidades" });
      }
    } else if (ctx) {
      toast({ title: "Producto abierto desde Necesidades" });
    }

    consumedActionRef.current = true;
    // Clean the action param so refetches don't re-open the dialog. Keep search for row visibility.
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    next.delete("woo_product_id");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMap, rowsCtx]);

  async function runImport(startPage = 1) {
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("core-woo-map-import", {
        body: { start_page: startPage, max_pages: 20 },
      });
      if (error) throw error;
      const d: any = data;
      toast({
        title: "Import Woo completado",
        description: `${d?.total_fetched ?? 0} productos leídos, ${d?.upserted ?? 0} guardados${d?.has_more ? " · hay más páginas" : ""}.`,
      });
      qc.invalidateQueries({ queryKey: ["woo-core-map"] });
    } catch (e: any) {
      toast({ title: "Error importando Woo", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  async function runReconcile() {
    setReconciling(true);
    try {
      const { data, error } = await supabase.rpc("core_reconcile_woo_core_map" as any);
      if (error) throw error;
      const d: any = data;
      toast({
        title: "Reconciliación completa",
        description: `Revisados: ${d?.reviewed ?? 0} · Core: ${d?.linked_via_core_products ?? 0} · Estructuras: ${d?.linked_via_structures ?? 0} · Revisión: ${d?.needs_review ?? 0} · Conflictos: ${d?.conflicts ?? 0} · Sin link: ${d?.no_link ?? 0}`,
      });
      qc.invalidateQueries({ queryKey: ["woo-core-map"] });
      qc.invalidateQueries({ queryKey: ["cost-structures-by-woo"] });
    } catch (e: any) {
      toast({ title: "Error reconciliando", description: e.message, variant: "destructive" });
    } finally {
      setReconciling(false);
    }
  }

  async function clearReplacement(ctx: RowCtx) {
    const p = ctx.policy;
    if (!p) return;
    const label = ctx.core?.core_sku ?? ctx.map.woo_product_name ?? `Woo #${ctx.map.woo_product_id}`;
    if (!window.confirm(`Eliminar el reemplazo configurado para ${label}? Se limpiarán producto reemplazo y comportamiento. El estado del producto no cambia.`)) return;
    try {
      const patch: any = {
        woo_product_id: ctx.map.woo_product_id,
        core_product_id: ctx.core?.id ?? null,
        replacement_product_id: null,
        replacement_woo_product_id: null,
        replacement_behavior: "suggest_only",
      };
      const { previous } = await upsertPolicy(patch);
      await logStrategyDecision({
        woo_product_id: ctx.map.woo_product_id,
        core_product_id: ctx.core?.id ?? null,
        decision_type: "clear_replacement",
        previous_values: {
          replacement_product_id: previous?.replacement_product_id ?? null,
          replacement_woo_product_id: previous?.replacement_woo_product_id ?? null,
          replacement_behavior: previous?.replacement_behavior ?? null,
        },
        new_values: { replacement_product_id: null, replacement_woo_product_id: null, replacement_behavior: "suggest_only" },
      });
      toast({ title: "Reemplazo eliminado" });
      qc.invalidateQueries({ queryKey: ["replenishment-policies"] });
      qc.invalidateQueries({ queryKey: ["strategy-audit"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function toggleIgnored(ctx: RowCtx) {
    const isIgnored = ctx.map.mapping_status === "ignored";
    const label = ctx.map.woo_product_name ?? `Woo #${ctx.map.woo_product_id}`;
    if (isIgnored) {
      if (!window.confirm(`Restaurar "${label}" en la lista?`)) return;
    } else {
      if (!window.confirm(`Ocultar "${label}" de la lista? Se marcará como Ignorado y no aparecerá en Mapa ni en las pestañas de faltantes, externa o no-restock. Podrás restaurarlo desde el filtro "Ignorado".`)) return;
    }
    const nextStatus = isIgnored ? (ctx.map.core_product_id ? "mapped" : "unmapped") : "ignored";
    try {
      const { error } = await supabase
        .from("core_woo_product_map")
        .update({ mapping_status: nextStatus })
        .eq("id", ctx.map.id);
      if (error) throw error;
      toast({ title: isIgnored ? "Producto restaurado" : "Producto ocultado de la lista" });
      qc.invalidateQueries({ queryKey: ["woo-core-map"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }





  function badge(text: string, variant: "default" | "secondary" | "destructive" | "outline" = "outline") {
    return <Badge variant={variant} className="text-[10px]">{text}</Badge>;
  }

  function costCell(ctx: RowCtx) {
    const structCost = ctx.activeStructure?.total_unit_cost ?? null;
    const r = resolveDisplayCost({
      productBaseStructureCost: structCost,
      policyManualCost: ctx.policy?.manual_unit_cost_usd ?? null,
      externalSupplierCost: ctx.policy?.external_supplier_unit_cost_usd ?? null,
      productManualMirrorCost: ctx.core?.manual_unit_cost_usd ?? null,
      productUnitCost: ctx.core?.unit_cost ?? null,
    });
    const isOperationalManual =
      r.source === "policy_manual" ||
      r.source === "external_supplier" ||
      r.source === "product_manual_mirror";
    return (
      <div className="flex flex-col gap-0.5">
        <span className={r.hasWarning ? "text-destructive font-semibold" : "font-medium"}>
          {r.hasWarning ? "—" : `$${r.amount.toFixed(2)}`}
        </span>
        <span className="text-[10px] text-muted-foreground">{r.label}</span>
        {isOperationalManual && (
          <span
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold bg-yellow-300 text-black w-fit"
            title="Este costo se usará para montos de partidas/necesidades cuando no exista estructura. No reemplaza una estructura de fabricación."
          >
            Costo manual operativo
          </span>
        )}
      </div>
    );
  }


  function statusTier(ctx: RowCtx): 0 | 1 | 2 {
    // 0 = rojo (sin conexión total), 1 = amarillo (sin core pero con costo), 2 = verde (core conectado)
    if (ctx.core) return 2;
    const hasCost = !!ctx.activeStructure
      || !!ctx.policy?.manual_unit_cost_usd
      || !!ctx.policy?.external_supplier_unit_cost_usd
      || !!ctx.core?.manual_unit_cost_usd;
    return hasCost ? 1 : 0;
  }


  function connectionCell(ctx: RowCtx) {
    const tier = statusTier(ctx);
    const greenChip = "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold bg-emerald-600 text-white";
    const yellowChip = "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold bg-yellow-300 text-black";
    const redChip = "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold bg-red-600 text-white";

    if (tier === 2) {
      return (
        <div className="space-y-1">
          <div className="truncate" title={ctx.core!.name}>
            {ctx.core!.core_sku}
            <div className="text-[10px] text-muted-foreground truncate">{ctx.core!.name}</div>
          </div>
          <div className="flex gap-1 flex-wrap">
            <span className={greenChip}>Core conectado</span>
            {!ctx.activeStructure && !ctx.core?.cost_structure_id && (
              <span className={yellowChip}>Falta estructura</span>
            )}
          </div>
        </div>
      );
    }
    if (tier === 1) {
      return (
        <div className="space-y-1">
          <span className={yellowChip}>Sin conexión · con costo</span>
          {ctx.activeStructure && badge("Con estructura Woo", "secondary")}
        </div>
      );
    }
    return <span className={redChip}>Sin conexión</span>;
  }


  function renderMainTable(rows: RowCtx[]) {
    if (loadingMap) {
      return <div className="p-8 text-center text-muted-foreground"><Loader2 className="inline animate-spin mr-2" />Cargando…</div>;
    }
    if (rows.length === 0) {
      return <div className="p-8 text-center text-muted-foreground text-sm">
        No hay productos Woo cargados. Presiona <b>Importar Woo</b> para traer el catálogo.
      </div>;
    }
    return (
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 border-b">
            <tr className="text-left">
              <th className="p-2 w-6"></th>
              <th className="p-2">Woo</th>
              <th className="p-2">Producto</th>
              <th className="p-2">Tipo</th>
              <th className="p-2">Var.</th>
              <th className="p-2">Core</th>
              <th className="p-2">Sync</th>
              <th className="p-2">Costo</th>
              <th className="p-2">Rol</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Ruta</th>
              <th className="p-2">Reemplazo</th>
              <th className="p-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(ctx => {
              const m = ctx.map;
              const p = ctx.policy;
              const isExp = expanded.has(m.woo_product_id);
              return (
                <>
                  <tr key={m.id} className="border-b hover:bg-muted/30">
                    <td className="p-2">
                      <button
                        onClick={() => {
                          const s = new Set(expanded);
                          s.has(m.woo_product_id) ? s.delete(m.woo_product_id) : s.add(m.woo_product_id);
                          setExpanded(s);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {isExp ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                    </td>
                    <td className="p-2 font-mono text-[10px]">{m.woo_product_id}</td>
                    <td className="p-2 max-w-[240px]">
                      <div className="truncate font-medium" title={m.woo_product_name ?? ""}>{m.woo_product_name ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{m.woo_product_sku ?? "sin SKU"}</div>
                    </td>
                    <td className="p-2">{m.woo_product_type ?? "—"}</td>
                    <td className="p-2 text-center">{m.woo_variations_count}</td>
                    <td className="p-2 max-w-[200px]">
                      {connectionCell(ctx)}
                    </td>
                    <td className="p-2">{badge(VARIANT_SYNC_LABELS[m.variants_sync_status] ?? m.variants_sync_status)}</td>
                    <td className="p-2">{costCell(ctx)}</td>
                    <td className="p-2">{badge(BRAND_ROLE_LABELS[p?.brand_role ?? "regular"])}</td>
                    <td className="p-2">{badge(LIFECYCLE_LABELS[p?.lifecycle_status ?? "active"], p?.lifecycle_status && p.lifecycle_status !== "active" ? "destructive" : "outline")}</td>
                    <td className="p-2">{badge(ROUTE_LABELS[p?.replenishment_route ?? "internal_factory"])}</td>
                    <td className="p-2 max-w-[160px]">
                      {(() => {
                        const hasRef = !!(p?.replacement_product_id || p?.replacement_woo_product_id);
                        const needsAct = hasRef && p?.lifecycle_status !== "replaced";
                        const label = p?.replacement_product_id
                          ? (coreById.get(p.replacement_product_id)?.core_sku ?? "—")
                          : (p?.replacement_woo_product_id ? `Woo #${p.replacement_woo_product_id}` : null);
                        return (
                          <div className="flex flex-col gap-1">
                            {label ? <span>{label}</span> : <span className="text-muted-foreground">—</span>}
                            {needsAct && (
                              <div className="flex flex-col gap-1">
                                <Badge variant="destructive" className="text-[9px] w-fit">Reemplazo sin activar</Badge>
                                <button
                                  className="text-[10px] underline text-primary text-left"
                                  onClick={() => setNoRestockDialog({ open: true, initialCtx: ctx, initialStatus: "replaced" })}
                                >
                                  Completar política
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    <td className="p-2 text-right">
                      <div className="flex gap-1 justify-end flex-wrap">
                        {!ctx.core && <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setDialog({ kind: "linkToCore", ctx })}><LinkIcon className="h-3 w-3 mr-1" />Vincular</Button>}
                        {!ctx.core && <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setDialog({ kind: "createCore", ctx })}>Crear Core</Button>}
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setDialog({ kind: "syncVariants", ctx })}><RefreshCw className="h-3 w-3 mr-1" />Sync</Button>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setDialog({ kind: "manualCost", ctx })}><DollarSign className="h-3 w-3 mr-1" />Costo</Button>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setDialog({ kind: "route", ctx })}><Truck className="h-3 w-3 mr-1" />Ruta</Button>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setDialog({ kind: "lifecycle", ctx })}><Ban className="h-3 w-3 mr-1" />Estado</Button>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setNoRestockDialog({ open: true, initialCtx: ctx, initialStatus: "replaced" })}><Repeat className="h-3 w-3 mr-1" />Reemplazo</Button>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setDialog({ kind: "brandRole", ctx })}><Tag className="h-3 w-3 mr-1" />Rol</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px]"
                          title={ctx.map.mapping_status === "ignored" ? "Restaurar en la lista" : "Ocultar de la lista (ej. gift cards que no necesitan estructura de costos)"}
                          onClick={() => toggleIgnored(ctx)}
                        >
                          {ctx.map.mapping_status === "ignored"
                            ? (<><Eye className="h-3 w-3 mr-1" />Restaurar</>)
                            : (<><EyeOff className="h-3 w-3 mr-1" />Ocultar</>)}
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {isExp && (
                    <tr key={m.id + "-exp"} className="border-b bg-muted/10">
                      <td colSpan={13} className="p-3">
                        <WooCoreVariantsRow wooProductId={m.woo_product_id} coreProductId={ctx.core?.id ?? null} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Mapa Woo / Core</h1>
          <p className="text-sm text-muted-foreground">Mesa de decisión entre WooCommerce y Basico Core. Solo lectura de Woo, sin escrituras al store.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setDialog({ kind: "linkWoo" })}>
            <LinkIcon className="h-4 w-4 mr-2" />Vincular Woo ID
          </Button>
          <Button variant="secondary" onClick={runReconcile} disabled={reconciling}>
            {reconciling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
            Reconciliar conexiones existentes
          </Button>
          <Button onClick={() => runImport(1)} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Importar Woo
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="mapa">Mapa Woo / Core ({rowsCtx.length})</TabsTrigger>
          <TabsTrigger value="missing">Faltan estructura / costo ({missingCostRows.length})</TabsTrigger>
          <TabsTrigger value="external">Reposición externa ({externalRows.length})</TabsTrigger>
          <TabsTrigger value="norestock">No restock / Reemplazos ({noRestockRows.length}{needsReplacementActivationRows.length > 0 ? ` · ${needsReplacementActivationRows.length} sin activar` : ""})</TabsTrigger>
          <TabsTrigger value="review">Revisión de reposición</TabsTrigger>
          <TabsTrigger value="audit">Auditoría</TabsTrigger>

        </TabsList>

        <TabsContent value="mapa" className="space-y-3">
          <Card className="p-3">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
              <Input placeholder="Buscar Woo ID, nombre, SKU…" value={search} onChange={e => setSearch(e.target.value)} className="md:col-span-2" />
              <Select value={filterMapping} onValueChange={setFilterMapping}>
                <SelectTrigger><SelectValue placeholder="Conexión" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las conexiones</SelectItem>
                  {Object.entries(MAPPING_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterLifecycle} onValueChange={setFilterLifecycle}>
                <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {Object.entries(LIFECYCLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterRoute} onValueChange={setFilterRoute}>
                <SelectTrigger><SelectValue placeholder="Ruta" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las rutas</SelectItem>
                  {Object.entries(ROUTE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterBrand} onValueChange={setFilterBrand}>
                <SelectTrigger><SelectValue placeholder="Rol" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  {Object.entries(BRAND_ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Card>
          {renderMainTable(filtered)}
        </TabsContent>

        <TabsContent value="missing" className="space-y-3">
          <p className="text-sm text-muted-foreground">Productos sin estructura de costos activa y sin costo manual fallback.</p>
          {renderMainTable(missingCostRows)}
        </TabsContent>
        <TabsContent value="external" className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Productos con ruta <b>Proveedor externo</b>.</p>
            {renderMainTable(externalRows)}
          </div>
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-2">Órdenes a proveedor</h3>
            <ExternalReplenishmentPanel />
          </div>
        </TabsContent>
        <TabsContent value="norestock" className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Productos en <b>No restock</b>, <b>En salida</b> o <b>Reemplazados</b>. Elige el producto Woo/Core existente y define la política.
            </p>
            <Button size="sm" onClick={() => setNoRestockDialog({ open: true })}>
              <Repeat className="h-4 w-4 mr-1" /> Agregar producto
            </Button>
          </div>
          {noRestockRows.length === 0 ? (
            mapRows.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm border rounded-lg">
                No hay productos Woo importados. Presiona <b>Importar Woo</b> para traer el catálogo.
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm border rounded-lg space-y-3">
                <div>No hay productos configurados como <b>No restock</b>, <b>En salida</b> o <b>Reemplazados</b>.</div>
                <Button size="sm" onClick={() => setNoRestockDialog({ open: true })}>
                  <Repeat className="h-4 w-4 mr-1" /> Agregar producto
                </Button>
              </div>
            )
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr className="text-left">
                    <th className="p-2">Producto</th>
                    <th className="p-2">Woo ID</th>
                    <th className="p-2">Core</th>
                    <th className="p-2">Estado</th>
                    <th className="p-2">Reemplazo</th>
                    <th className="p-2">Comportamiento</th>
                    <th className="p-2">Actualizado</th>
                    <th className="p-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {noRestockRows.map(ctx => {
                    const p = ctx.policy;
                    const replLabel = p?.replacement_product_id
                      ? (coreById.get(p.replacement_product_id)?.core_sku ?? "Core")
                      : (p?.replacement_woo_product_id ? `Woo #${p.replacement_woo_product_id}` : "—");
                    const hasRef = !!(p?.replacement_product_id || p?.replacement_woo_product_id);
                    const needsAct = hasRef && p?.lifecycle_status !== "replaced";
                    return (
                      <tr key={ctx.map.id} className="border-b hover:bg-muted/30">
                        <td className="p-2 max-w-[260px]">
                          <div className="font-medium truncate" title={ctx.map.woo_product_name ?? ""}>{ctx.map.woo_product_name ?? "—"}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{ctx.map.woo_product_sku ?? "sin SKU"}</div>
                        </td>
                        <td className="p-2 font-mono text-[10px]">{ctx.map.woo_product_id}</td>
                        <td className="p-2">{ctx.core ? <Badge className="text-[10px]">Conectado</Badge> : <Badge variant="outline" className="text-[10px]">Sin Core</Badge>}</td>
                        <td className="p-2">
                          <div className="flex flex-col gap-1">
                            {badge(LIFECYCLE_LABELS[p?.lifecycle_status ?? "active"], needsAct ? "outline" : "destructive")}
                            {needsAct && <Badge variant="destructive" className="text-[9px] w-fit">Reemplazo sin activar</Badge>}
                          </div>
                        </td>
                        <td className="p-2">{replLabel}</td>
                        <td className="p-2">{p?.replacement_behavior ? (REPLACEMENT_BEHAVIOR_LABELS[p.replacement_behavior] ?? p.replacement_behavior) : "—"}</td>
                        <td className="p-2 text-[10px] text-muted-foreground">{p?.updated_at ? new Date(p.updated_at).toLocaleDateString() : "—"}</td>
                        <td className="p-2 text-right">
                          <div className="flex gap-1 justify-end flex-wrap">
                            {needsAct ? (
                              <Button size="sm" className="h-6 px-2 text-[10px]" onClick={() => setNoRestockDialog({ open: true, initialCtx: ctx, initialStatus: "replaced" })}>Completar política</Button>
                            ) : (
                              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setNoRestockDialog({ open: true, initialCtx: ctx })}>Editar</Button>
                            )}
                            {p?.replacement_product_id && (
                              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => {
                                const target = rowsCtx.find(r => r.core?.id === p.replacement_product_id) ?? null;
                                if (target) setNoRestockDialog({ open: true, initialCtx: target });
                              }}>Ver reemplazo</Button>
                            )}
                            {hasRef && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
                                onClick={() => clearReplacement(ctx)}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />Eliminar
                              </Button>
                            )}

                          </div>
                        </td>
                      </tr>
                    );
                  })}

                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="review">
          <PolicyReviewPanel />
        </TabsContent>
        <TabsContent value="audit">
          <StrategyAuditPanel entries={auditQ.data ?? []} loading={auditQ.isLoading} />
        </TabsContent>

      </Tabs>

      {/* Dialogs */}
      {dialog?.kind === "linkWoo" && <LinkWooIdDialog open onClose={() => setDialog(null)} onDone={() => qc.invalidateQueries({ queryKey: ["woo-core-map"] })} coreProducts={coreProducts} />}
      {dialog?.kind === "linkToCore" && <LinkToCoreDialog open onClose={() => setDialog(null)} ctx={dialog.ctx} coreProducts={coreProducts} onDone={() => qc.invalidateQueries({ queryKey: ["woo-core-map"] })} />}
      {dialog?.kind === "createCore" && <CreateCoreFromWooDialog open onClose={() => setDialog(null)} ctx={dialog.ctx} onDone={() => { qc.invalidateQueries({ queryKey: ["woo-core-map"] }); qc.invalidateQueries({ queryKey: ["core-products-lite"] }); }} />}
      {dialog?.kind === "syncVariants" && <SyncVariantsDialog open onClose={() => setDialog(null)} ctx={dialog.ctx} onDone={() => qc.invalidateQueries({ queryKey: ["woo-core-map"] })} />}
      {dialog?.kind === "manualCost" && <ManualCostDialog open onClose={() => setDialog(null)} ctx={dialog.ctx} onDone={() => { qc.invalidateQueries({ queryKey: ["replenishment-policies"] }); qc.invalidateQueries({ queryKey: ["core-products-lite"] }); qc.invalidateQueries({ queryKey: ["strategy-audit"] }); }} />}
      {dialog?.kind === "route" && <ReplenishmentRouteDialog open onClose={() => setDialog(null)} ctx={dialog.ctx} onDone={() => { qc.invalidateQueries({ queryKey: ["replenishment-policies"] }); qc.invalidateQueries({ queryKey: ["strategy-audit"] }); }} />}
      {dialog?.kind === "lifecycle" && <LifecycleStatusDialog open onClose={() => setDialog(null)} ctx={dialog.ctx} onDone={() => { qc.invalidateQueries({ queryKey: ["replenishment-policies"] }); qc.invalidateQueries({ queryKey: ["strategy-audit"] }); }} />}
      
      {dialog?.kind === "brandRole" && <BrandRoleDialog open onClose={() => setDialog(null)} ctx={dialog.ctx} onDone={() => { qc.invalidateQueries({ queryKey: ["replenishment-policies"] }); qc.invalidateQueries({ queryKey: ["strategy-audit"] }); }} />}
      {noRestockDialog.open && (
        <NoRestockConfigDialog
          open
          onClose={() => setNoRestockDialog({ open: false })}
          initialCtx={noRestockDialog.initialCtx ?? null}
          initialStatus={noRestockDialog.initialStatus}
          rowsCtx={rowsCtx}

          onDone={() => {
            qc.invalidateQueries({ queryKey: ["replenishment-policies"] });
            qc.invalidateQueries({ queryKey: ["strategy-audit"] });
          }}
        />
      )}
    </div>
  );
}
