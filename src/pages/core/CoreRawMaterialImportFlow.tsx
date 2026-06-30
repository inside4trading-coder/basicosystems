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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, Download, X, FileDown, FileSpreadsheet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { logCoreAudit } from "@/lib/coreAudit";

const CURRENCIES = ["USD", "Bs", "EUR"];

type Template = {
  id: string; name: string; data_type: string; direction: string; status: string; settings: any;
};
type Field = {
  id: string; template_id: string; display_name: string; column_name: string; internal_field: string;
  data_type: string; is_required: boolean; default_value: string | null; sort_order: number; is_active: boolean;
};
type AliasType = "raw_material_category" | "raw_material_unit" | "supplier";
type Resolution = {
  action: "create" | "map" | "skip";
  targetId?: string | null;     // for map (cat/unit) — id
  targetValue?: string | null;  // display value or supplier text
};
type PreviewRow = {
  rowNumber: number;
  raw: Record<string, string>;
  parsed: Record<string, any>;
  action: "create" | "update" | "skip" | "error" | "needs_resolution";
  errors: string[];
  warnings: string[];
  // raw detected values (kept for resolver matching)
  _category_raw?: string;
  _unit_raw?: string;
  _supplier_raw?: string;
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
function normalizeKey(s: string) {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
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
        action: { label: "Ir a Templates de Carga", onClick: () => navigate("/core/templates-carga") },
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
        action: { label: "Ir a Templates de Carga", onClick: () => navigate("/core/templates-carga") },
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

// Suggested aliases shown by default in the resolver
const SUGGESTED_UNIT_ALIASES: Record<string, string> = {
  un: "unidad", und: "unidad", u: "unidad", unidad: "unidad",
  mt: "metro", m: "metro", metro: "metro",
  kg: "kilogramo", kilo: "kilogramo", kilogramo: "kilogramo",
  gr: "gramo", g: "gramo", gramo: "gramo",
  lt: "litro", l: "litro", litro: "litro",
};
const SUGGESTED_CATEGORY_ALIASES: Record<string, string> = {
  telas: "tela", tela: "tela",
  insumos: "insumo", insumo: "insumo",
  merceria: "avio", mercería: "avio", avios: "avio", avio: "avio",
  sublimacion: "sublimacion", sublimación: "sublimacion",
  empaques: "empaque", empaque: "empaque",
  tintas: "tinta", tinta: "tinta",
};

type Ctx = {
  existingCodes: Map<string, string>;
  categories: { id: string; name: string }[];
  units: { id: string; name: string; abbreviation: string | null }[];
  suppliers: string[]; // distinct existing supplier names
  catByNorm: Map<string, { id: string; name: string }>;
  unitByNorm: Map<string, { id: string; name: string }>;
  supplierByNorm: Map<string, string>;
  aliases: Map<string, { alias_type: AliasType; source_value: string; action: "map" | "create" | "skip"; target_id: string | null; target_value: string | null }>;
};

async function loadCtx(): Promise<Ctx> {
  const [mats, cats, units, mats2, aliases] = await Promise.all([
    supabase.from("core_raw_materials").select("id,code"),
    supabase.from("core_raw_material_categories").select("id,name,status"),
    supabase.from("core_units_of_measure").select("id,name,abbreviation,status"),
    supabase.from("core_raw_materials").select("supplier").not("supplier", "is", null),
    supabase.from("core_import_value_aliases").select("*"),
  ]);
  const existingCodes = new Map<string, string>(((mats.data as any[]) ?? []).map((m) => [String(m.code), m.id]));
  const categories = ((cats.data as any[]) ?? []).map((c) => ({ id: c.id, name: c.name }));
  const unitsArr = ((units.data as any[]) ?? []).map((u) => ({ id: u.id, name: u.name, abbreviation: u.abbreviation }));
  const supSet = new Set<string>();
  ((mats2.data as any[]) ?? []).forEach((m) => { if (m.supplier && String(m.supplier).trim()) supSet.add(String(m.supplier).trim()); });
  const suppliers = Array.from(supSet).sort((a, b) => a.localeCompare(b));

  const catByNorm = new Map<string, { id: string; name: string }>();
  categories.forEach((c) => catByNorm.set(normalizeKey(c.name), c));
  const unitByNorm = new Map<string, { id: string; name: string }>();
  unitsArr.forEach((u) => {
    unitByNorm.set(normalizeKey(u.name), { id: u.id, name: u.name });
    if (u.abbreviation) unitByNorm.set(normalizeKey(u.abbreviation), { id: u.id, name: u.name });
  });
  const supplierByNorm = new Map<string, string>();
  suppliers.forEach((s) => supplierByNorm.set(normalizeKey(s), s));

  const aliasMap = new Map<string, any>();
  ((aliases.data as any[]) ?? []).forEach((a) => {
    aliasMap.set(`${a.alias_type}:${a.normalized_source_value}`, a);
  });

  return { existingCodes, categories, units: unitsArr, suppliers, catByNorm, unitByNorm, supplierByNorm, aliases: aliasMap };
}

// Build preview using resolutions map
function buildPreview(
  rawRows: Record<string, string>[],
  fields: Field[],
  template: Template,
  ctx: Ctx,
  resolutions: Map<string, Resolution>,
  pendingNewCats: Map<string, string>, // norm -> label
  pendingNewUnits: Map<string, string>,
): PreviewRow[] {
  const onExisting = (template.settings?.on_existing_code as string) ?? "update";
  const seenCodes = new Set<string>();
  const rows: PreviewRow[] = [];

  // Find the column that maps to "code" to pre-detect existing rows (partial update support)
  const codeField = fields.find((f) => f.internal_field === "code");
  const codeColumn = codeField?.column_name;

  rawRows.forEach((raw, idx) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const parsed: Record<string, any> = {};
    let categoryRaw = "";
    let unitRaw = "";
    let supplierRaw = "";
    let needsResolution = false;
    let shouldSkip = false;

    // Pre-detect: if code matches an existing material, this is a partial UPDATE —
    // empty cells should NOT trigger "Falta ..." errors; they just won't be updated.
    const rawCode = codeColumn ? String(raw[codeColumn] ?? "").trim() : "";
    const isPartialUpdate = !!rawCode && ctx.existingCodes.has(rawCode);

    fields.forEach((f) => {
      let val: any = raw[f.column_name];
      if (val === undefined || val === null || String(val).trim() === "") {
        if (f.default_value) val = f.default_value;
      }
      const s = val == null ? "" : String(val).trim();
      const label = f.display_name || f.column_name;
      const missingOk = isPartialUpdate && f.internal_field !== "code";


      switch (f.internal_field) {
        case "code":
          if (!s) errors.push(`Falta "${label}" (código)`);
          parsed.code = s; break;
        case "name":
          if (!s) { if (!missingOk) errors.push(`Falta "${label}" (nombre)`); break; }
          parsed.name = s; break;
        case "category_id": {
          if (!s) { if (!missingOk) errors.push(`Falta "${label}" (categoría)`); break; }

          categoryRaw = s;
          const norm = normalizeKey(s);
          // 1. direct match
          const direct = ctx.catByNorm.get(norm);
          if (direct) { parsed.category_id = direct.id; parsed._category_name = direct.name; break; }
          // 2. saved alias
          const alias = ctx.aliases.get(`raw_material_category:${norm}`);
          if (alias) {
            if (alias.action === "skip") { shouldSkip = true; warnings.push(`Categoría "${s}" → saltada por alias`); break; }
            if (alias.action === "map" && alias.target_id) {
              parsed.category_id = alias.target_id; parsed._category_name = alias.target_value ?? s;
              warnings.push(`Categoría "${s}" mapeada a "${alias.target_value ?? "—"}" por alias`); break;
            }
            if (alias.action === "create") {
              // treated as pending: resolution required at confirm; but auto-accept as create
              pendingNewCats.set(norm, s);
              warnings.push(`Categoría "${s}" se creará (alias)`); parsed._category_name = s; break;
            }
          }
          // 3. interactive resolution
          const res = resolutions.get(`raw_material_category:${norm}`);
          if (res) {
            if (res.action === "skip") { shouldSkip = true; warnings.push(`Categoría "${s}" → saltada`); break; }
            if (res.action === "map" && res.targetId) {
              parsed.category_id = res.targetId; parsed._category_name = res.targetValue ?? s;
              warnings.push(`Categoría "${s}" mapeada a "${res.targetValue ?? "—"}"`); break;
            }
            if (res.action === "create") {
              pendingNewCats.set(norm, s);
              warnings.push(`Categoría "${s}" se creará al confirmar`);
              parsed._category_name = s; break;
            }
          }
          // unresolved
          needsResolution = true;
          parsed._category_name = s;
          break;
        }
        case "unit_of_measure_id": {
          if (!s) { if (!missingOk) errors.push(`Falta "${label}" (unidad)`); break; }
          unitRaw = s;
          const norm = normalizeKey(s);
          const direct = ctx.unitByNorm.get(norm);
          if (direct) { parsed.unit_of_measure_id = direct.id; parsed._unit_name = direct.name; break; }
          const alias = ctx.aliases.get(`raw_material_unit:${norm}`);
          if (alias) {
            if (alias.action === "skip") { shouldSkip = true; warnings.push(`Unidad "${s}" → saltada por alias`); break; }
            if (alias.action === "map" && alias.target_id) {
              parsed.unit_of_measure_id = alias.target_id; parsed._unit_name = alias.target_value ?? s;
              warnings.push(`Unidad "${s}" mapeada a "${alias.target_value ?? "—"}" por alias`); break;
            }
            if (alias.action === "create") {
              pendingNewUnits.set(norm, s);
              warnings.push(`Unidad "${s}" se creará (alias)`); parsed._unit_name = s; break;
            }
          }
          const res = resolutions.get(`raw_material_unit:${norm}`);
          if (res) {
            if (res.action === "skip") { shouldSkip = true; warnings.push(`Unidad "${s}" → saltada`); break; }
            if (res.action === "map" && res.targetId) {
              parsed.unit_of_measure_id = res.targetId; parsed._unit_name = res.targetValue ?? s;
              warnings.push(`Unidad "${s}" mapeada a "${res.targetValue ?? "—"}"`); break;
            }
            if (res.action === "create") {
              pendingNewUnits.set(norm, s);
              warnings.push(`Unidad "${s}" se creará al confirmar`);
              parsed._unit_name = s; break;
            }
          }
          needsResolution = true;
          parsed._unit_name = s;
          break;
        }
        case "unit_cost": {
          if (!s) { if (!missingOk) errors.push(`Falta "${label}" (costo)`); break; }
          const n = parseFloat(s.replace(",", "."));
          if (Number.isNaN(n)) errors.push(`Costo "${s}" inválido`);
          else if (n < 0) errors.push(`Costo negativo`);
          else parsed.unit_cost = n; break;
        }
        case "currency": {
          const up = s.toUpperCase();
          if (!up) { if (!missingOk) errors.push(`Falta "${label}" (moneda)`); break; }

          if (!CURRENCIES.includes(up)) errors.push(`Moneda "${s}" inválida`);
          else parsed.currency = up; break;
        }
        case "supplier": {
          if (!s) { parsed.supplier = null; break; }
          supplierRaw = s;
          const norm = normalizeKey(s);
          const direct = ctx.supplierByNorm.get(norm);
          if (direct) { parsed.supplier = direct; break; }
          const alias = ctx.aliases.get(`supplier:${norm}`);
          if (alias) {
            if (alias.action === "skip") { shouldSkip = true; warnings.push(`Proveedor "${s}" → saltada por alias`); break; }
            if (alias.action === "map" && alias.target_value) {
              parsed.supplier = alias.target_value;
              warnings.push(`Proveedor "${s}" mapeado a "${alias.target_value}" por alias`); break;
            }
            if (alias.action === "create") {
              parsed.supplier = s;
              warnings.push(`Proveedor "${s}" se creará (alias)`); break;
            }
          }
          const res = resolutions.get(`supplier:${norm}`);
          if (res) {
            if (res.action === "skip") { shouldSkip = true; warnings.push(`Proveedor "${s}" → saltada`); break; }
            if (res.action === "map" && res.targetValue) {
              parsed.supplier = res.targetValue;
              warnings.push(`Proveedor "${s}" mapeado a "${res.targetValue}"`); break;
            }
            if (res.action === "create") {
              parsed.supplier = s;
              warnings.push(`Proveedor "${s}" se creará al confirmar`);
              break;
            }
          }
          needsResolution = true;
          parsed.supplier = s;
          break;
        }
        case "status": {
          if (!s) { parsed.status = "active"; break; }
          const ls = s.toLowerCase();
          const map: Record<string, string> = { activo: "active", active: "active", inactivo: "inactive", inactive: "inactive" };
          const v = map[ls];
          if (!v) errors.push(`Estado "${s}" inválido`); else parsed.status = v; break;
        }
        case "notes": parsed.notes = s || null; break;
        default: break;
      }
    });

    if (parsed.code) {
      if (seenCodes.has(parsed.code)) errors.push("Código duplicado en archivo");
      seenCodes.add(parsed.code);
    }

    let action: PreviewRow["action"];
    if (errors.length) action = "error";
    else if (shouldSkip) action = "skip";
    else if (needsResolution) action = "needs_resolution";
    else if (parsed.code && ctx.existingCodes.has(parsed.code)) {
      const onEx = (template.settings?.on_existing_code as string) ?? "update";
      if (onEx === "skip") action = "skip";
      else if (onEx === "error") { errors.push("Código ya existe"); action = "error"; }
      else action = "update";
    } else {
      action = "create";
    }

    rows.push({
      rowNumber: idx + 2, raw, parsed, action, errors, warnings,
      _category_raw: categoryRaw || undefined,
      _unit_raw: unitRaw || undefined,
      _supplier_raw: supplierRaw || undefined,
    });
  });

  return rows;
}

type MissingGroup = {
  type: AliasType;
  source: string;       // original first-seen label
  normalized: string;
  rowCount: number;
  sampleRows: number[];
};

function collectMissing(preview: PreviewRow[]): MissingGroup[] {
  const map = new Map<string, MissingGroup>();
  preview.forEach((r) => {
    if (r.action !== "needs_resolution") return;
    const items: { type: AliasType; raw?: string }[] = [
      { type: "raw_material_category", raw: r._category_raw && r.parsed.category_id == null ? r._category_raw : undefined },
      { type: "raw_material_unit", raw: r._unit_raw && r.parsed.unit_of_measure_id == null ? r._unit_raw : undefined },
      { type: "supplier", raw: r._supplier_raw && (r.parsed.supplier == null || r.parsed.supplier === r._supplier_raw) ? r._supplier_raw : undefined },
    ];
    items.forEach(({ type, raw }) => {
      if (!raw) return;
      const norm = normalizeKey(raw);
      const key = `${type}:${norm}`;
      const existing = map.get(key);
      if (existing) {
        existing.rowCount++;
        if (existing.sampleRows.length < 5) existing.sampleRows.push(r.rowNumber);
      } else {
        map.set(key, { type, source: raw, normalized: norm, rowCount: 1, sampleRows: [r.rowNumber] });
      }
    });
  });
  // Stable order: category, unit, supplier; then by source
  const order: Record<AliasType, number> = { raw_material_category: 0, raw_material_unit: 1, supplier: 2 };
  return Array.from(map.values()).sort((a, b) => order[a.type] - order[b.type] || a.source.localeCompare(b.source));
}

function RawMaterialImporterDialog({
  template, fields, onClose,
}: { template: Template; fields: Field[]; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, string>[] | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [resolutions, setResolutions] = useState<Map<string, Resolution>>(new Map());
  const [phase, setPhase] = useState<"upload" | "preview" | "resolve">("upload");
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [delimiter, setDelimiter] = useState<string>(";");
  const [usedDelimiter, setUsedDelimiter] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pending creations are recomputed every render from resolutions+preview, but we keep them in refs via memo
  const { missing, pendingNewCats, pendingNewUnits } = useMemo(() => {
    if (!preview) return { missing: [] as MissingGroup[], pendingNewCats: new Map<string, string>(), pendingNewUnits: new Map<string, string>() };
    const pCats = new Map<string, string>();
    const pUnits = new Map<string, string>();
    // re-derive from resolutions for display
    resolutions.forEach((res, key) => {
      const [type, norm] = key.split(":");
      if (res.action === "create") {
        if (type === "raw_material_category") {
          // need original label
          const sample = preview.find(p => p._category_raw && normalizeKey(p._category_raw) === norm);
          if (sample?._category_raw) pCats.set(norm, sample._category_raw);
        } else if (type === "raw_material_unit") {
          const sample = preview.find(p => p._unit_raw && normalizeKey(p._unit_raw) === norm);
          if (sample?._unit_raw) pUnits.set(norm, sample._unit_raw);
        }
      }
    });
    return { missing: collectMissing(preview), pendingNewCats: pCats, pendingNewUnits: pUnits };
  }, [preview, resolutions]);

  async function parseFile(f: File) {
    setParsing(true);
    setFile(f);
    const loadedCtx = await loadCtx();
    setCtx(loadedCtx);

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
    setUsedDelimiter(dataDelimiter);

    Papa.parse(normalizedText, {
      header: true, skipEmptyLines: true, delimiter: dataDelimiter,
      complete: (res) => {
        const data = res.data as Record<string, string>[];
        setRawRows(data);
        const initialResolutions = new Map<string, Resolution>();
        const pCats = new Map<string, string>();
        const pUnits = new Map<string, string>();
        const built = buildPreview(data, fields, template, loadedCtx, initialResolutions, pCats, pUnits);
        setResolutions(initialResolutions);
        setPreview(built);
        setPhase("preview");
        setParsing(false);
      },
      error: (err) => { toast.error("Error leyendo CSV: " + err.message); setParsing(false); },
    });
  }

  function recomputePreview(newResolutions: Map<string, Resolution>) {
    if (!rawRows || !ctx) return;
    const pCats = new Map<string, string>();
    const pUnits = new Map<string, string>();
    const built = buildPreview(rawRows, fields, template, ctx, newResolutions, pCats, pUnits);
    setPreview(built);
  }

  function setResolution(key: string, res: Resolution) {
    const next = new Map(resolutions);
    next.set(key, res);
    setResolutions(next);
    recomputePreview(next);
  }

  function applySuggestedDefaults() {
    if (!ctx || !preview) return;
    const next = new Map(resolutions);
    missing.forEach((m) => {
      const k = `${m.type}:${m.normalized}`;
      if (next.has(k)) return;
      if (m.type === "raw_material_unit") {
        const suggestedName = SUGGESTED_UNIT_ALIASES[m.normalized];
        if (suggestedName) {
          const target = ctx.unitByNorm.get(normalizeKey(suggestedName));
          if (target) next.set(k, { action: "map", targetId: target.id, targetValue: target.name });
        }
      } else if (m.type === "raw_material_category") {
        const suggestedName = SUGGESTED_CATEGORY_ALIASES[m.normalized];
        if (suggestedName) {
          const target = ctx.catByNorm.get(normalizeKey(suggestedName));
          if (target) next.set(k, { action: "map", targetId: target.id, targetValue: target.name });
        }
      }
    });
    setResolutions(next);
    recomputePreview(next);
    toast.success("Sugerencias aplicadas a los valores con equivalente claro");
  }

  async function confirmImport() {
    if (!preview || !file || !ctx) return;
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

    // Step 1: create pending new categories/units
    const createdCats = new Map<string, string>(); // norm -> id
    const createdUnits = new Map<string, string>();
    for (const [norm, label] of pendingNewCats) {
      const { data, error } = await supabase.from("core_raw_material_categories").insert({ name: label, status: "active" }).select().single();
      if (!error && data) {
        createdCats.set(norm, (data as any).id);
        await logCoreAudit({ table: "core_raw_material_categories", recordId: (data as any).id, action: "create_from_import_resolver", newValue: label });
      }
    }
    for (const [norm, label] of pendingNewUnits) {
      const { data, error } = await supabase.from("core_units_of_measure").insert({ name: label, abbreviation: label, status: "active" }).select().single();
      if (!error && data) {
        createdUnits.set(norm, (data as any).id);
        await logCoreAudit({ table: "core_units_of_measure", recordId: (data as any).id, action: "create_from_import_resolver", newValue: label });
      }
    }

    // Step 2: persist aliases for every resolution (so future imports auto-apply)
    for (const [key, res] of resolutions) {
      const [type, norm] = key.split(":") as [AliasType, string];
      const sourceVal = (() => {
        if (type === "raw_material_category") return preview.find(p => p._category_raw && normalizeKey(p._category_raw) === norm)?._category_raw ?? norm;
        if (type === "raw_material_unit") return preview.find(p => p._unit_raw && normalizeKey(p._unit_raw) === norm)?._unit_raw ?? norm;
        return preview.find(p => p._supplier_raw && normalizeKey(p._supplier_raw) === norm)?._supplier_raw ?? norm;
      })();
      let targetId: string | null = res.targetId ?? null;
      let targetValue: string | null = res.targetValue ?? null;
      if (res.action === "create") {
        if (type === "raw_material_category") { targetId = createdCats.get(norm) ?? null; targetValue = sourceVal; }
        else if (type === "raw_material_unit") { targetId = createdUnits.get(norm) ?? null; targetValue = sourceVal; }
        else { targetValue = sourceVal; }
      }
      await supabase.from("core_import_value_aliases").upsert({
        alias_type: type, source_value: sourceVal, normalized_source_value: norm,
        target_value: targetValue, target_id: targetId, action: res.action,
        created_by: user?.id ?? null, updated_by: user?.id ?? null,
      }, { onConflict: "alias_type,normalized_source_value" });
    }

    // Step 3: import rows
    let created = 0, updated = 0, errored = 0, skipped = 0;
    const rowsToInsert: any[] = [];

    for (const p of preview) {
      // Resolve any remaining missing ids from freshly created cats/units
      if (!p.parsed.category_id && p._category_raw) {
        const id = createdCats.get(normalizeKey(p._category_raw));
        if (id) p.parsed.category_id = id;
      }
      if (!p.parsed.unit_of_measure_id && p._unit_raw) {
        const id = createdUnits.get(normalizeKey(p._unit_raw));
        if (id) p.parsed.unit_of_measure_id = id;
      }

      // Recompute action after new creations
      let effective = p.action;
      if (effective === "needs_resolution") {
        if (p.parsed.category_id && (p.parsed.unit_of_measure_id || !fields.some(f => f.internal_field === "unit_of_measure_id"))) {
          effective = p.parsed.code && ctx.existingCodes.has(p.parsed.code) ? "update" : "create";
        }
      }

      let targetId: string | null = null;
      let validation = "ok";

      if (effective === "needs_resolution") {
        errored++; validation = "needs_resolution"; p.errors.push("Resolución incompleta");
      } else if (effective === "error" || p.errors.length > 0) {
        errored++; validation = "error";
      } else if (effective === "skip") {
        skipped++; validation = "skipped";
      } else {
        const fullPayload: any = {
          code: p.parsed.code, name: p.parsed.name,
          category_id: p.parsed.category_id, unit_of_measure_id: p.parsed.unit_of_measure_id,
          unit_cost: p.parsed.unit_cost, currency: p.parsed.currency,
          supplier: p.parsed.supplier ?? null, status: p.parsed.status ?? "active",
          notes: p.parsed.notes ?? null,
        };
        if (effective === "update") {
          const { data: existing } = await supabase.from("core_raw_materials").select("id,unit_cost").eq("code", fullPayload.code).maybeSingle();
          if (existing) {
            // Partial update: only include fields actually parsed from the CSV row
            // (undefined = column missing or empty → preserve existing value).
            const updatePayload: any = { code: fullPayload.code };
            if (p.parsed.name !== undefined) updatePayload.name = p.parsed.name;
            if (p.parsed.category_id !== undefined) updatePayload.category_id = p.parsed.category_id;
            if (p.parsed.unit_of_measure_id !== undefined) updatePayload.unit_of_measure_id = p.parsed.unit_of_measure_id;
            if (p.parsed.unit_cost !== undefined) updatePayload.unit_cost = p.parsed.unit_cost;
            if (p.parsed.currency !== undefined) updatePayload.currency = p.parsed.currency;
            if (p.parsed.supplier !== undefined && p.parsed.supplier !== null) updatePayload.supplier = p.parsed.supplier;
            if (p.parsed.status !== undefined) updatePayload.status = p.parsed.status;
            if (p.parsed.notes !== undefined && p.parsed.notes !== null) updatePayload.notes = p.parsed.notes;

            const { error } = await supabase.from("core_raw_materials").update(updatePayload).eq("id", (existing as any).id);
            if (error) { errored++; validation = "error"; p.errors.push(error.message); }
            else {
              updated++; targetId = (existing as any).id;
              if (updatePayload.unit_cost !== undefined && Number((existing as any).unit_cost) !== Number(updatePayload.unit_cost)) {
                await logCoreAudit({ table: "core_raw_materials", recordId: targetId, action: "import_update_cost", field: "unit_cost", oldValue: (existing as any).unit_cost, newValue: updatePayload.unit_cost });
              }
            }
          }
        } else {
          const { data, error } = await supabase.from("core_raw_materials").insert(fullPayload).select().single();
          if (error) { errored++; validation = "error"; p.errors.push(error.message); }
          else { created++; targetId = (data as any).id; }
        }

      }

      rowsToInsert.push({
        batch_id: batchId, row_number: p.rowNumber, raw_data: p.raw,
        parsed_data: { ...p.parsed, _warnings: p.warnings },
        validation_status: validation, errors: p.errors, action: effective, target_record_id: targetId,
      });
    }

    for (let i = 0; i < rowsToInsert.length; i += 200) {
      await supabase.from("core_import_batch_rows").insert(rowsToInsert.slice(i, i + 200));
    }

    const finalStatus = errored === 0 ? "completed" : (created + updated > 0 ? "completed_with_errors" : "failed");
    await supabase.from("core_import_batches").update({
      status: finalStatus, created_rows: created, updated_rows: updated, error_rows: errored,
      summary: {
        template_name: template.name, source: "raw_materials",
        skipped, new_categories: createdCats.size, new_units: createdUnits.size, aliases_saved: resolutions.size,
      },
    }).eq("id", batchId);

    await logCoreAudit({ table: "core_import_batches", recordId: batchId, action: "import_run", newValue: `creadas:${created} actualizadas:${updated} saltadas:${skipped} errores:${errored}` });

    toast.success(`Importación finalizada — Creadas: ${created}, Actualizadas: ${updated}, Saltadas: ${skipped}, Errores: ${errored}`);
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
      needs: preview.filter(p => p.action === "needs_resolution").length,
      warn: preview.filter(p => p.warnings.length > 0).length,
    };
  }, [preview]);

  // Allow confirming even when there are row-level errors: those rows are skipped automatically.
  // Only block when there are unresolved values (needs > 0) or nothing to import.
  const canConfirm = !!summary && summary.needs === 0 && (summary.create + summary.update) > 0;

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Materia Prima — {template.name}</DialogTitle>
        </DialogHeader>

        {phase === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sube un archivo CSV con las columnas del template. Si aparecen categorías, unidades o proveedores nuevos, el sistema te pedirá resolverlos antes de confirmar.
            </p>
            <div className="flex items-center gap-2">
              <Input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} disabled={parsing} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">Separador CSV:</span>
              <select className="text-xs border rounded px-2 py-1 bg-background" value={delimiter}
                onChange={(e) => setDelimiter(e.target.value)} disabled={parsing}>
                <option value=";">Punto y coma (;)</option>
                <option value=",">Coma (,)</option>
                <option value="auto">Auto-detectar</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              Columnas esperadas: <span className="font-mono">{fields.map(f => f.column_name).join(", ")}</span>
            </p>
          </div>
        )}

        {phase !== "upload" && summary && preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>A crear: {summary.create}</Badge>
              <Badge variant="secondary">A actualizar: {summary.update}</Badge>
              <Badge variant="outline">Saltar: {summary.skip}</Badge>
              {summary.needs > 0 && <Badge className="bg-amber-500 hover:bg-amber-500">Por resolver: {summary.needs}</Badge>}
              <Badge variant="destructive">Errores: {summary.error}</Badge>
              {summary.warn > 0 && <Badge variant="outline">Con avisos: {summary.warn}</Badge>}
              {usedDelimiter && <Badge variant="outline">Separador: {delimiterLabel(usedDelimiter)}</Badge>}
              <span className="text-xs text-muted-foreground ml-auto">{file?.name}</span>
            </div>

            {phase === "preview" && missing.length > 0 && (
              <Card className="p-3 border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/10">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Hay {missing.length} valor(es) no reconocidos en el archivo</div>
                    <div className="text-xs text-muted-foreground">
                      Categorías, unidades o proveedores nuevos. Resuélvelos para habilitar la importación.
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setPhase("resolve")}>Resolver ({missing.length})</Button>
                </div>
              </Card>
            )}

            {phase === "preview" && (
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
                      <TableHead>Proveedor</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead>Mensajes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 500).map((p) => (
                      <TableRow key={p.rowNumber} className={
                        p.errors.length ? "bg-destructive/5" :
                        p.action === "needs_resolution" ? "bg-amber-500/5" :
                        p.warnings.length ? "bg-blue-500/5" : ""
                      }>
                        <TableCell className="text-xs">{p.rowNumber}</TableCell>
                        <TableCell>
                          {p.action === "create" && <Badge>Crear</Badge>}
                          {p.action === "update" && <Badge variant="secondary">Actualizar</Badge>}
                          {p.action === "skip" && <Badge variant="outline">Saltar</Badge>}
                          {p.action === "error" && <Badge variant="destructive">Error</Badge>}
                          {p.action === "needs_resolution" && <Badge className="bg-amber-500 hover:bg-amber-500">Resolver</Badge>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{p.parsed.code ?? p.raw.codigo}</TableCell>
                        <TableCell className="text-xs">{p.parsed.name ?? p.raw.nombre}</TableCell>
                        <TableCell className="text-xs">{p.parsed._category_name ?? p.raw.categoria}</TableCell>
                        <TableCell className="text-xs">{p.parsed._unit_name ?? p.raw.unidad_medida}</TableCell>
                        <TableCell className="text-xs">{p.parsed.supplier ?? p.raw.proveedor ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{p.parsed.unit_cost ?? p.raw.costo_unitario}</TableCell>
                        <TableCell className="text-xs max-w-[280px]">
                          {p.errors.map((e, i) => <div key={"e" + i} className="text-destructive">{e}</div>)}
                          {p.warnings.map((w, i) => <div key={"w" + i} className="text-amber-700 dark:text-amber-400">{w}</div>)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.length > 500 && (
                  <div className="text-xs text-muted-foreground p-2 text-center">… mostrando 500 de {preview.length} filas.</div>
                )}
              </div>
            )}

            {phase === "resolve" && ctx && (
              <ResolverPanel
                missing={missing}
                ctx={ctx}
                resolutions={resolutions}
                onChange={(k, r) => setResolution(k, r)}
                onApplySuggestions={applySuggestedDefaults}
                onBack={() => setPhase("preview")}
              />
            )}
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={confirming}>
            <X className="h-4 w-4 mr-1" />Cancelar
          </Button>
          {phase === "preview" && preview && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setPreview(null); setRawRows(null); setFile(null); setUsedDelimiter(null); setResolutions(new Map()); setPhase("upload");
                if (fileRef.current) fileRef.current.value = "";
              }} disabled={confirming}>Volver</Button>
              {missing.length > 0 && <Button variant="secondary" onClick={() => setPhase("resolve")}>Resolver valores ({missing.length})</Button>}
              <Button onClick={confirmImport} disabled={confirming || !canConfirm}>
                {confirming
                  ? "Importando…"
                  : (summary?.needs ?? 0) > 0
                    ? "Resuelve los valores faltantes"
                    : (summary?.error ?? 0) > 0
                      ? `Confirmar (omitir ${summary?.error} con error)`
                      : "Confirmar importación"}
              </Button>
            </div>
          )}
          {phase === "resolve" && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPhase("preview")}>Volver al preview</Button>
              <Button onClick={() => { setPhase("preview"); toast.success("Resolución aplicada — preview recalculado"); }}>
                <CheckCircle2 className="h-4 w-4 mr-1" />Aplicar y volver
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResolverPanel({
  missing, ctx, resolutions, onChange, onApplySuggestions, onBack,
}: {
  missing: MissingGroup[]; ctx: Ctx; resolutions: Map<string, Resolution>;
  onChange: (key: string, r: Resolution) => void;
  onApplySuggestions: () => void;
  onBack: () => void;
}) {
  const grouped = useMemo(() => {
    const out: Record<AliasType, MissingGroup[]> = {
      raw_material_category: [], raw_material_unit: [], supplier: [],
    };
    missing.forEach((m) => out[m.type].push(m));
    return out;
  }, [missing]);

  if (missing.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        Todos los valores están resueltos.{" "}
        <Button variant="link" onClick={onBack}>Volver al preview</Button>
      </div>
    );
  }

  const typeLabel: Record<AliasType, string> = {
    raw_material_category: "Categorías no encontradas",
    raw_material_unit: "Unidades no encontradas",
    supplier: "Proveedores no encontrados",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Resolver valores no encontrados</div>
          <div className="text-xs text-muted-foreground">
            Elige una acción para cada valor. La decisión se aplica a todas las filas con el mismo valor y se guarda como alias para futuras importaciones.
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onApplySuggestions}>Aplicar sugerencias</Button>
      </div>

      {(Object.keys(grouped) as AliasType[]).map((type) => {
        const items = grouped[type];
        if (items.length === 0) return null;
        return (
          <Card key={type} className="p-3">
            <div className="text-sm font-semibold mb-2">{typeLabel[type]} <span className="text-muted-foreground font-normal">({items.length})</span></div>
            <div className="space-y-2">
              {items.map((m) => {
                const key = `${m.type}:${m.normalized}`;
                const current = resolutions.get(key);
                const targetOptions =
                  type === "raw_material_category" ? ctx.categories.map(c => ({ id: c.id, label: c.name })) :
                  type === "raw_material_unit"     ? ctx.units.map(u => ({ id: u.id, label: u.abbreviation ? `${u.name} (${u.abbreviation})` : u.name })) :
                  ctx.suppliers.map(s => ({ id: s, label: s }));

                return (
                  <div key={key} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center border-t pt-2 first:border-t-0 first:pt-0">
                    <div className="md:col-span-3">
                      <div className="text-sm font-mono">{m.source}</div>
                      <div className="text-[10px] text-muted-foreground">{m.rowCount} fila(s) · ej. {m.sampleRows.join(", ")}</div>
                    </div>
                    <div className="md:col-span-3">
                      <Select
                        value={current?.action ?? ""}
                        onValueChange={(v) => {
                          if (v === "create") onChange(key, { action: "create" });
                          else if (v === "skip") onChange(key, { action: "skip" });
                          else onChange(key, { action: "map", targetId: null, targetValue: null });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Acción" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="map">Mapear a existente</SelectItem>
                          <SelectItem value="create">{type === "supplier" ? `Aceptar como nuevo` : `Crear "${m.source}"`}</SelectItem>
                          <SelectItem value="skip">Saltar filas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-5">
                      {current?.action === "map" ? (
                        <Select
                          value={current.targetId ?? ""}
                          onValueChange={(id) => {
                            const opt = targetOptions.find(o => o.id === id);
                            if (type === "supplier") onChange(key, { action: "map", targetValue: id });
                            else onChange(key, { action: "map", targetId: id, targetValue: opt?.label });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Elegir valor existente…" /></SelectTrigger>
                          <SelectContent className="max-h-72">
                            {targetOptions.length === 0 && <div className="text-xs px-2 py-1 text-muted-foreground">Sin opciones existentes</div>}
                            {targetOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : current?.action === "create" ? (
                        <span className="text-xs text-muted-foreground">Se {type === "supplier" ? "registrará" : "creará"} al confirmar.</span>
                      ) : current?.action === "skip" ? (
                        <span className="text-xs text-muted-foreground">{m.rowCount} fila(s) serán saltadas.</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Elige una acción</span>
                      )}
                    </div>
                    <div className="md:col-span-1 text-right">
                      {current && <CheckCircle2 className="h-4 w-4 text-green-600 inline" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
