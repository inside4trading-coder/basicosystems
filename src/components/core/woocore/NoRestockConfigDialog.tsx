import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logStrategyDecision, upsertPolicy } from "@/hooks/useWooCoreMap";
import {
  REPLACEMENT_BEHAVIOR_LABELS,
  LIFECYCLE_LABELS,
  routeLabel,
  resolvePolicyChoice,
  type ReplenishmentPolicyChoice,
} from "@/lib/coreReplenishment";
import { Search, ArrowLeft, Loader2 } from "lucide-react";
import { LifecycleStatusDialog } from "./LifecycleStatusDialog";
import { ReplenishmentRouteDialog } from "./ReplenishmentRouteDialog";

type LifecycleChoice = ReplenishmentPolicyChoice;

const LIFECYCLE_CHOICES: { value: LifecycleChoice; label: string; hint: string }[] = [
  { value: "restock", label: "Restock / Reposición", hint: "El producto puede generar reposición normalmente. Restock habilitado." },
  { value: "no_restock", label: "No restock", hint: "Se deja de reponer. Restock desactivado." },
  { value: "exit", label: "En salida", hint: "Producto saliendo del catálogo. Restock desactivado." },
  { value: "replaced", label: "Reemplazado", hint: "Sustituido por otro producto. Restock desactivado." },
];


interface Ctx {
  map: any;
  core: any | null;
  policy: any | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  rowsCtx: Ctx[];
  initialCtx?: Ctx | null;
  initialStatus?: LifecycleChoice;
}

