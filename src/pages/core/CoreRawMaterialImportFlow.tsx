import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, Download, X, FileDown, FileSpreadsheet } from "lucide-react";
import { logCoreAudit } from "@/lib/coreAudit";

const CURRENCIES = ["USD", "Bs", "EUR"];

type Template = {
  id: string; name: string; data_type: string; direction: string; status: string; settings: any;
};
type Field = {
  id: string; template_id: string; display_name: string; column_name: string; internal_field: string;
  data_type: string; is_required: boolean; default_value: string | null; sort_order: number; is_active: boolean;
};
type PreviewRow = {
  rowNumber: number;
  raw: Record<string, string>;
  parsed: Record<string, any>;
  action: "create" | "update" | "skip" | "error";
  errors: string[];
};

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function fetchActiveTemplate(allowedDirections: string[]): Promise<{ template: Template | null; fields: Field[] }> {
  const { data: tpls } = await supabase
    .from("core_import_templates")
    .select("*")
    .eq("data_type", "raw_material")
    .eq("status", "active")
    .in("direction", allowedDirections)
    .order("updated_at", { ascending: false })
    .limit(1);
  const template = (tpls?.[0] as Template) ?? null;
  if (!template) return { template: null, fields: [] };
  const { data: fields } = await supabase
    .from("core_import_template_fields")
    .select("*")
    .eq("template_id", template.id)
    .eq("is_active", true)
    .order("sort_order");
  return { template, fields: (fields as Field[]) ?? [] };
}

// ============ Botón Importar ============
export function RawMaterialImportButton({ onImported }: { onImported?: () => void }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);
  const [fields, setFields] = useState<Field[]>([]);

  async function handleClick() {
    setLoading(true);
    const { template: t, fields: f } = await fetchActiveTemplate(["import", "both"]);
    setLoading(false);
    if (!t) {
      toast.error("No hay template activo de Materia Prima.", {
        action: { label: "Ir a Templates", onClick: () => navigate("/core/templates-carga") },
      });
      return;
    }
    if (!f.length) {
      toast.error("El template no tiene campos definidos.");
      return;
    }
    setTemplate(t); setFields(f); setOpen(true);
    await logCoreAudit({ table: "core_import_templates", recordId: t.id, action: "open_import_from_raw_materials" });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
        <Upload className="h-4 w-4 mr-1" />{loading ? "Cargando…" : "Importar"}
      </Button>
      {open && template && (
        <RawMaterialImporterDialog
          template={template}
          fields={fields}
          onClose={() => { setOpen(false); onImported?.(); }}
        />
      )}
    </>
  );
}

// ============ Botón Exportar ============
export function RawMaterialExportButton() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function ensureTemplate() {
    setLoading(true);
    const { template, fields } = await fetchActiveTemplate(["export", "both"]);
    setLoading(false);
    if (!template) {
      toast.error("No hay template de exportación activo.", {
        action: { label: "Ir a Templates", onClick: () => navigate("/core/templates-carga") },
      });
      return null;
    }
    if (!fields.length) {
      toast.error("El template no tiene campos definidos.");
      return null;
    }
    return { template, fields };
  }

  async function downloadBase() {
    const r = await ensureTemplate(); if (!r) return;
    const headers = r.fields.map((f) => f.column_name);
    downloadCsv(headers.join(";") + "\n", `${slug(r.template.name)}-formato.csv`);
    await logCoreAudit({ table: "core_import_templates", recordId: r.template.id, action: "download_base" });
    toast.success("Formato base descargado (separador: ;)");
  }

  async function exportData() {
    const r = await ensureTemplate(); if (!r) return;
    const [mats, cats, units] = await Promise.all([
      supabase.from("core_raw_materials").select("*").order("code"),
      supabase.from("core_raw_material_categories").select("id,name"),
      supabase.from("core_units_of_measure").select("id,name"),
    ]);
    const catMap = Object.fromEntries((cats.data ?? []).map((c: any) => [c.id, c.name]));
    const unitMap = Object.fromEntries((units.data ?? []).map((u: any) => [u.id, u.name]));
    const rows = ((mats.data as any[]) ?? []).map((m) =>
      r.fields.map((f) => {
        switch (f.internal_field) {
          case "code": return m.code;
          case "name": return m.name;
          case "category_id": return catMap[m.category_id] ?? "";
          case "unit_of_measure_id": return unitMap[m.unit_of_measure_id] ?? "";
          case "unit_cost": return m.unit_cost;
          case "currency": return m.currency;
          case "supplier": return m.supplier ?? "";
          case "status": return m.status;
          case "notes": return m.notes ?? "";
          default: return "";
        }
      })
    );
    const csv = Papa.unparse({ fields: r.fields.map((f) => f.column_name), data: rows }, { delimiter: ";" });
    downloadCsv(csv, `${slug(r.template.name)}-export-${new Date().toISOString().slice(0, 10)}.csv`);
    await logCoreAudit({ table: "core_import_templates", recordId: r.template.id, action: "export_data", newValue: String(rows.length) });
    toast.success(`${rows.length} filas exportadas`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          <Download className="h-4 w-4 mr-1" />Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={downloadBase}>
          <FileDown className="h-4 w-4 mr-2" />Descargar formato base (CSV vacío)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportData}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />Exportar datos actuales
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============ Importer dialog (Materia Prima) ============
const DELIMITERS = [";", ",", "\t"] as const;

function normalizeHeaderName(value: string) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
}

