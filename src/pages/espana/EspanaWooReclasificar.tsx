import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, ShieldAlert, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Row = {
  id: string;
  name: string;
  sku: string | null;
  woo_product_id: number | null;
  woo_manage_stock: boolean | null;
  woo_stock_status: string | null;
  woo_stock_quantity: number | null;
  fulfillment_mode: string | null;
  web_stock_policy: string | null;
  is_made_to_order: boolean | null;
  requires_fabrication: boolean | null;
  operation_policy_locked: boolean;
};

type Suggestion = {
  fulfillment_mode: "made_to_order" | "physical_stock";
  web_stock_policy: "no_web_stock" | "woo_managed_stock";
  is_made_to_order: boolean;
  requires_fabrication: boolean;
};

function suggest(row: Row): Suggestion | null {
  if (row.woo_manage_stock === null || row.woo_manage_stock === undefined) return null;
  if (row.woo_manage_stock === false) {
    return { fulfillment_mode: "made_to_order", web_stock_policy: "no_web_stock", is_made_to_order: true, requires_fabrication: true };
  }
  return { fulfillment_mode: "physical_stock", web_stock_policy: "woo_managed_stock", is_made_to_order: false, requires_fabrication: false };
}

function isDifferent(row: Row, s: Suggestion): boolean {
  return row.fulfillment_mode !== s.fulfillment_mode
    || row.web_stock_policy !== s.web_stock_policy
    || (row.is_made_to_order ?? false) !== s.is_made_to_order
    || (row.requires_fabrication ?? false) !== s.requires_fabrication;
}

