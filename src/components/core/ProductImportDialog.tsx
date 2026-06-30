import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, FileDown, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import {
  parseFile, normalizeRow, buildPreview, loadExistingContext, applyImport,
  downloadErrorsCsv, type PreviewRow, type PreviewSummary,
} from "@/lib/coreProductImport";

type Step = "upload" | "previewing" | "preview" | "applying" | "done";

export function ProductImportDialog({ open, onOpenChange, onApplied }: {
  open: boolean; onOpenChange: (v: boolean) => void; onApplied?: () => void;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<PreviewSummary | null>(null);
  const [result, setResult] = useState<any>(null);

  function reset() {
    setStep("upload"); setFileName(""); setPreview([]); setSummary(null); setResult(null);
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setStep("previewing");
    try {
      const raws = await parseFile(file);
      if (raws.length === 0) { toast.error("Archivo vacío"); setStep("upload"); return; }
      const rows = raws.map((r, i) => normalizeRow(r, i + 2)); // +2 = header row offset
      const ctx = await loadExistingContext();
      const { preview, summary } = buildPreview(rows, ctx);
      setPreview(preview); setSummary(summary); setStep("preview");
    } catch (e: any) {
      toast.error(e?.message ?? "Error leyendo archivo"); setStep("upload");
    }
  }

  async function handleApply() {
    if (!summary) return;
    setStep("applying");
    try {
      const res = await applyImport(fileName, preview, summary);
      setResult(res); setStep("done");
      toast.success(`Importación aplicada: ${res.productsCreated + res.variantsCreated} creados · ${res.productsUpdated + res.variantsUpdated} actualizados`);
      onApplied?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Error aplicando"); setStep("preview");
    }
  }

  const canConfirm = summary && summary.errors === 0 && (summary.productsCreate + summary.productsUpdate + summary.variantsCreate + summary.variantsUpdate + summary.productsArchive) > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Catálogo de Fabricación</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sube un archivo CSV o XLSX con el formato base. Se mostrará una previsualización antes de aplicar los cambios.
              No se escribirá nada en WooCommerce.
            </p>
            <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 cursor-pointer hover:bg-muted/40">
              <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
              <span className="font-medium">Seleccionar archivo</span>
              <span className="text-xs text-muted-foreground mt-1">CSV o XLSX</span>
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]; if (f) handleFile(f);
              }} />
            </label>
          </div>
        )}

        {step === "previewing" && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Procesando archivo…
          </div>
        )}

        {step === "preview" && summary && (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs shrink-0">
              {[
                ["Filas", summary.total],
                ["Productos", summary.productsDetected],
                ["Variantes", summary.variantsDetected],
                ["Crear prod.", summary.productsCreate],
                ["Actualizar prod.", summary.productsUpdate],
                ["Crear var.", summary.variantsCreate],
                ["Actualizar var.", summary.variantsUpdate],
                ["Archivar", summary.productsArchive],
                ["Errores", summary.errors],
                ["Warnings", summary.warnings],
              ].map(([label, n]) => (
                <Card key={label as string} className="p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                  <div className={`text-xl font-bold ${label === "Errores" && Number(n) > 0 ? "text-destructive" : ""}`}>{n}</div>
                </Card>
              ))}
            </div>
            {summary.errors > 0 && (
              <div className="text-xs text-destructive flex items-center gap-2 shrink-0">
                <AlertTriangle className="h-4 w-4" /> Hay errores. Corrige el archivo antes de confirmar.
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => downloadErrorsCsv(preview)}>
                  <FileDown className="h-3 w-3 mr-1" /> Descargar CSV de errores/warnings
                </Button>
              </div>
            )}
            <div className="border rounded-md overflow-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>core_sku</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Variante</TableHead>
                    <TableHead>Woo prod</TableHead>
                    <TableHead>Woo var</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Mensajes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(0, 500).map((r) => (
                    <TableRow key={r.rowNumber} className={r.result === "error" ? "bg-destructive/5" : r.warnings.length ? "bg-amber-500/5" : ""}>
                      <TableCell className="font-mono text-xs">{r.rowNumber}</TableCell>
                      <TableCell className="text-xs">{r.action}</TableCell>
                      <TableCell className="font-mono text-xs">{r.core_sku || "—"}</TableCell>
                      <TableCell className="text-xs">{r.product_name || "—"}</TableCell>
                      <TableCell className="text-xs">{r.variant_label || "—"}</TableCell>
                      <TableCell className="text-xs">{r.woo_product_id ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.woo_variation_id ?? "—"}</TableCell>
                      <TableCell><Badge variant={r.result === "error" ? "destructive" : "outline"} className="text-[10px]">{r.result}</Badge></TableCell>
                      <TableCell className="text-xs max-w-[280px]">
                        {r.errors.map((e, i) => <div key={"e" + i} className="text-destructive">{e}</div>)}
                        {r.warnings.map((w, i) => <div key={"w" + i} className="text-amber-700 dark:text-amber-400">{w}</div>)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.length > 500 && (
                <div className="text-xs text-muted-foreground p-2 text-center">…mostrando 500 de {preview.length} filas. El detalle completo se guardará en el historial.</div>
              )}
            </div>
          </div>
        )}

        {step === "applying" && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Aplicando cambios…
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-green-600" />
            <div className="font-semibold">Importación completada</div>
            <div className="text-sm text-muted-foreground">
              {result.productsCreated} productos creados · {result.productsUpdated} actualizados ·{" "}
              {result.variantsCreated} variantes creadas · {result.variantsUpdated} actualizadas ·{" "}
              {result.archived} archivados · {result.errors} errores
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0">
          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={() => { reset(); }}>Cancelar</Button>
              <Button disabled={!canConfirm} onClick={handleApply}>Confirmar importación</Button>
            </>
          )}
          {step === "done" && <Button onClick={() => { reset(); onOpenChange(false); }}>Cerrar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
