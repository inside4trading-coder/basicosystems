import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, RefreshCw, Plug, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDMY } from "@/lib/dateUtils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SyncRun {
  id: string;
  sync_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  products_checked: number;
  products_created: number;
  products_updated: number;
  variants_checked: number;
  variants_created: number;
  variants_updated: number;
  skipped_no_sku: number;
  errors_count: number;
  summary: any;
}

export default function EspanaWooCommerce() {
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [conn, setConn] = useState<{ status: "unknown" | "connected" | "not_connected" | "error"; message?: string; total?: string | null }>({ status: "unknown" });
  const [totals, setTotals] = useState({ products: 0, variants: 0, wooProducts: 0, wooVariants: 0 });

  const loadRuns = async () => {
    const { data } = await supabase.from("esp_woo_sync_runs")
      .select("*").order("started_at", { ascending: false }).limit(15);
    setRuns((data || []) as SyncRun[]);
  };

  const loadTotals = async () => {
    const [p, v, wp, wv] = await Promise.all([
      supabase.from("esp_products").select("id", { count: "exact", head: true }),
      supabase.from("esp_product_variants").select("id", { count: "exact", head: true }),
      supabase.from("esp_products").select("id", { count: "exact", head: true }).eq("source", "woocommerce_es"),
      supabase.from("esp_product_variants").select("id", { count: "exact", head: true }).eq("source", "woocommerce_es"),
    ]);
    setTotals({
      products: p.count || 0, variants: v.count || 0,
      wooProducts: wp.count || 0, wooVariants: wv.count || 0,
    });
  };

  useEffect(() => { loadRuns(); loadTotals(); }, []);

  const testConn = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("esp-woo-sync-catalog", { body: { action: "test" } });
    setTesting(false);
    if (error) { setConn({ status: "error", message: error.message }); toast.error(error.message); return; }
    if (data?.ok) {
      setConn({ status: "connected", total: data.products_total });
      toast.success(`Conectado · ${data.products_total ?? "?"} productos en Woo`);
    } else if (data?.error === "missing_credentials") {
      setConn({ status: "not_connected", message: data.message });
    } else {
      setConn({ status: "error", message: data?.error || "Error desconocido" });
    }
  };

  const sync = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("esp-woo-sync-catalog", { body: { action: "sync" } });
    setSyncing(false);
    if (error) { toast.error(error.message); return; }
    if (data?.ok) {
      toast.success(`Sincronización OK: ${data.products_created} nuevos, ${data.products_updated} actualizados · ${data.variants_created + data.variants_updated} variantes`);
    } else {
      toast.error(data?.error || "Error en sincronización");
    }
    loadRuns(); loadTotals();
  };

  const statusBadge = (s: string) => {
    if (s === "completed") return <Badge className="bg-emerald-600">OK</Badge>;
    if (s === "completed_with_errors") return <Badge className="bg-amber-600">Con avisos</Badge>;
    if (s === "failed") return <Badge variant="destructive">Error</Badge>;
    if (s === "running") return <Badge variant="outline">En curso</Badge>;
    return <Badge variant="outline">{s}</Badge>;
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
          <Globe className="h-6 w-6 text-primary" /> WooCommerce España
        </h2>
        <p className="text-sm text-muted-foreground">Sincronización de catálogo desde basicoclothes.es · modo solo lectura.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Conexión</p>
            {conn.status === "connected" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            {conn.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
            {conn.status === "not_connected" && <AlertCircle className="h-4 w-4 text-amber-500" />}
          </div>
          <div>
            <p className="text-sm font-mono">basicoclothes.es</p>
            <p className="text-xs text-muted-foreground">
              {conn.status === "connected" && `Conectado · ${conn.total ?? "?"} productos`}
              {conn.status === "not_connected" && (conn.message || "No conectado")}
              {conn.status === "error" && `Error: ${conn.message}`}
              {conn.status === "unknown" && "Estado desconocido"}
            </p>
            <Badge variant="outline" className="mt-2 text-[10px]">read-only</Badge>
          </div>
          <Button size="sm" variant="outline" onClick={testConn} disabled={testing} className="w-full">
            {testing ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Plug className="h-3.5 w-3.5 mr-2" />}
            Probar conexión
          </Button>
        </Card>

        <Card className="p-4 space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Catálogo España</p>
          <div className="space-y-1">
            <p className="text-2xl font-black">{totals.products}<span className="text-sm text-muted-foreground font-normal"> productos</span></p>
            <p className="text-xs text-muted-foreground">{totals.variants} variantes totales</p>
            <p className="text-xs"><span className="text-primary font-semibold">{totals.wooProducts}</span> desde Woo · <span className="text-muted-foreground">{totals.products - totals.wooProducts} manuales</span></p>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Última sincronización</p>
          {runs[0] ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">{statusBadge(runs[0].status)}<span className="text-xs text-muted-foreground">{formatDMY(runs[0].started_at)}</span></div>
              <p className="text-xs">{runs[0].products_created}+{runs[0].products_updated} productos · {runs[0].variants_created}+{runs[0].variants_updated} variantes</p>
              {runs[0].errors_count > 0 && <p className="text-xs text-destructive">{runs[0].errors_count} errores</p>}
            </div>
          ) : <p className="text-xs text-muted-foreground">Sin sincronizaciones aún</p>}
          <Button size="sm" onClick={sync} disabled={syncing} className="w-full">
            {syncing ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
            Sincronizar catálogo
          </Button>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-bold mb-3">Historial de sincronizaciones</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Productos</TableHead>
                <TableHead className="text-right">Variantes</TableHead>
                <TableHead className="text-right">Sin SKU</TableHead>
                <TableHead className="text-right">Errores</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Sin historial todavía.</TableCell></TableRow>}
              {runs.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{new Date(r.started_at).toLocaleString("es-ES")}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-right text-xs">{r.products_checked} <span className="text-muted-foreground">({r.products_created}+/{r.products_updated}↻)</span></TableCell>
                  <TableCell className="text-right text-xs">{r.variants_checked} <span className="text-muted-foreground">({r.variants_created}+/{r.variants_updated}↻)</span></TableCell>
                  <TableCell className="text-right text-xs">{r.skipped_no_sku || 0}</TableCell>
                  <TableCell className="text-right text-xs">{r.errors_count > 0 ? <span className="text-destructive font-semibold">{r.errors_count}</span> : "0"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