function delimiterLabel(value: string) {
  return value === "\t" ? "TAB" : value;
}

function parseCsvLine(line: string, delimiter: string) {
  const parsed = Papa.parse<string[]>(line, { delimiter, skipEmptyLines: false });
  return (parsed.data?.[0] ?? []).map((v) => String(v ?? ""));
}

function bestHeaderDelimiter(headerLine: string, expectedCols: string[], fallback: string) {
  let best = fallback;
  let bestScore = -1;
  for (const d of DELIMITERS) {
    const headers = parseCsvLine(headerLine, d).map(normalizeHeaderName);
    const matches = expectedCols.filter((c) => headers.includes(c)).length;
    const score = matches * 100 + headers.length;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

function bestDataDelimiter(lines: string[], expectedCount: number, preferred: string) {
  const dataLines = lines.slice(1).filter((l) => l.trim().length > 0).slice(0, 10);
  const sampleLines = dataLines.length ? dataLines : lines.slice(0, 10);
  let best = preferred;
  let bestScore = -1;

  for (const d of DELIMITERS) {
    const counts = sampleLines.map((l) => parseCsvLine(l, d).length);
    const exact = counts.filter((c) => c === expectedCount).length;
    const multi = counts.filter((c) => c > 1).length;
    const mode = Math.max(...counts.map((c) => counts.filter((x) => x === c).length));
    const score = exact * 100 + multi * 10 + mode;
    if (score > bestScore) { bestScore = score; best = d; }
  }

  return best;
}

function RawMaterialImporterDialog({
  template, fields, onClose,
}: { template: Template; fields: Field[]; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [delimiter, setDelimiter] = useState<string>(";");
  const fileRef = useRef<HTMLInputElement>(null);

  async function parseFile(f: File) {
    setParsing(true);
    setFile(f);
    const [mats, cats, units] = await Promise.all([
      supabase.from("core_raw_materials").select("id,code"),
      supabase.from("core_raw_material_categories").select("id,name,status"),
      supabase.from("core_units_of_measure").select("id,name,abbreviation,status"),
    ]);
    const existingCodes = new Map<string, string>(((mats.data as any[]) ?? []).map((m) => [String(m.code), m.id]));
    const catByName = new Map<string, string>(((cats.data as any[]) ?? []).map((c) => [c.name.toLowerCase(), c.id]));
    const unitByName = new Map<string, string>();
    ((units.data as any[]) ?? []).forEach((u) => {
      unitByName.set(u.name.toLowerCase(), u.id);
      if (u.abbreviation) unitByName.set(u.abbreviation.toLowerCase(), u.id);
    });

    const text = await f.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const expectedCols = fields.map((x) => normalizeHeaderName(x.column_name));
    const fallbackDelimiter = delimiter === "auto" ? ";" : delimiter;
    const headerDelimiter = bestHeaderDelimiter(lines[0] ?? "", expectedCols, fallbackDelimiter);
    const dataDelimiter = bestDataDelimiter(lines, expectedCols.length, headerDelimiter);
    const headerValues = parseCsvLine(lines[0] ?? "", headerDelimiter).map(normalizeHeaderName);
    const normalizedText = [headerValues.join(dataDelimiter), ...lines.slice(1)].join("\n");

    if (headerDelimiter !== dataDelimiter || delimiter !== dataDelimiter) {
      toast.info(`Separador detectado: "${delimiterLabel(dataDelimiter)}".`);
    }

    Papa.parse(normalizedText, {
      header: true, skipEmptyLines: true, delimiter: delim,
      complete: (res) => {
        const onExisting = (template.settings?.on_existing_code as string) ?? "update";
        const seenCodes = new Set<string>();
        const rows: PreviewRow[] = [];
        const data = res.data as Record<string, string>[];

        data.forEach((raw, idx) => {
          const errors: string[] = [];
          const parsed: Record<string, any> = {};

          fields.forEach((f) => {
            let val: any = raw[f.column_name];
            if (val === undefined || val === null || String(val).trim() === "") {
              if (f.default_value) val = f.default_value;
            }
            const s = val == null ? "" : String(val).trim();

            switch (f.internal_field) {
              case "code":
                if (!s) errors.push("Código vacío");
                parsed.code = s; break;
              case "name":
                if (!s && f.is_required) errors.push("Nombre vacío");
                parsed.name = s; break;
              case "category_id": {
                if (!s) { if (f.is_required) errors.push("Categoría vacía"); break; }
                const id = catByName.get(s.toLowerCase());
                if (id) parsed.category_id = id;
                else errors.push(`Categoría no encontrada: ${s}`);
                parsed._category_name = s; break;
              }
              case "unit_of_measure_id": {
                if (!s) { if (f.is_required) errors.push("Unidad vacía"); break; }
                const id = unitByName.get(s.toLowerCase());
                if (id) parsed.unit_of_measure_id = id;
                else errors.push(`Unidad no encontrada: ${s}`);
                parsed._unit_name = s; break;
              }
              case "unit_cost": {
                if (!s) { if (f.is_required) errors.push("Costo vacío"); break; }
                const n = parseFloat(s.replace(",", "."));
                if (Number.isNaN(n)) errors.push("Costo inválido");
                else if (n < 0) errors.push("Costo negativo");
                else parsed.unit_cost = n; break;
              }
              case "currency": {
                const up = s.toUpperCase();
                if (!up) { if (f.is_required) errors.push("Moneda vacía"); break; }
                if (!CURRENCIES.includes(up)) errors.push(`Moneda inválida: ${s}`);
                else parsed.currency = up; break;
              }
              case "supplier": parsed.supplier = s || null; break;
              case "status": {
                const ls = s.toLowerCase();
                const map: Record<string, string> = { activo: "active", active: "active", inactivo: "inactive", inactive: "inactive" };
                const v = map[ls];
                if (!v) { if (f.is_required) errors.push(`Estado inválido: ${s}`); }
                else parsed.status = v; break;
              }
              case "notes": parsed.notes = s || null; break;
              default: break;
            }
          });

          if (parsed.code) {
            if (seenCodes.has(parsed.code)) errors.push("Código duplicado en archivo");
            seenCodes.add(parsed.code);
          }

          let action: PreviewRow["action"] = "create";
          if (errors.length) action = "error";
          else if (parsed.code && existingCodes.has(parsed.code)) {
            if (onExisting === "skip") action = "skip";
            else if (onExisting === "error") { errors.push("Código ya existe"); action = "error"; }
            else action = "update";
          }
          rows.push({ rowNumber: idx + 2, raw, parsed, action, errors });
        });

        setPreview(rows);
        setParsing(false);
      },
      error: (err) => { toast.error("Error leyendo CSV: " + err.message); setParsing(false); },
    });
  }

  async function confirmImport() {
    if (!preview || !file) return;
    setConfirming(true);
    const { data: { user } } = await supabase.auth.getUser();
    const fileKey = `${Date.now()}-${file.name}`;
    await supabase.storage.from("core-import-files").upload(fileKey, file).catch(() => null);

    const { data: batch, error: batchErr } = await supabase.from("core_import_batches").insert({
      template_id: template.id, data_type: template.data_type, file_name: file.name, file_url: fileKey,
      status: "preview", total_rows: preview.length, created_by: user?.id ?? null,
    }).select().single();
    if (batchErr || !batch) { setConfirming(false); return toast.error(batchErr?.message ?? "Error creando batch"); }
    const batchId = (batch as any).id;

    const autoCats = !!template.settings?.auto_create_categories;
    const autoUnits = !!template.settings?.auto_create_units;
    const newCats = new Map<string, string>();
    const newUnits = new Map<string, string>();

    if (autoCats) {
      const missing = new Set<string>();
      preview.forEach((p) => { if (p.parsed._category_name && !p.parsed.category_id) missing.add(p.parsed._category_name); });
      for (const name of missing) {
        const { data } = await supabase.from("core_raw_material_categories").insert({ name, status: "active" }).select().single();
        if (data) {
          newCats.set(name.toLowerCase(), (data as any).id);
          await logCoreAudit({ table: "core_raw_material_categories", recordId: (data as any).id, action: "auto_create_from_import", newValue: name });
        }
      }
    }
    if (autoUnits) {
      const missing = new Set<string>();
      preview.forEach((p) => { if (p.parsed._unit_name && !p.parsed.unit_of_measure_id) missing.add(p.parsed._unit_name); });
      for (const name of missing) {
        const { data } = await supabase.from("core_units_of_measure").insert({ name, abbreviation: name, status: "active" }).select().single();
        if (data) {
          newUnits.set(name.toLowerCase(), (data as any).id);
          await logCoreAudit({ table: "core_units_of_measure", recordId: (data as any).id, action: "auto_create_from_import", newValue: name });
        }
      }
    }

    let created = 0, updated = 0, errored = 0;
    const rowsToInsert: any[] = [];

    for (const p of preview) {
      if (!p.parsed.category_id && p.parsed._category_name) {
        const id = newCats.get(String(p.parsed._category_name).toLowerCase());
        if (id) { p.parsed.category_id = id; p.errors = p.errors.filter(e => !e.startsWith("Categoría no encontrada")); }
      }
      if (!p.parsed.unit_of_measure_id && p.parsed._unit_name) {
        const id = newUnits.get(String(p.parsed._unit_name).toLowerCase());
        if (id) { p.parsed.unit_of_measure_id = id; p.errors = p.errors.filter(e => !e.startsWith("Unidad no encontrada")); }
      }
      if (p.errors.length === 0 && p.action === "error") p.action = "create";

      let targetId: string | null = null;
      let validation = "ok";
      if (p.action === "error" || p.errors.length > 0) { errored++; validation = "error"; }
      else if (p.action === "skip") { validation = "skipped"; }
      else {
        const payload: any = {
          code: p.parsed.code, name: p.parsed.name,
          category_id: p.parsed.category_id, unit_of_measure_id: p.parsed.unit_of_measure_id,
          unit_cost: p.parsed.unit_cost, currency: p.parsed.currency,
          supplier: p.parsed.supplier ?? null, status: p.parsed.status ?? "active",
          notes: p.parsed.notes ?? null,
        };
        if (p.action === "update") {
          const { data: existing } = await supabase.from("core_raw_materials").select("id,unit_cost").eq("code", payload.code).maybeSingle();
          if (existing) {
            const { error } = await supabase.from("core_raw_materials").update(payload).eq("id", (existing as any).id);
            if (error) { errored++; validation = "error"; p.errors.push(error.message); }
            else {
              updated++; targetId = (existing as any).id;
              if (Number((existing as any).unit_cost) !== Number(payload.unit_cost)) {
                await logCoreAudit({ table: "core_raw_materials", recordId: targetId, action: "import_update_cost", field: "unit_cost", oldValue: (existing as any).unit_cost, newValue: payload.unit_cost });
              }
            }
          }
        } else {
          const { data, error } = await supabase.from("core_raw_materials").insert(payload).select().single();
          if (error) { errored++; validation = "error"; p.errors.push(error.message); }
          else { created++; targetId = (data as any).id; }
        }
      }

      rowsToInsert.push({
        batch_id: batchId, row_number: p.rowNumber, raw_data: p.raw, parsed_data: p.parsed,
        validation_status: validation, errors: p.errors, action: p.action, target_record_id: targetId,
      });
    }

    for (let i = 0; i < rowsToInsert.length; i += 200) {
      await supabase.from("core_import_batch_rows").insert(rowsToInsert.slice(i, i + 200));
    }

    const finalStatus = errored === 0 ? "completed" : (created + updated > 0 ? "completed_with_errors" : "failed");
    await supabase.from("core_import_batches").update({
      status: finalStatus, created_rows: created, updated_rows: updated, error_rows: errored,
      summary: { template_name: template.name, source: "raw_materials" },
    }).eq("id", batchId);

    await logCoreAudit({ table: "core_import_batches", recordId: batchId, action: "import_run", newValue: `creadas:${created} actualizadas:${updated} errores:${errored}` });

    toast.success(`Importación finalizada — Creadas: ${created}, Actualizadas: ${updated}, Errores: ${errored}`);
    setConfirming(false);
    onClose();
  }

  const summary = useMemo(() => {
    if (!preview) return null;
    return {
      create: preview.filter(p => p.action === "create").length,
      update: preview.filter(p => p.action === "update").length,
      skip: preview.filter(p => p.action === "skip").length,
      error: preview.filter(p => p.action === "error").length,
    };
  }, [preview]);

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Materia Prima — {template.name}</DialogTitle>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sube un archivo CSV con las columnas definidas por el template. El sistema validará cada fila antes de guardar.
            </p>
            <div className="flex items-center gap-2">
              <Input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} disabled={parsing} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">Separador CSV:</span>
              <select
                className="text-xs border rounded px-2 py-1 bg-background"
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value)}
                disabled={parsing}
              >
                <option value=";">Punto y coma (;)</option>
                <option value=",">Coma (,)</option>
                <option value="auto">Auto-detectar</option>
              </select>
              <span className="text-[10px] text-muted-foreground">Elija el separador usado en su archivo</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Columnas esperadas: <span className="font-mono">{fields.map(f => f.column_name).join(", ")}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Política para códigos existentes: <strong>{(template.settings?.on_existing_code ?? "update") === "update" ? "actualizar" : (template.settings?.on_existing_code === "skip" ? "saltar" : "marcar error")}</strong>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">A crear: {summary?.create}</Badge>
              <Badge variant="secondary">A actualizar: {summary?.update}</Badge>
              <Badge variant="outline">Saltar: {summary?.skip}</Badge>
              <Badge variant="destructive">Errores: {summary?.error}</Badge>
              <span className="text-xs text-muted-foreground ml-auto">{file?.name}</span>
            </div>
            <div className="rounded-lg border overflow-x-auto max-h-[55vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Fila</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Errores</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((p) => (
                    <TableRow key={p.rowNumber} className={p.errors.length ? "bg-destructive/5" : ""}>
                      <TableCell className="text-xs">{p.rowNumber}</TableCell>
                      <TableCell>
                        {p.action === "create" && <Badge>Crear</Badge>}
                        {p.action === "update" && <Badge variant="secondary">Actualizar</Badge>}
                        {p.action === "skip" && <Badge variant="outline">Saltar</Badge>}
                        {p.action === "error" && <Badge variant="destructive">Error</Badge>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.parsed.code ?? p.raw.codigo}</TableCell>
                      <TableCell>{p.parsed.name ?? p.raw.nombre}</TableCell>
                      <TableCell className="text-xs">{p.parsed._category_name ?? p.raw.categoria}</TableCell>
                      <TableCell className="text-xs">{p.parsed._unit_name ?? p.raw.unidad_medida}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.parsed.unit_cost ?? p.raw.costo_unitario}</TableCell>
                      <TableCell>{p.parsed.currency ?? p.raw.moneda}</TableCell>
                      <TableCell className="text-xs text-destructive">{p.errors.join("; ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={confirming}>
            <X className="h-4 w-4 mr-1" />Cancelar
          </Button>
          {preview && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setPreview(null); setFile(null); if (fileRef.current) fileRef.current.value = ""; }} disabled={confirming}>Volver</Button>
              <Button onClick={confirmImport} disabled={confirming || (summary?.create === 0 && summary?.update === 0)}>
                {confirming ? "Importando…" : "Confirmar importación"}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
