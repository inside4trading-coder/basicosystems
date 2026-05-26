import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logCoreAudit } from "@/lib/coreAudit";
import { toast } from "sonner";
import { Search, Link2, Plus, Ban, EyeOff, DollarSign, RefreshCw, Loader2 } from "lucide-react";

export type PendingItem = {
  id: string;
  source_order_id: number;
  source_order_item_id: number | null;
  woo_product_id: number | null;
  woo_variation_id: number | null;
  woo_sku: string | null;
  product_name: string | null;
  quantity: number | null;
  revenue: number | null;
  order_status: string | null;
  reason: string;
  suggested_action: string | null;
  status: string;
  created_at: string;
  fabrication_fund_run_id: string | null;
  linked_core_product_id: string | null;
  linked_core_variant_id: string | null;
  marked_non_restockable: boolean;
  ignored_reason: string | null;
};

const REASON_LABEL: Record<string, string> = {
  missing_sku: "Sin SKU",
  product_not_in_core: "Falta en Catálogo de Fabricación",
  variation_not_mapped: "Variante no mapeada",
  unit_cost_missing: "Sin costo",
  non_restockable_not_classified: "Sin clasificar restock",
  product_deleted_or_unavailable: "Producto eliminado",
  sync_error: "Error de sync",
  missing_cost: "Sin costo",
};
const REASON_BADGE: Record<string, string> = {
  missing_sku: "bg-orange-100 text-orange-800 border-orange-300",
  product_not_in_core: "bg-blue-100 text-blue-800 border-blue-300",
  variation_not_mapped: "bg-indigo-100 text-indigo-800 border-indigo-300",
  unit_cost_missing: "bg-yellow-100 text-yellow-800 border-yellow-300",
  missing_cost: "bg-yellow-100 text-yellow-800 border-yellow-300",
  non_restockable_not_classified: "bg-purple-100 text-purple-800 border-purple-300",
  product_deleted_or_unavailable: "bg-rose-100 text-rose-800 border-rose-300",
  sync_error: "bg-red-100 text-red-800 border-red-300",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  resolved: "Resuelto",
  ignored: "Ignorado",
  linked: "Asociado",
  non_restockable: "No restock",
  processed: "Procesado",
};
const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-300",
  ignored: "bg-muted text-muted-foreground border-border",
  linked: "bg-blue-100 text-blue-800 border-blue-300",
  non_restockable: "bg-orange-100 text-orange-800 border-orange-300",
  processed: "bg-emerald-200 text-emerald-900 border-emerald-400",
};

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));

type CoreProductOption = { id: string; name: string; core_sku: string; unit_cost: number | null; currency: string; is_restockable: boolean };

