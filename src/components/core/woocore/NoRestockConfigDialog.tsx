import { useEffect, useMemo, useState } from "react";
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
import { REPLACEMENT_BEHAVIOR_LABELS } from "@/lib/coreReplenishment";
import { Search, ArrowLeft, Loader2 } from "lucide-react";

type LifecycleChoice = "no_restock" | "exit" | "replaced";

const LIFECYCLE_CHOICES: { value: LifecycleChoice; label: string; hint: string }[] = [
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
  /** If provided, opens directly in configure mode for that map (edit flow). */
  initialCtx?: Ctx | null;
  /** Preselect lifecycle status when policy has no explicit no_restock/exit/replaced yet. */
  initialStatus?: LifecycleChoice;
}

export function NoRestockConfigDialog({ open, onClose, onDone, rowsCtx, initialCtx, initialStatus }: Props) {

  const [selected, setSelected] = useState<Ctx | null>(initialCtx ?? null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [replacementSearch, setReplacementSearch] = useState("");
  const [replacementDebounced, setReplacementDebounced] = useState("");

  const [status, setStatus] = useState<LifecycleChoice>("no_restock");
  const [replacement, setReplacement] = useState<Ctx | null>(null);
  const [behavior, setBehavior] = useState<string>("suggest_only");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    const t = setTimeout(() => setReplacementDebounced(replacementSearch.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [replacementSearch]);

  useEffect(() => {
    if (!selected) return;
    const p = selected.policy;
    const lcRaw = p?.lifecycle_status as LifecycleChoice | undefined;
    const validChoices: LifecycleChoice[] = ["no_restock", "exit", "replaced"];
    const alreadyDefined = lcRaw && validChoices.includes(lcRaw);
    setStatus(alreadyDefined ? (lcRaw as LifecycleChoice) : (initialStatus ?? "no_restock"));

    setBehavior(p?.replacement_behavior ?? "suggest_only");
    setReason(p?.decision_reason ?? "");
    if (p?.replacement_product_id) {
      const found = rowsCtx.find(r => r.core?.id === p.replacement_product_id);
      setReplacement(found ?? null);
    } else if (p?.replacement_woo_product_id) {
      const found = rowsCtx.find(r => r.map.woo_product_id === p.replacement_woo_product_id);
      setReplacement(found ?? null);
    } else {
      setReplacement(null);
    }
  }, [selected, rowsCtx, initialStatus]);

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
  const replacementResults = useMemo(
    () => filterRows(replacementDebounced, { wooId: selected?.map.woo_product_id, coreId: selected?.core?.id ?? null }),
    [replacementDebounced, rowsCtx, selected?.map.woo_product_id, selected?.core?.id],
  );

  function policyLabel(ctx: Ctx) {
    const lc = ctx.policy?.lifecycle_status;
    if (!lc || lc === "active") return "Sin definir";
    return lc;
  }

  async function save() {
    if (!selected) return;
    if (status === "replaced" && !replacement) {
      toast({ title: "Falta reemplazo", description: "Selecciona un producto reemplazo.", variant: "destructive" });
      return;
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
        patch.replacement_product_id = replacement?.core?.id ?? null;
        patch.replacement_woo_product_id = replacement?.map.woo_product_id ?? null;
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

  return (
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
                {replacement ? (
                  <div className="flex items-center justify-between gap-2 p-2 bg-background border rounded">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{replacement.map.woo_product_name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        Woo #{replacement.map.woo_product_id}
                        {replacement.core ? ` · Core: ${replacement.core.core_sku}` : " · Sin Core"}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setReplacement(null)}>Cambiar</Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar reemplazo por Woo ID o título…"
                        value={replacementSearch}
                        onChange={e => setReplacementSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto border rounded bg-background">
                      {replacementResults.length === 0 ? (
                        <p className="p-4 text-center text-xs text-muted-foreground">Sin resultados</p>
                      ) : (
                        replacementResults.map(r => renderResult(r, () => setReplacement(r)))
                      )}
                    </div>
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
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Guardar política
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