function norm(s: string | null | undefined): string {
  if (!s) return "";
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

interface FabricableCandidate {
  core_id: string;
  core_sku: string;
  core_name: string;
  product_type: string | null;
  woo_product_id: number | null;
  woo_product_name: string | null;
  woo_product_sku: string | null;
  woo_image: string | null;
  variants_count: number;
  has_variants_synced: boolean;
  has_cost_structure: boolean;
  blocked_reason: string | null;
  has_policy: boolean;
  effective_policy: any | null;
}

function useFabricableReplacementCandidates(open: boolean) {
  return useQuery({
    queryKey: ["fabricable-replacement-candidates"],
    enabled: open,
    queryFn: async (): Promise<FabricableCandidate[]> => {
      const { data: products, error: pErr } = await supabase
        .from("core_products")
        .select("id, core_sku, name, product_type, commercial_status, is_restockable, woo_product_id, woo_product_name, cost_structure_id")
        .eq("commercial_status", "active")
        .eq("is_restockable", true)
        .order("name", { ascending: true })
        .limit(5000);
      if (pErr) throw pErr;
      const rows = (products ?? []) as any[];
      const coreIds = rows.map(r => r.id).filter(Boolean);
      const wooIds = Array.from(new Set(rows.map(r => r.woo_product_id).filter((x): x is number => !!x)));

      // Two independent, null-safe queries. Order by updated_at desc so the first
      // Map.set (guarded) keeps the newest row per identity.
      const [mapRes, policyByCoreRes, policyByWooRes, variantsRes] = await Promise.all([
        wooIds.length
          ? supabase.from("core_woo_product_map")
              .select("woo_product_id, woo_product_name, woo_product_sku, woo_raw_payload, core_product_id")
              .in("woo_product_id", wooIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        coreIds.length
          ? supabase.from("core_replenishment_policies")
              .select("core_product_id, woo_product_id, lifecycle_status, replenishment_route, restock_enabled, updated_at")
              .in("core_product_id", coreIds)
              .order("updated_at", { ascending: false })
          : Promise.resolve({ data: [] as any[], error: null }),
        wooIds.length
          ? supabase.from("core_replenishment_policies")
              .select("core_product_id, woo_product_id, lifecycle_status, replenishment_route, restock_enabled, updated_at")
              .in("woo_product_id", wooIds)
              .order("updated_at", { ascending: false })
          : Promise.resolve({ data: [] as any[], error: null }),
        coreIds.length
          ? supabase.from("core_product_variants")
              .select("core_product_id, status")
              .in("core_product_id", coreIds)
              .eq("status", "active")
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);
      if (mapRes.error) throw mapRes.error;
      if (policyByCoreRes.error) throw policyByCoreRes.error;
      if (policyByWooRes.error) throw policyByWooRes.error;
      if (variantsRes.error) throw variantsRes.error;

      const mapByWoo = new Map<number, any>();
      for (const m of ((mapRes.data as any[]) ?? [])) mapByWoo.set(m.woo_product_id, m);

      const policyByCore = new Map<string, any>();
      for (const pol of ((policyByCoreRes.data as any[]) ?? [])) {
        if (pol.core_product_id && !policyByCore.has(pol.core_product_id)) {
          policyByCore.set(pol.core_product_id, pol);
        }
      }
      const policyByWoo = new Map<number, any>();
      for (const pol of ((policyByWooRes.data as any[]) ?? [])) {
        if (pol.woo_product_id && !policyByWoo.has(pol.woo_product_id)) {
          policyByWoo.set(pol.woo_product_id, pol);
        }
      }

      const variantCount = new Map<string, number>();
      for (const v of ((variantsRes.data as any[]) ?? [])) {
        variantCount.set(v.core_product_id, (variantCount.get(v.core_product_id) ?? 0) + 1);
      }

      return rows.map((r): FabricableCandidate => {
        const wooMap = r.woo_product_id ? mapByWoo.get(r.woo_product_id) : null;
        const pol =
          policyByCore.get(r.id) ??
          (r.woo_product_id ? policyByWoo.get(r.woo_product_id) : null) ??
          null;
        const isVariable = (r.product_type ?? "").toLowerCase() === "variable";
        const vc = variantCount.get(r.id) ?? 0;

        // Priority-ordered blocked_reason.
        let blocked: string | null = null;
        const lc = pol?.lifecycle_status;
        const route = pol?.replenishment_route;
        const restock = pol?.restock_enabled;
        if (lc === "replaced") blocked = "Reemplazado";
        else if (lc === "no_restock") blocked = "No restock";
        else if (lc === "exit") blocked = "En salida";
        else if (lc === "ignored") blocked = "Ignorado";
        else if (route === "external_supplier") blocked = "Proveedor externo";
        else if (pol && restock === false) blocked = "Restock deshabilitado";
        else if (isVariable && vc === 0) blocked = "Variable sin variantes";
        else if (r.commercial_status !== "active" || r.is_restockable === false) blocked = "Producto Core no activo";

        return {
          core_id: r.id,
          core_sku: r.core_sku,
          core_name: r.name,
          product_type: r.product_type ?? null,
          woo_product_id: r.woo_product_id ?? null,
          woo_product_name: wooMap?.woo_product_name ?? r.woo_product_name ?? null,
          woo_product_sku: wooMap?.woo_product_sku ?? null,
          woo_image: wooMap?.woo_raw_payload?.images?.[0]?.src ?? null,
          variants_count: vc,
          has_variants_synced: vc > 0,
          has_cost_structure: !!r.cost_structure_id,
          blocked_reason: blocked,
          has_policy: !!pol,
          effective_policy: pol,
        };
      });
    },
  });
}

export function NoRestockConfigDialog({ open, onClose, onDone, rowsCtx, initialCtx, initialStatus }: Props) {
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<Ctx | null>(initialCtx ?? null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [replacementSearch, setReplacementSearch] = useState("");
  const [replacementDebounced, setReplacementDebounced] = useState("");

  const [status, setStatus] = useState<LifecycleChoice>("no_restock");
  const [replacement, setReplacement] = useState<FabricableCandidate | null>(null);
  const [behavior, setBehavior] = useState<string>("suggest_only");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const [lifecycleEdit, setLifecycleEdit] = useState<Ctx | null>(null);
  const [routeEdit, setRouteEdit] = useState<Ctx | null>(null);

  const {
    data: fabricableCandidates = [],
    isLoading: loadingCandidates,
    refetch: refetchCandidates,
  } = useFabricableReplacementCandidates(open && status === "replaced");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    const t = setTimeout(() => setReplacementDebounced(norm(replacementSearch)), 200);
    return () => clearTimeout(t);
  }, [replacementSearch]);

  // Track for which `selected` identity we've already performed the initial rehydrate
  // of `replacement` from the saved policy. Without this, clicking "Cambiar" clears
  // `replacement` and the effect immediately re-selects it from `selected.policy`.
  const hydratedForRef = useRef<string | null>(null);

  function selectedIdentity(s: Ctx | null): string | null {
    if (!s) return null;
    return s.core?.id ?? (s.map?.woo_product_id != null ? `woo:${s.map.woo_product_id}` : null);
  }

  useEffect(() => {
    if (!selected) {
      hydratedForRef.current = null;
      return;
    }
    hydratedForRef.current = null;
    const p = selected.policy;
    // La política de reposición se deriva del modelo actual (lifecycle + ruta + restock_enabled),
    // no se asume desde el estado comercial.
    const derived = resolvePolicyChoice(p);
    setStatus(p ? derived : (initialStatus ?? "no_restock"));


    setBehavior(p?.replacement_behavior ?? "suggest_only");
    setReason(p?.decision_reason ?? "");
    setReplacement(null);
  }, [selected, initialStatus]);

  // Rehydrate replacement from candidates. Initial autoselect runs ONCE per `selected`.
  // After the user clicks "Cambiar" (setReplacement(null)), do not re-hydrate.
  useEffect(() => {
    if (!selected || status !== "replaced" || fabricableCandidates.length === 0) return;
    if (replacement) {
      const updated = fabricableCandidates.find(c => c.core_id === replacement.core_id);
      if (updated && updated !== replacement) setReplacement(updated);
      return;
    }
    const identity = selectedIdentity(selected);
    if (!identity) return;
    if (hydratedForRef.current === identity) return;
    const p = selected.policy;
    if (!p) {
      hydratedForRef.current = identity;
      return;
    }
    if (p.replacement_product_id) {
      const found = fabricableCandidates.find(c => c.core_id === p.replacement_product_id);
      if (found) setReplacement(found);
    } else if (p.replacement_woo_product_id) {
      const found = fabricableCandidates.find(c => c.woo_product_id === p.replacement_woo_product_id);
      if (found) setReplacement(found);
    }
    hydratedForRef.current = identity;
  }, [selected, status, fabricableCandidates, replacement]);

  function filterRows(term: string, exclude?: { wooId?: number; coreId?: string | null }) {
    const base = rowsCtx.filter(r => {
      if (exclude?.wooId && r.map.woo_product_id === exclude.wooId) return false;
      if (exclude?.coreId && r.core?.id === exclude.coreId) return false;
      return true;
    });
    if (!term) return base.slice(0, 50);
    return base
      .filter(r =>
        String(r.map.woo_product_id).includes(term) ||
        (r.map.woo_product_name ?? "").toLowerCase().includes(term) ||
        (r.map.woo_product_sku ?? "").toLowerCase().includes(term),
      )
      .slice(0, 50);
  }

  const results = useMemo(() => filterRows(debounced), [debounced, rowsCtx]);

  const originalCoreId = selected?.core?.id ?? null;
  const originalWooId = selected?.map?.woo_product_id ?? null;

  const filteredCandidates = useMemo(() => {
    const term = replacementDebounced;
    const excludedOriginal = fabricableCandidates.filter(c => {
      if (originalCoreId && c.core_id === originalCoreId) return false;
      if (originalWooId != null && c.woo_product_id === originalWooId) return false;
      return true;
    });

    const matchesTerm = (c: FabricableCandidate) => {
      if (!term) return true;
      return (
        norm(c.core_name).includes(term) ||
        norm(c.core_sku).includes(term) ||
        norm(c.woo_product_name).includes(term) ||
        norm(c.woo_product_sku).includes(term) ||
        (c.woo_product_id != null && String(c.woo_product_id).includes(term))
      );
    };

    // Exact match for blocked candidates only.
    const exactMatch = (c: FabricableCandidate) => {
      if (!term) return false;
      return (
        norm(c.core_sku) === term ||
        norm(c.woo_product_sku) === term ||
        (c.woo_product_id != null && String(c.woo_product_id) === term)
      );
    };

    return excludedOriginal
      .filter(c => {
        if (c.blocked_reason) return exactMatch(c);
        return matchesTerm(c);
      })
      .slice(0, 80);
  }, [fabricableCandidates, replacementDebounced, originalCoreId, originalWooId]);

  function policyLabel(ctx: Ctx) {
    const lc = ctx.policy?.lifecycle_status;
    if (!lc || lc === "active") return "Sin definir";
    return lc;
  }

  function candidateCtx(c: FabricableCandidate): Ctx {
    return {
      map: {
        id: null,
        woo_product_id: c.woo_product_id,
        woo_product_name: c.woo_product_name ?? c.core_name,
        woo_product_sku: c.woo_product_sku ?? c.core_sku,
        woo_raw_payload: null,
      },
      core: { id: c.core_id, core_sku: c.core_sku, name: c.core_name },
      policy: c.effective_policy,
    };
  }

  async function invalidateAfterPolicyEdit() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["fabricable-replacement-candidates"] }),
      queryClient.invalidateQueries({ queryKey: ["replenishment-policies"] }),
      queryClient.invalidateQueries({ queryKey: ["woo-product-map"] }),
      queryClient.invalidateQueries({ queryKey: ["core-products"] }),
    ]);
    await refetchCandidates();
  }

  async function save() {
    if (!selected) return;
    if (status === "replaced" && !replacement) {
      toast({ title: "Falta reemplazo", description: "Selecciona un producto reemplazo.", variant: "destructive" });
      return;
    }
    if (status === "replaced" && replacement) {
      if (replacement.blocked_reason) {
        toast({
          title: "Reemplazo no disponible",
          description: `${replacement.core_sku} no puede usarse como reemplazo porque su política actual es ${replacement.blocked_reason}. Cambia su política a Activo + Fabricación interna con restock habilitado, o selecciona otro producto.`,
          variant: "destructive",
        });
        return;
      }
      const sameCore = !!selected.core?.id && replacement.core_id === selected.core?.id;
      const sameWoo = originalWooId != null && replacement.woo_product_id === originalWooId;
      if (sameCore || sameWoo) {
        toast({
          title: "Configuración inválida",
          description: "Un producto no puede reemplazarse por sí mismo.",
          variant: "destructive",
        });
        return;
      }
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      const m = selected.map;
      const patch: any = {
        woo_product_id: m.woo_product_id,
        core_product_id: selected.core?.id ?? null,
        product_name_snapshot: m.woo_product_name,
        sku_snapshot: m.woo_product_sku,
        lifecycle_status: status,
        restock_enabled: false,
        decision_reason: reason || null,
        last_reviewed_at: new Date().toISOString(),
        reviewed_by: uid,
        updated_by: uid,
      };
      if (status === "replaced") {
        patch.replacement_product_id = replacement?.core_id ?? null;
        patch.replacement_woo_product_id = replacement?.woo_product_id ?? null;
        patch.replacement_behavior = behavior;
      }
      const { previous } = await upsertPolicy(patch);
      await logStrategyDecision({
        woo_product_id: m.woo_product_id,
        core_product_id: selected.core?.id ?? null,
        decision_type: "set_no_restock_policy",
        previous_values: {
          lifecycle_status: previous?.lifecycle_status ?? null,
          replacement_product_id: previous?.replacement_product_id ?? null,
          replacement_woo_product_id: previous?.replacement_woo_product_id ?? null,
          replacement_behavior: previous?.replacement_behavior ?? null,
        },
        new_values: {
          lifecycle_status: status,
          replacement_product_id: patch.replacement_product_id ?? null,
          replacement_woo_product_id: patch.replacement_woo_product_id ?? null,
          replacement_behavior: patch.replacement_behavior ?? null,
        },
        reason: reason || null,
      });
      toast({ title: "Política guardada" });
      onDone();
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function renderResult(ctx: Ctx, onPick: () => void, opts?: { showAlreadyConfigured?: boolean }) {
    const m = ctx.map;
    const already = opts?.showAlreadyConfigured && ["no_restock", "exit", "replaced"].includes(ctx.policy?.lifecycle_status ?? "");
    const img = m.woo_raw_payload?.images?.[0]?.src as string | undefined;
    return (
      <div key={m.id} className="flex items-center gap-3 p-2 border-b hover:bg-muted/40">
        {img ? (
          <img src={img} alt="" className="h-10 w-10 rounded object-cover border" />
        ) : (
          <div className="h-10 w-10 rounded bg-muted border" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{m.woo_product_name ?? "—"}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            Woo #{m.woo_product_id} · {m.woo_product_sku ?? "sin SKU"}
          </div>
          <div className="flex gap-1 mt-1 flex-wrap">
            <Badge variant={ctx.core ? "default" : "outline"} className="text-[9px]">
              {ctx.core ? "Core conectado" : "Sin conexión Core"}
            </Badge>
            <Badge variant="outline" className="text-[9px]">Política: {policyLabel(ctx)}</Badge>
          </div>
        </div>
        {already ? (
          <Button size="sm" variant="outline" onClick={onPick}>Editar política</Button>
        ) : (
          <Button size="sm" onClick={onPick}>Seleccionar</Button>
        )}
      </div>
    );
  }

  function renderCandidate(c: FabricableCandidate) {
    const blocked = !!c.blocked_reason;
    return (
      <div key={c.core_id} className={`flex items-center gap-3 p-2 border-b hover:bg-muted/40 ${blocked ? "opacity-70" : ""}`}>
        {c.woo_image ? (
          <img src={c.woo_image} alt="" className="h-10 w-10 rounded object-cover border" />
        ) : (
          <div className="h-10 w-10 rounded bg-muted border" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{c.core_name}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            Core: {c.core_sku}
            {c.woo_product_id ? ` · Woo #${c.woo_product_id}` : " · Sin Woo"}
            {c.woo_product_sku ? ` · ${c.woo_product_sku}` : ""}
          </div>
          <div className="flex gap-1 mt-1 flex-wrap">
            {blocked ? (
              <Badge variant="destructive" className="text-[9px]">No disponible · {c.blocked_reason}</Badge>
            ) : c.has_policy ? (
              <Badge className="text-[9px]">Fabricable</Badge>
            ) : (
              <Badge className="text-[9px]">Fabricable · Sin política explícita</Badge>
            )}
            <Badge variant="outline" className="text-[9px]">
              {c.product_type === "variable" ? `${c.variants_count} variantes` : "Producto simple"}
            </Badge>
            {c.has_cost_structure && <Badge variant="outline" className="text-[9px]">Costo</Badge>}
          </div>
        </div>
        <Button size="sm" disabled={blocked} onClick={() => !blocked && setReplacement(c)}>
          Seleccionar
        </Button>
      </div>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={o => !o && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selected ? "Configurar política" : "Agregar producto a No restock / Reemplazos"}
            </DialogTitle>
          </DialogHeader>

          {!selected ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por Woo Product ID o título…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8"
                  autoFocus
                />
              </div>
              <div className="max-h-[420px] overflow-y-auto border rounded">
                {results.length === 0 ? (
                  <p className="p-6 text-center text-xs text-muted-foreground">Sin resultados</p>
                ) : (
                  results.map(r => renderResult(r, () => setSelected(r), { showAlreadyConfigured: true }))
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Fuente: productos ya importados en Mapa Woo/Core. No se crean productos nuevos.
              </p>
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              {!initialCtx && (
                <button
                  onClick={() => setSelected(null)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3 w-3" /> Cambiar producto
                </button>
              )}
              <div className="border rounded p-2">
                <div className="text-xs text-muted-foreground">Producto</div>
                <div className="font-medium">{selected.map.woo_product_name}</div>
                <div className="text-[10px] text-muted-foreground">
                  Woo #{selected.map.woo_product_id} · {selected.map.woo_product_sku ?? "sin SKU"} ·{" "}
                  {selected.core ? `Core: ${selected.core.core_sku}` : "Sin conexión Core"}
                </div>
              </div>

              <div>
                <Label>Estado</Label>
                <Select value={status} onValueChange={v => setStatus(v as LifecycleChoice)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LIFECYCLE_CHOICES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {LIFECYCLE_CHOICES.find(c => c.value === status)?.hint}
                </p>
              </div>

              {status === "replaced" && (
                <div className="space-y-2 border rounded p-2 bg-muted/30">
                  <Label>Producto reemplazo</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Fuente: Catálogo de Fabricación. Solo productos Core activos, fabricables y con restock habilitado.
                  </p>
                  {replacement ? (
                    <div className="p-2 bg-background border rounded space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{replacement.core_name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Core: {replacement.core_sku}
                            {replacement.woo_product_id ? ` · Woo #${replacement.woo_product_id}` : " · Sin Woo"}
                          </div>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {replacement.blocked_reason ? (
                              <Badge variant="destructive" className="text-[9px]">
                                No disponible · {replacement.blocked_reason}
                              </Badge>
                            ) : replacement.has_policy ? (
                              <Badge className="text-[9px]">Fabricable</Badge>
                            ) : (
                              <Badge className="text-[9px]">Fabricable · Sin política explícita</Badge>
                            )}
                            <Badge variant="outline" className="text-[9px]">
                              {replacement.product_type === "variable"
                                ? `${replacement.variants_count} variantes`
                                : "Producto simple"}
                            </Badge>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setReplacement(null)}>Cambiar</Button>
                      </div>
                      {replacement.blocked_reason && (
                        <div className="border rounded p-2 bg-destructive/5 text-[11px] space-y-2">
                          <div>
                            {replacement.core_sku} no puede usarse como reemplazo porque su política actual es{" "}
                            <b>{replacement.blocked_reason}</b>. Cambia su política a Activo + Fabricación interna con
                            restock habilitado, o selecciona otro producto.
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLifecycleEdit(candidateCtx(replacement))}
                            >
                              Cambiar estado
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRouteEdit(candidateCtx(replacement))}
                            >
                              Cambiar ruta
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por nombre Core, SKU Core, Woo ID, nombre o SKU Woo…"
                          value={replacementSearch}
                          onChange={e => setReplacementSearch(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                      <div className="max-h-72 overflow-y-auto border rounded bg-background">
                        {loadingCandidates ? (
                          <p className="p-4 text-center text-xs text-muted-foreground">
                            <Loader2 className="inline h-3 w-3 mr-1 animate-spin" /> Cargando catálogo…
                          </p>
                        ) : filteredCandidates.length === 0 ? (
                          <p className="p-4 text-center text-xs text-muted-foreground">
                            Sin resultados en el Catálogo de Fabricación.
                          </p>
                        ) : (
                          filteredCandidates.map(renderCandidate)
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Los productos bloqueados por política sólo aparecen si buscas por SKU o Woo ID exacto.
                      </p>
                    </>
                  )}

                  <div>
                    <Label>Comportamiento</Label>
                    <Select value={behavior} onValueChange={setBehavior}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(REPLACEMENT_BEHAVIOR_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div>
                <Label>Razón / nota</Label>
                <Textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            {selected && (
              <Button onClick={save} disabled={saving || (status === "replaced" && !!replacement?.blocked_reason)}>
                {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Guardar política
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {lifecycleEdit && (
        <LifecycleStatusDialog
          open={!!lifecycleEdit}
          onClose={() => setLifecycleEdit(null)}
          onDone={() => { void invalidateAfterPolicyEdit(); }}
          ctx={lifecycleEdit}
        />
      )}
      {routeEdit && (
        <ReplenishmentRouteDialog
          open={!!routeEdit}
          onClose={() => setRouteEdit(null)}
          onDone={() => { void invalidateAfterPolicyEdit(); }}
          ctx={routeEdit}
        />
      )}
    </>
  );
}
