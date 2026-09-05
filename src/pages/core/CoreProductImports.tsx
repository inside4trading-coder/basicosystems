import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Eye } from "lucide-react";
import { formatDMY } from "@/lib/dateUtils";

type Job = {
  id: string; file_name: string | null; status: string;
  total_rows: number; products_created: number; products_updated: number;
  variants_created: number; variants_updated: number;
  errors_count: number; warnings_count: number;
  created_at: string; created_by: string | null;
  applied_at: string | null;
};

export default function CoreProductImports() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Job | null>(null);
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("core_product_import_jobs")
      .select("*").order("created_at", { ascending: false }).limit(100);
    setJobs((data as Job[]) ?? []); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function openDetail(j: Job) {
    setDetail(j);
    const { data } = await supabase.from("core_product_import_job_rows")
      .select("*").eq("job_id", j.id).order("row_number");
    setRows(data ?? []);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/core/productos")}>
          <ArrowLeft className="h-4 w-4 mr-1" />Volver
        </Button>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Historial de importaciones</h1>
          <p className="text-sm text-muted-foreground">Catálogo de Fabricación · auditoría completa.</p>
        </div>
      </div>
      <Card className="p-4">
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Filas</TableHead>
                <TableHead className="text-right">Creados</TableHead>
                <TableHead className="text-right">Actualizados</TableHead>
                <TableHead className="text-right">Errores</TableHead>
                <TableHead className="text-right">Warnings</TableHead>
                <TableHead className="text-right">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>
              ) : jobs.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sin importaciones aún.</TableCell></TableRow>
              ) : jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="text-xs">{formatDMY(j.created_at)}</TableCell>
                  <TableCell className="text-xs font-mono">{j.file_name ?? "—"}</TableCell>
                  <TableCell><Badge variant={j.status === "applied" ? "default" : j.status === "failed" ? "destructive" : "outline"}>{j.status}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{j.total_rows}</TableCell>
                  <TableCell className="text-right tabular-nums">{j.products_created + j.variants_created}</TableCell>
                  <TableCell className="text-right tabular-nums">{j.products_updated + j.variants_updated}</TableCell>
                  <TableCell className="text-right tabular-nums">{j.errors_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{j.warnings_count}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openDetail(j)}><Eye className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalle · {detail?.file_name}</DialogTitle>
          </DialogHeader>
          <div className="border rounded-md overflow-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>core_sku</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Mensajes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className={r.result === "error" ? "bg-destructive/5" : (r.warnings && r.warnings.length) ? "bg-amber-500/5" : ""}>
                    <TableCell className="text-xs font-mono">{r.row_number}</TableCell>
                    <TableCell className="text-xs">{r.action}</TableCell>
                    <TableCell className="text-xs font-mono">{r.core_sku || "—"}</TableCell>
                    <TableCell className="text-xs">{r.product_name || "—"}</TableCell>
                    <TableCell className="text-xs">{r.variant_label || "—"}</TableCell>
                    <TableCell><Badge variant={r.result === "error" ? "destructive" : "outline"} className="text-[10px]">{r.result}</Badge></TableCell>
                    <TableCell className="text-xs max-w-[320px]">
                      {(r.errors ?? []).map((e: string, i: number) => <div key={"e" + i} className="text-destructive">{e}</div>)}
                      {(r.warnings ?? []).map((w: string, i: number) => <div key={"w" + i} className="text-amber-700 dark:text-amber-400">{w}</div>)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