export default function PendingResolutionPanel({ onChanged }: { onChanged: () => void }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [coreOptions, setCoreOptions] = useState<CoreProductOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filters
  const [fReason, setFReason] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("pending");
  const [fLinked, setFLinked] = useState<string>("all"); // all | linked | unlinked
  const [fSearch, setFSearch] = useState<string>("");

  // Dialogs
  const [linkOpen, setLinkOpen] = useState<{ items: PendingItem[] } | null>(null);
  const [createOpen, setCreateOpen] = useState<{ items: PendingItem[] } | null>(null);
  const [nonRestockOpen, setNonRestockOpen] = useState<{ items: PendingItem[] } | null>(null);
  const [ignoreOpen, setIgnoreOpen] = useState<{ items: PendingItem[] } | null>(null);
  const [costOpen, setCostOpen] = useState<{ item: PendingItem } | null>(null);
  const [reprocessing, setReprocessing] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: cp }] = await Promise.all([
      supabase.from("core_fabrication_fund_pending_items").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("core_products").select("id, name, core_sku, unit_cost, currency, is_restockable").order("name").limit(2000),
    ]);
    setItems((p as any) ?? []);
    setCoreOptions((cp as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = fSearch.trim().toLowerCase();
    return items.filter(it => {
      if (fReason !== "all" && it.reason !== fReason) return false;
      if (fStatus !== "all" && it.status !== fStatus) return false;
      if (fLinked === "linked" && !it.linked_core_product_id) return false;
      if (fLinked === "unlinked" && it.linked_core_product_id) return false;
      if (s) {
        const hay = `${it.woo_sku ?? ""} ${it.product_name ?? ""} ${it.source_order_id} ${it.woo_product_id ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [items, fReason, fStatus, fLinked, fSearch]);

  const selectedItems = useMemo(() => items.filter(it => selected.has(it.id)), [items, selected]);

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(it => it.id)));
  }

  async function reprocess(idsOnly?: string[]) {
    setReprocessing(true);
    try {
      const body: any = { mode: "reprocess_pending" };
      if (idsOnly && idsOnly.length > 0) body.pending_ids = idsOnly;
      const { data, error } = await supabase.functions.invoke("core-process-fabrication-funds", { body });
      if (error) throw error;
      const s = (data as any)?.summary ?? {};
      toast.success(`Reprocesados: ${s.movements_created ?? 0} movimientos generados, ${s.pending_processed ?? 0} pendientes resueltos.`);
      setSelected(new Set());
      load();
      onChanged();
    } catch (e: any) {
      toast.error(`Error: ${e.message ?? e}`);
    } finally {
      setReprocessing(false);
    }
  }

  return (
    <Card className="p-4 space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-[10px] uppercase">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="h-9 pl-7" placeholder="SKU, producto, order ID, Woo product ID" value={fSearch} onChange={e => setFSearch(e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="text-[10px] uppercase">Motivo</Label>
          <Select value={fReason} onValueChange={setFReason}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(REASON_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] uppercase">Estado</Label>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] uppercase">Core asociado</Label>
          <Select value={fLinked} onValueChange={setFLinked}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="linked">Asociados</SelectItem>
              <SelectItem value="unlinked">Sin asociar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => reprocess()} disabled={reprocessing}>
          {reprocessing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Reprocesar resueltos
        </Button>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
          <span className="text-xs font-semibold">{selected.size} seleccionados</span>
          <Button size="sm" variant="outline" onClick={() => setLinkOpen({ items: selectedItems })}><Link2 className="h-3 w-3 mr-1" />Asociar a Core</Button>
          <Button size="sm" variant="outline" onClick={() => setNonRestockOpen({ items: selectedItems })}><Ban className="h-3 w-3 mr-1" />No restockeable</Button>
          <Button size="sm" variant="outline" onClick={() => setIgnoreOpen({ items: selectedItems })}><EyeOff className="h-3 w-3 mr-1" />Ignorar</Button>
          <Button size="sm" variant="default" onClick={() => reprocess(Array.from(selected))} disabled={reprocessing}>
            <RefreshCw className="h-3 w-3 mr-1" />Reprocesar seleccionados
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpiar</Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Woo IDs</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Core</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Sin pendientes con esos filtros.</TableCell></TableRow>
            ) : filtered.map(it => {
              const linked = coreOptions.find(c => c.id === it.linked_core_product_id);
              const canResolve = it.status === "pending" || it.status === "linked" || it.status === "non_restockable" || it.status === "resolved";
              return (
                <TableRow key={it.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(it.id)} onCheckedChange={() => {
                      const s = new Set(selected); s.has(it.id) ? s.delete(it.id) : s.add(it.id); setSelected(s);
                    }} />
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(it.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-xs font-mono">#{it.source_order_id}{it.source_order_item_id ? ` / ${it.source_order_item_id}` : ""}</TableCell>
                  <TableCell className="text-[11px] font-mono text-muted-foreground">
                    {it.woo_product_id ? `P:${it.woo_product_id}` : "—"}
                    {it.woo_variation_id ? ` V:${it.woo_variation_id}` : ""}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{it.woo_sku ?? "—"}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate" title={it.product_name ?? ""}>{it.product_name ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs">{it.quantity ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs font-mono">{it.revenue ? usd(it.revenue) : "—"}</TableCell>
                  <TableCell><Badge variant="outline" className={REASON_BADGE[it.reason] ?? ""}>{REASON_LABEL[it.reason] ?? it.reason}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_BADGE[it.status] ?? ""}>{STATUS_LABEL[it.status] ?? it.status}</Badge></TableCell>
                  <TableCell className="text-xs">{linked ? <span title={linked.name}>{linked.core_sku}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {canResolve && (
                      <div className="flex gap-1 flex-wrap">
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setLinkOpen({ items: [it] })} title="Asociar a Core"><Link2 className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setCreateOpen({ items: [it] })} title="Crear Producto Core"><Plus className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setNonRestockOpen({ items: [it] })} title="No restockeable"><Ban className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setIgnoreOpen({ items: [it] })} title="Ignorar"><EyeOff className="h-3.5 w-3.5" /></Button>
                        {(it.reason === "unit_cost_missing" || it.reason === "missing_cost") && it.linked_core_product_id && (
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setCostOpen({ item: it })} title="Completar costo"><DollarSign className="h-3.5 w-3.5" /></Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {linkOpen && <LinkDialog items={linkOpen.items} coreOptions={coreOptions} onClose={() => setLinkOpen(null)} onDone={() => { setLinkOpen(null); setSelected(new Set()); load(); onChanged(); }} />}
      {createOpen && <CreateDialog items={createOpen.items} onClose={() => setCreateOpen(null)} onDone={() => { setCreateOpen(null); setSelected(new Set()); load(); onChanged(); }} />}
      {nonRestockOpen && <NonRestockDialog items={nonRestockOpen.items} onClose={() => setNonRestockOpen(null)} onDone={() => { setNonRestockOpen(null); setSelected(new Set()); load(); onChanged(); }} />}
      {ignoreOpen && <IgnoreDialog items={ignoreOpen.items} onClose={() => setIgnoreOpen(null)} onDone={() => { setIgnoreOpen(null); setSelected(new Set()); load(); onChanged(); }} />}
      {costOpen && <CostDialog item={costOpen.item} coreOptions={coreOptions} onClose={() => setCostOpen(null)} onDone={() => { setCostOpen(null); load(); onChanged(); }} />}
    </Card>
  );
}

// --------- Dialogs ---------

function LinkDialog({ items, coreOptions, onClose, onDone }: { items: PendingItem[]; coreOptions: CoreProductOption[]; onClose: () => void; onDone: () => void }) {
  const [search, setSearch] = useState("");
  const [coreId, setCoreId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return coreOptions.slice(0, 30);
    return coreOptions.filter(c => `${c.name} ${c.core_sku}`.toLowerCase().includes(s)).slice(0, 30);
  }, [search, coreOptions]);
  const selectedCore = coreOptions.find(c => c.id === coreId);

  async function save() {
    if (!coreId) return toast.error("Selecciona un Producto Core");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const noCost = !selectedCore?.unit_cost || Number(selectedCore.unit_cost) <= 0;
    try {
      for (const it of items) {
        const before = { status: it.status, linked_core_product_id: it.linked_core_product_id };
        await supabase.from("core_fabrication_fund_pending_items").update({
          linked_core_product_id: coreId,
          status: noCost ? "linked" : "linked",
          reason: noCost ? "unit_cost_missing" : it.reason,
          last_action_at: new Date().toISOString(),
          last_action_by: user?.id ?? null,
        }).eq("id", it.id);
        await logCoreAudit({ table: "core_fabrication_fund_pending_items", recordId: it.id, action: "link_to_core", oldValue: before, newValue: { linked_core_product_id: coreId } });
      }
      toast.success(`${items.length} pendiente(s) asociado(s). Recuerda reprocesar.`);
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Asociar a Producto Core ({items.length})</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Buscar por nombre o SKU…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="rounded-md border max-h-[300px] overflow-y-auto">
            {filtered.map(c => (
              <button key={c.id} type="button" className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 hover:bg-muted ${coreId === c.id ? "bg-primary/10" : ""}`} onClick={() => setCoreId(c.id)}>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{c.core_sku} · costo {c.unit_cost ? usd(Number(c.unit_cost)) : "sin costo"} · {c.is_restockable ? "restock" : "no restock"}</div>
              </button>
            ))}
            {filtered.length === 0 && <div className="p-3 text-xs text-muted-foreground">Sin resultados</div>}
          </div>
          {selectedCore && (!selectedCore.unit_cost || Number(selectedCore.unit_cost) <= 0) && (
            <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 p-2 rounded">⚠ Este Producto Core no tiene costo. El pendiente quedará marcado como <code>unit_cost_missing</code> hasta que asignes uno.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !coreId}>{saving ? "Guardando…" : "Asociar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateDialog({ items, onClose, onDone }: { items: PendingItem[]; onClose: () => void; onDone: () => void }) {
  const single = items.length === 1 ? items[0] : null;
  const [name, setName] = useState(single?.product_name ?? "");
  const [sku, setSku] = useState(single?.woo_sku ?? "");
  const [unitCost, setUnitCost] = useState("");
  const [restockable, setRestockable] = useState(true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!items.length) return;
    if (single) {
      if (!name.trim() || !sku.trim()) return toast.error("Nombre y SKU obligatorios");
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    try {
      for (const it of items) {
        const useName = single ? name : (it.product_name ?? "");
        const useSku = single ? sku : (it.woo_sku ?? "");
        if (!useName || !useSku) continue;
        const { data: prod, error } = await supabase.from("core_products").insert({
          name: useName, core_sku: useSku, woo_sku: it.woo_sku, woo_product_id: it.woo_product_id,
          unit_cost: unitCost ? Number(unitCost) : 0, currency: "USD",
          is_restockable: restockable, sku_source: "manual", sync_status: "manual_only",
          commercial_status: "active", created_by: user?.id ?? null,
        }).select().single();
        if (error) throw error;
        const noCost = !unitCost || Number(unitCost) <= 0;
        await supabase.from("core_fabrication_fund_pending_items").update({
          linked_core_product_id: prod.id,
          status: "linked",
          reason: noCost ? "unit_cost_missing" : it.reason,
          last_action_at: new Date().toISOString(), last_action_by: user?.id ?? null,
        }).eq("id", it.id);
        await logCoreAudit({ table: "core_products", recordId: prod.id, action: "create_from_pending", newValue: { name: useName, sku: useSku, pending_id: it.id } });
      }
      toast.success(`${items.length} Producto(s) Core creado(s) y asociado(s).`);
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Crear Producto Core{single ? "" : ` (${items.length})`}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {single ? (
            <>
              <div><Label>Nombre *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
              <div><Label>SKU Core *</Label><Input value={sku} onChange={e => setSku(e.target.value)} /></div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Se creará un Producto Core por cada pendiente usando su nombre y SKU de Woo. Los que no tengan SKU se omitirán.</p>
          )}
          <div><Label>Costo unitario USD (opcional)</Label><Input type="number" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={restockable} onCheckedChange={v => setRestockable(!!v)} /> Es restockeable
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Creando…" : "Crear y asociar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NonRestockDialog({ items, onClose, onDone }: { items: PendingItem[]; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!reason.trim()) return toast.error("Motivo obligatorio");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    try {
      for (const it of items) {
        // Register in restock control
        if (it.woo_product_id || it.woo_sku) {
          await supabase.from("core_restock_control").insert({
            reference_type: it.woo_variation_id ? "woo_variation" : (it.woo_product_id ? "woo_product" : "sku"),
            woo_product_id: it.woo_product_id, woo_variation_id: it.woo_variation_id, sku: it.woo_sku,
            product_name: it.product_name, reason: "no_restockeable_desde_pendiente", custom_reason: reason,
            status: "active", created_by: user?.id ?? null,
          });
        }
        await supabase.from("core_fabrication_fund_pending_items").update({
          marked_non_restockable: true, status: "non_restockable",
          last_action_at: new Date().toISOString(), last_action_by: user?.id ?? null,
        }).eq("id", it.id);
        await logCoreAudit({ table: "core_fabrication_fund_pending_items", recordId: it.id, action: "mark_non_restockable", newValue: { reason } });
      }
      toast.success(`${items.length} marcado(s) como no restockeable.`);
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Marcar como No Restockeable ({items.length})</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Al reprocesar, estos ítems sumarán a la Partida No Restockeable.</p>
          <div><Label>Motivo *</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Marcar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IgnoreDialog({ items, onClose, onDone }: { items: PendingItem[]; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!reason.trim()) return toast.error("Motivo obligatorio");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    try {
      for (const it of items) {
        await supabase.from("core_fabrication_fund_pending_items").update({
          status: "ignored", ignored_reason: reason, ignored_at: new Date().toISOString(), ignored_by: user?.id ?? null,
          last_action_at: new Date().toISOString(), last_action_by: user?.id ?? null,
        }).eq("id", it.id);
        await logCoreAudit({ table: "core_fabrication_fund_pending_items", recordId: it.id, action: "ignore_pending", newValue: { reason } });
      }
      toast.success(`${items.length} ignorado(s).`);
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Ignorar pendiente(s) ({items.length})</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Los pendientes ignorados quedan trazados pero no generan movimientos.</p>
          <div><Label>Motivo *</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Ignorar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CostDialog({ item, coreOptions, onClose, onDone }: { item: PendingItem; coreOptions: CoreProductOption[]; onClose: () => void; onDone: () => void }) {
  const core = coreOptions.find(c => c.id === item.linked_core_product_id);
  const [cost, setCost] = useState(core?.unit_cost ? String(core.unit_cost) : "");
  const [saving, setSaving] = useState(false);
  async function save() {
    const n = Number(cost);
    if (!n || n <= 0) return toast.error("Costo debe ser mayor a 0");
    if (!core) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    try {
      await supabase.from("core_products").update({ unit_cost: n, updated_by: user?.id ?? null }).eq("id", core.id);
      await supabase.from("core_fabrication_fund_pending_items").update({
        reason: "unit_cost_missing", status: "linked",
        last_action_at: new Date().toISOString(), last_action_by: user?.id ?? null,
      }).eq("id", item.id);
      await logCoreAudit({ table: "core_products", recordId: core.id, action: "update_unit_cost_from_pending", oldValue: { unit_cost: core.unit_cost }, newValue: { unit_cost: n } });
      toast.success("Costo actualizado. Listo para reprocesar.");
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Completar costo unitario</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{core?.name} <span className="font-mono">({core?.core_sku})</span></p>
          <div><Label>Costo unitario USD *</Label><Input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar costo"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