export default function EspanaWooReclasificar() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [override, setOverride] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("esp_products")
      .select("id, name, sku, woo_product_id, woo_manage_stock, woo_stock_status, woo_stock_quantity, fulfillment_mode, web_stock_policy, is_made_to_order, requires_fabrication, operation_policy_locked")
      .eq("source", "woocommerce_es")
      .order("name");
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data || []) as Row[]);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const noData = rows.filter(r => r.woo_manage_stock == null).length;
    const manageTrue = rows.filter(r => r.woo_manage_stock === true).length;
    const manageFalse = rows.filter(r => r.woo_manage_stock === false).length;
    const mto = rows.filter(r => r.fulfillment_mode === "made_to_order").length;
    const phys = rows.filter(r => r.fulfillment_mode === "physical_stock").length;
    const hyb = rows.filter(r => r.fulfillment_mode === "hybrid").length;
    const locked = rows.filter(r => r.operation_policy_locked).length;
    const willChange = rows.filter(r => {
      const s = suggest(r); if (!s) return false;
      if (r.operation_policy_locked && !override) return false;
      return isDifferent(r, s);
    }).length;
    const mismatch = rows.filter(r => {
      if (r.woo_manage_stock === true && r.fulfillment_mode === "made_to_order") return true;
      if (r.woo_manage_stock === false && r.fulfillment_mode === "physical_stock") return true;
      return false;
    });
    return { total, noData, manageTrue, manageFalse, mto, phys, hyb, locked, willChange, mismatch };
  }, [rows, override]);

  const apply = async () => {
    setApplying(true);
    let ok = 0; let skipped = 0; let failed = 0;
    for (const r of rows) {
      const s = suggest(r);
      if (!s) { skipped++; continue; }
      if (r.operation_policy_locked && !override) { skipped++; continue; }
      if (!isDifferent(r, s)) { skipped++; continue; }
      const { error } = await supabase.from("esp_products").update({
        fulfillment_mode: s.fulfillment_mode,
        web_stock_policy: s.web_stock_policy,
        is_made_to_order: s.is_made_to_order,
        requires_fabrication: s.requires_fabrication,
      }).eq("id", r.id);
      if (error) { failed++; console.error(r.id, error); } else { ok++; }
    }
    setApplying(false);
    if (failed > 0) toast.error(`Reclasificación: ${ok} OK · ${skipped} saltados · ${failed} errores`);
    else toast.success(`Reclasificación aplicada: ${ok} actualizados · ${skipped} sin cambios`);
    load();
  };

  const labelMode = (m: string | null) => {
    if (m === "made_to_order") return <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-400/40">Fabricación ligera</Badge>;
    if (m === "physical_stock") return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-400/40">Stock físico</Badge>;
    if (m === "hybrid") return <Badge variant="outline">Híbrido</Badge>;
    return <Badge variant="outline" className="text-muted-foreground">{m || "—"}</Badge>;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-primary" /> Reclasificación Woo ES
          </h2>
          <p className="text-sm text-muted-foreground">
            Recalcula <span className="font-semibold">fulfillment_mode</span> / <span className="font-semibold">web_stock_policy</span> a partir de <span className="font-mono">woo_manage_stock</span>. Solo modifica productos con <span className="font-mono">source = woocommerce_es</span> y campos Woo cargados. No toca WooCommerce, inventario ni POS.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
          Refrescar
        </Button>
      </div>

      {stats.noData > 0 && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/5 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Hay {stats.noData} productos sin <span className="font-mono">woo_manage_stock</span>.</p>
            <p className="text-xs text-muted-foreground">Antes de aplicar, ejecuta <a href="/espana/woocommerce" className="text-primary underline">Sincronizar catálogo</a> para poblar los campos informativos desde Woo. Esos productos no se tocarán en la reclasificación.</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-3"><p className="text-[10px] uppercase font-semibold text-muted-foreground">Total Woo ES</p><p className="text-2xl font-black">{stats.total}</p></Card>
        <Card className="p-3"><p className="text-[10px] uppercase font-semibold text-muted-foreground">manage_stock=true</p><p className="text-2xl font-black text-emerald-600">{stats.manageTrue}</p></Card>
        <Card className="p-3"><p className="text-[10px] uppercase font-semibold text-muted-foreground">manage_stock=false</p><p className="text-2xl font-black text-amber-600">{stats.manageFalse}</p></Card>
        <Card className="p-3"><p className="text-[10px] uppercase font-semibold text-muted-foreground">made_to_order</p><p className="text-2xl font-black">{stats.mto}</p></Card>
        <Card className="p-3"><p className="text-[10px] uppercase font-semibold text-muted-foreground">physical_stock</p><p className="text-2xl font-black">{stats.phys}</p></Card>
      </div>

      {stats.mismatch.length > 0 && (
        <Card className="p-4 border-destructive/40 bg-destructive/5">
          <div className="flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive mt-0.5" />
            <div className="text-sm flex-1">
              <p className="font-bold text-destructive">Divergencias manage_stock ↔ fulfillment_mode ({stats.mismatch.length})</p>
              <p className="text-xs text-muted-foreground mb-2">Pueden ser decisiones manuales o pendientes de reclasificar.</p>
              <ul className="text-xs space-y-0.5 list-disc pl-4">
                {stats.mismatch.map(m => (
                  <li key={m.id}><span className="font-mono">{m.sku || "—"}</span> · {m.name} — manage_stock={String(m.woo_manage_stock)}, fulfillment={m.fulfillment_mode}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-bold">Preview de reclasificación</h3>
            <p className="text-xs text-muted-foreground">{stats.willChange} productos cambiarían · {stats.locked} bloqueados manualmente</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={override} onCheckedChange={(v) => setOverride(!!v)} />
              Forzar override de productos bloqueados
            </label>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={applying || stats.willChange === 0}>
                  {applying ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-2" />}
                  Aplicar reclasificación ({stats.willChange})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Aplicar reclasificación a {stats.willChange} productos</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se actualizarán <span className="font-semibold">fulfillment_mode</span>, <span className="font-semibold">web_stock_policy</span>, <span className="font-semibold">is_made_to_order</span> y <span className="font-semibold">requires_fabrication</span> en BD local. No se escribe en WooCommerce. No se mueve inventario. Los productos manuales (no Woo) y bloqueados {override ? "SÍ se tocarán (override activo)" : "NO se tocarán"}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={apply}>Aplicar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-center">manage_stock</TableHead>
                <TableHead className="text-center">stock_status</TableHead>
                <TableHead className="text-right">qty</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Sugerido</TableHead>
                <TableHead className="text-center">Cambio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Sin productos Woo ES.</TableCell></TableRow>}
              {rows.map(r => {
                const s = suggest(r);
                const diff = s ? isDifferent(r, s) : false;
                const willApply = !!s && diff && (!r.operation_policy_locked || override);
                return (
                  <TableRow key={r.id} className={willApply ? "bg-primary/5" : ""}>
                    <TableCell className="text-xs max-w-[260px] truncate">
                      <div className="flex items-center gap-1.5">
                        {r.operation_policy_locked && <Badge variant="outline" className="text-[9px] px-1 py-0">🔒</Badge>}
                        {r.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{r.sku || "—"}</TableCell>
                    <TableCell className="text-center text-xs">
                      {r.woo_manage_stock === true && <Badge className="bg-emerald-600">true</Badge>}
                      {r.woo_manage_stock === false && <Badge className="bg-amber-600">false</Badge>}
                      {r.woo_manage_stock == null && <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">{r.woo_stock_status || "—"}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{r.woo_stock_quantity ?? "—"}</TableCell>
                    <TableCell>{labelMode(r.fulfillment_mode)}</TableCell>
                    <TableCell>{s ? labelMode(s.fulfillment_mode) : <span className="text-xs text-muted-foreground">Sin dato manage_stock</span>}</TableCell>
                    <TableCell className="text-center">
                      {!s ? <span className="text-xs text-muted-foreground">—</span>
                        : !diff ? <Badge variant="outline" className="text-emerald-700 border-emerald-400/40">OK</Badge>
                        : r.operation_policy_locked && !override ? <Badge variant="outline" className="text-muted-foreground">Bloqueado</Badge>
                        : <Badge className="bg-primary">Aplicar</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
