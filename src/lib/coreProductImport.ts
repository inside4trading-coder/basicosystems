import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export const IMPORT_COLUMNS = [
  "action",
  "core_sku",
  "product_name",
  "product_type",
  "status",
  "strategic_priority",
  "restock_enabled",
  "unit_cost_usd",
  "cost_structure_code",
  "cost_structure_name",
  "woo_product_id",
  "woo_product_name",
  "variant_label",
  "variant_sku",
  "woo_variation_id",
  "barcode",
  "qr_code",
  "notes",
] as const;

export const EXPORT_COLUMNS = [...IMPORT_COLUMNS, "updated_at"] as const;

export type ImportAction = "upsert" | "create" | "update" | "archive";

const VALID_ACTIONS: ImportAction[] = ["upsert", "create", "update", "archive"];
const VALID_STATUS = ["active", "inactive", "archived", "draft", "discontinued", "stock_only"];
// Per spec: core/esencial/regular/experimental/otro → map to internal product_priority values
const PRIORITY_MAP: Record<string, string> = {
  core: "core_essential",
  esencial: "core_essential",
  core_esencial: "core_essential",
  core_essential: "core_essential",
  regular: "regular",
  experimental: "test",
  test: "test",
  seasonal: "seasonal",
  temporada: "seasonal",
  limited_drop: "limited_drop",
  low: "low",
  otro: "regular",
};

export type RawRow = Record<string, string>;
export type ParsedRow = {
  rowNumber: number;
  raw: RawRow;
  // normalized
  action: ImportAction;
  core_sku: string;
  product_name: string;
  product_type: string;
  status: string; // mapped to commercial_status
  product_priority: string;
  restock_enabled: boolean | null;
  unit_cost_usd: number | null;
  cost_structure_code: string;
  cost_structure_name: string;
  woo_product_id: number | null;
  woo_product_name: string;
  variant_label: string;
  variant_sku: string;
  woo_variation_id: number | null;
  barcode: string;
  qr_code: string;
  notes: string;
};

export type RowResult =
  | "create_product"
  | "create_product_and_variant"
  | "update_product"
  | "update_product_and_variant"
  | "create_variant"
  | "update_variant"
  | "archive_product"
  | "no_change"
  | "error";

export type PreviewRow = ParsedRow & {
  result: RowResult;
  errors: string[];
  warnings: string[];
  existingProductId?: string | null;
  existingVariantId?: string | null;
  resolvedCostStructureId?: string | null;
};

export type PreviewSummary = {
  total: number;
  productsDetected: number;
  variantsDetected: number;
  productsCreate: number;
  productsUpdate: number;
  variantsCreate: number;
  variantsUpdate: number;
  productsArchive: number;
  errors: number;
  warnings: number;
};

// -------- File parsing --------

export async function parseFile(file: File): Promise<RawRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: "", raw: false });
    return json.map((r) => normalizeKeys(r));
  }
  // CSV
  const text = await file.text();
  const parsed = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() });
  return parsed.data.map((r) => normalizeKeys(r));
}

function normalizeKeys(row: RawRow): RawRow {
  const out: RawRow = {};
  for (const k of Object.keys(row)) {
    out[k.trim().toLowerCase()] = (row[k] ?? "").toString();
  }
  return out;
}

// -------- Normalization --------

function s(v: unknown): string {
  return (v ?? "").toString().trim();
}
function asBool(v: string): boolean | null {
  if (v === "" || v == null) return null;
  const t = v.toLowerCase().trim();
  if (["true", "1", "si", "sí", "yes", "y", "x"].includes(t)) return true;
  if (["false", "0", "no", "n"].includes(t)) return false;
  return null;
}
function asNum(v: string): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v.toString().replace(",", "."));
  return Number.isFinite(n) ? n : NaN as any;
}
function asBigInt(v: string): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v.toString().replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? n : NaN as any;
}

export function normalizeRow(raw: RawRow, rowNumber: number): ParsedRow {
  const actionRaw = s(raw.action).toLowerCase();
  const action = (VALID_ACTIONS.includes(actionRaw as ImportAction) ? actionRaw : "upsert") as ImportAction;
  const priorityRaw = s(raw.strategic_priority).toLowerCase();
  const product_priority = PRIORITY_MAP[priorityRaw] ?? "";
  return {
    rowNumber,
    raw,
    action,
    core_sku: s(raw.core_sku),
    product_name: s(raw.product_name),
    product_type: s(raw.product_type),
    status: s(raw.status).toLowerCase(),
    product_priority,
    restock_enabled: asBool(s(raw.restock_enabled)),
    unit_cost_usd: raw.unit_cost_usd === "" || raw.unit_cost_usd == null ? null : asNum(s(raw.unit_cost_usd)),
    cost_structure_code: s(raw.cost_structure_code),
    cost_structure_name: s(raw.cost_structure_name),
    woo_product_id: raw.woo_product_id === "" || raw.woo_product_id == null ? null : asBigInt(s(raw.woo_product_id)),
    woo_product_name: s(raw.woo_product_name),
    variant_label: s(raw.variant_label).toUpperCase(),
    variant_sku: s(raw.variant_sku),
    woo_variation_id: raw.woo_variation_id === "" || raw.woo_variation_id == null ? null : asBigInt(s(raw.woo_variation_id)),
    barcode: s(raw.barcode),
    qr_code: s(raw.qr_code),
    notes: s(raw.notes),
  };
}

// -------- Validation + Preview --------

export type ExistingProduct = {
  id: string;
  core_sku: string;
  name: string;
  woo_product_id: number | null;
  commercial_status: string;
};
export type ExistingVariant = {
  id: string;
  core_product_id: string;
  size: string;
  variant_sku: string | null;
};
export type CostStructureRef = { id: string; name: string };

export async function loadExistingContext() {
  const [{ data: prods }, { data: vars }, { data: cs }] = await Promise.all([
    supabase.from("core_products").select("id, core_sku, name, woo_product_id, commercial_status"),
    supabase.from("core_product_variants").select("id, core_product_id, size, variant_sku"),
    supabase.from("core_cost_structures").select("id, name"),
  ]);
  return {
    products: (prods ?? []) as ExistingProduct[],
    variants: (vars ?? []) as ExistingVariant[],
    costStructures: (cs ?? []) as CostStructureRef[],
  };
}

export function buildPreview(
  rows: ParsedRow[],
  ctx: { products: ExistingProduct[]; variants: ExistingVariant[]; costStructures: CostStructureRef[] },
): { preview: PreviewRow[]; summary: PreviewSummary } {
  const bySku = new Map(ctx.products.map((p) => [p.core_sku.toUpperCase(), p]));
  const byWooProduct = new Map<number, ExistingProduct>();
  ctx.products.forEach((p) => { if (p.woo_product_id) byWooProduct.set(Number(p.woo_product_id), p); });
  const csByName = new Map(ctx.costStructures.map((c) => [c.name.toLowerCase(), c]));

  // Group rows by core_sku to detect intra-file conflicts
  const groupsBySku = new Map<string, ParsedRow[]>();
  rows.forEach((r) => {
    if (!r.core_sku) return;
    const k = r.core_sku.toUpperCase();
    const arr = groupsBySku.get(k) ?? [];
    arr.push(r);
    groupsBySku.set(k, arr);
  });

  const seenIntraVariants = new Set<string>(); // sku|label

  const preview: PreviewRow[] = rows.map((r) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const skuKey = r.core_sku.toUpperCase();
    const existingProduct = skuKey ? bySku.get(skuKey) ?? null : null;
    const wantsVariant = r.variant_label.length > 0 || r.variant_sku.length > 0 || r.woo_variation_id != null;
    let existingVariant: ExistingVariant | null = null;
    if (existingProduct) {
      const vs = ctx.variants.filter((v) => v.core_product_id === existingProduct.id);
      if (r.variant_sku) existingVariant = vs.find((v) => (v.variant_sku ?? "").toUpperCase() === r.variant_sku.toUpperCase()) ?? null;
      if (!existingVariant && r.variant_label) existingVariant = vs.find((v) => (v.size ?? "").toUpperCase() === r.variant_label) ?? null;
    }

    // Validations
    if (!r.core_sku && r.action !== "create") {
      // allow blank sku only for create (auto-generate); otherwise error
      if (r.action !== "create") warnings.push("core_sku vacío: se generará automáticamente al crear");
    }
    if (r.action === "create" && existingProduct) {
      errors.push("create pero el core_sku ya existe");
    }
    if (r.action === "update" && !existingProduct) {
      errors.push("update pero el core_sku no existe");
    }
    if ((r.action === "create" || (r.action === "upsert" && !existingProduct)) && !r.product_name) {
      errors.push("product_name requerido para producto nuevo");
    }
    if (r.status && !VALID_STATUS.includes(r.status)) {
      errors.push(`status inválido: ${r.status}`);
    }
    if (r.raw.restock_enabled && r.restock_enabled === null) {
      errors.push("restock_enabled debe ser true/false");
    }
    if (r.raw.unit_cost_usd && (r.unit_cost_usd === null || Number.isNaN(r.unit_cost_usd as number) || (r.unit_cost_usd as number) < 0)) {
      errors.push("unit_cost_usd inválido");
    }
    if (r.raw.woo_product_id && (r.woo_product_id === null || Number.isNaN(r.woo_product_id as number))) {
      errors.push("woo_product_id debe ser numérico");
    }
    if (r.raw.woo_variation_id && (r.woo_variation_id === null || Number.isNaN(r.woo_variation_id as number))) {
      errors.push("woo_variation_id debe ser numérico");
    }
    if (r.raw.strategic_priority && !r.product_priority) {
      warnings.push(`strategic_priority desconocida: ${r.raw.strategic_priority}`);
    }
    // cost structure
    let resolvedCostStructureId: string | null = null;
    if (r.cost_structure_name) {
      const found = csByName.get(r.cost_structure_name.toLowerCase());
      if (found) resolvedCostStructureId = found.id;
      else warnings.push(`cost_structure no encontrada: ${r.cost_structure_name}`);
    }
    // Woo id already linked to another product
    if (r.woo_product_id) {
      const owner = byWooProduct.get(Number(r.woo_product_id));
      if (owner && (!existingProduct || owner.id !== existingProduct.id)) {
        warnings.push(`woo_product_id ${r.woo_product_id} ya pertenece a ${owner.core_sku}`);
      }
    }
    // intra-file variant duplicates
    if (skuKey && r.variant_label) {
      const k2 = `${skuKey}|${r.variant_label}`;
      if (seenIntraVariants.has(k2)) errors.push("duplicado en el archivo (sku+variante)");
      seenIntraVariants.add(k2);
    }
    // intra-file product conflict on name/type
    const group = skuKey ? groupsBySku.get(skuKey) ?? [] : [];
    if (group.length > 1) {
      const names = new Set(group.map((g) => g.product_name).filter(Boolean));
      if (names.size > 1) warnings.push("product_name distinto entre filas con el mismo core_sku");
    }

    // archive
    if (r.action === "archive") {
      if (!existingProduct) errors.push("archive pero el core_sku no existe");
    }

    let result: RowResult = "no_change";
    if (errors.length > 0) {
      result = "error";
    } else if (r.action === "archive") {
      result = "archive_product";
    } else {
      const willCreateProduct = !existingProduct;
      const willCreateVariant = wantsVariant && !existingVariant;
      if (willCreateProduct && willCreateVariant) result = "create_product_and_variant";
      else if (willCreateProduct) result = "create_product";
      else if (willCreateVariant) result = wantsVariant ? "create_variant" : "update_product";
      else if (wantsVariant && existingVariant) {
        result = existingProduct ? "update_product_and_variant" : "update_variant";
        warnings.push("variante ya existe y se actualizará");
      } else if (existingProduct) {
        result = "update_product";
        warnings.push("producto ya existe y se actualizará");
      }
    }

    return {
      ...r,
      errors,
      warnings,
      result,
      existingProductId: existingProduct?.id ?? null,
      existingVariantId: existingVariant?.id ?? null,
      resolvedCostStructureId,
    };
  });

  // summary
  const productSkus = new Set<string>();
  const variantKeys = new Set<string>();
  let pc = 0, pu = 0, vc = 0, vu = 0, pa = 0, err = 0, warn = 0;
  preview.forEach((p) => {
    if (p.core_sku) productSkus.add(p.core_sku.toUpperCase());
    if (p.variant_label) variantKeys.add(`${p.core_sku.toUpperCase()}|${p.variant_label}`);
    if (p.errors.length) err++;
    if (p.warnings.length) warn++;
    if (p.result === "error") return;
    if (p.result === "create_product" || p.result === "create_product_and_variant") pc++;
    if (p.result === "update_product" || p.result === "update_product_and_variant") pu++;
    if (p.result === "create_variant" || p.result === "create_product_and_variant") vc++;
    if (p.result === "update_variant" || p.result === "update_product_and_variant") vu++;
    if (p.result === "archive_product") pa++;
  });

  return {
    preview,
    summary: {
      total: preview.length,
      productsDetected: productSkus.size,
      variantsDetected: variantKeys.size,
      productsCreate: pc,
      productsUpdate: pu,
      variantsCreate: vc,
      variantsUpdate: vu,
      productsArchive: pa,
      errors: err,
      warnings: warn,
    },
  };
}

// -------- Apply --------

const CLEAR_TOKEN = "CLEAR";

function cleanField(value: string, currentNonEmpty: boolean): { skip: boolean; value: string | null } {
  if (value === CLEAR_TOKEN) return { skip: false, value: null };
  if (value === "" || value == null) return { skip: true, value: null }; // preserve existing
  return { skip: false, value };
}

export type ApplyResult = {
  jobId: string;
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  archived: number;
  errors: number;
};

async function nextCoreSku(): Promise<string> {
  const { data } = await supabase.from("core_settings").select("id, sku_prefix, sku_digits, sku_last_number").maybeSingle();
  const prefix = data?.sku_prefix ?? "CORE";
  const digits = data?.sku_digits ?? 6;
  const next = (data?.sku_last_number ?? 0) + 1;
  if (data?.id) await supabase.from("core_settings").update({ sku_last_number: next }).eq("id", data.id);
  return `${prefix}${String(next).padStart(digits, "0")}`;
}

export async function applyImport(
  fileName: string,
  preview: PreviewRow[],
  summary: PreviewSummary,
): Promise<ApplyResult> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: job, error: jobErr } = await supabase.from("core_product_import_jobs").insert({
    file_name: fileName,
    status: "preview",
    total_rows: summary.total,
    errors_count: summary.errors,
    warnings_count: summary.warnings,
    created_by: user?.id ?? null,
  }).select().single();
  if (jobErr || !job) throw new Error(jobErr?.message ?? "No se pudo crear el job");

  let productsCreated = 0, productsUpdated = 0, variantsCreated = 0, variantsUpdated = 0, archived = 0, errors = 0;
  const jobRows: any[] = [];

  // Resolve product per group: first row defines product fields
  const productCacheBySku = new Map<string, string>(); // sku → id

  for (const row of preview) {
    if (row.result === "error") {
      errors++;
      jobRows.push({
        job_id: job.id, row_number: row.rowNumber, action: row.action, core_sku: row.core_sku,
        product_name: row.product_name, variant_label: row.variant_label,
        result: "error", errors: row.errors, warnings: row.warnings, raw_payload: row.raw,
      });
      continue;
    }

    try {
      let productId = row.existingProductId ?? productCacheBySku.get(row.core_sku.toUpperCase()) ?? null;
      let createdProduct = false, updatedProduct = false;
      let createdVariant = false, updatedVariant = false;

      // ARCHIVE
      if (row.action === "archive") {
        if (productId) {
          await supabase.from("core_products").update({ commercial_status: "archived" }).eq("id", productId);
          archived++;
        }
      } else {
        // Build product payload
        if (!productId) {
          // create product
          const sku = row.core_sku || (await nextCoreSku());
          const payload: any = {
            core_sku: sku,
            name: row.product_name,
            sku_source: "core_generated",
            sync_status: "manual_only",
          };
          if (row.product_type) payload.product_type = row.product_type;
          if (row.status) payload.commercial_status = row.status;
          if (row.product_priority) payload.product_priority = row.product_priority;
          if (row.restock_enabled !== null) payload.is_restockable = row.restock_enabled;
          if (row.unit_cost_usd !== null && !Number.isNaN(row.unit_cost_usd as number)) payload.unit_cost = row.unit_cost_usd;
          if (row.resolvedCostStructureId) payload.cost_structure_id = row.resolvedCostStructureId;
          if (row.woo_product_id !== null && !Number.isNaN(row.woo_product_id as number)) payload.woo_product_id = row.woo_product_id;
          if (row.woo_product_name) payload.woo_product_name = row.woo_product_name;
          if (row.notes) payload.notes = row.notes === CLEAR_TOKEN ? null : row.notes;
          payload.created_by = user?.id ?? null;
          payload.updated_by = user?.id ?? null;

          const { data: p, error } = await supabase.from("core_products").insert(payload).select().single();
          if (error) throw new Error(error.message);
          productId = p!.id;
          createdProduct = true;
          productsCreated++;
          productCacheBySku.set(sku.toUpperCase(), productId!);
        } else {
          // update product (preserve empty fields)
          const upd: any = {};
          if (row.product_name) upd.name = row.product_name;
          if (row.product_type) upd.product_type = row.product_type;
          if (row.status) upd.commercial_status = row.status;
          if (row.product_priority) upd.product_priority = row.product_priority;
          if (row.restock_enabled !== null) upd.is_restockable = row.restock_enabled;
          if (row.unit_cost_usd !== null && !Number.isNaN(row.unit_cost_usd as number)) upd.unit_cost = row.unit_cost_usd;
          if (row.resolvedCostStructureId) upd.cost_structure_id = row.resolvedCostStructureId;
          if (row.woo_product_id !== null && !Number.isNaN(row.woo_product_id as number)) upd.woo_product_id = row.woo_product_id;
          if (row.woo_product_name) upd.woo_product_name = row.woo_product_name;
          if (row.notes === CLEAR_TOKEN) upd.notes = null;
          else if (row.notes) upd.notes = row.notes;
          if (Object.keys(upd).length > 0) {
            upd.updated_by = user?.id ?? null;
            const { error } = await supabase.from("core_products").update(upd).eq("id", productId);
            if (error) throw new Error(error.message);
            updatedProduct = true;
            productsUpdated++;
          }
          productCacheBySku.set(row.core_sku.toUpperCase(), productId!);
        }

        // Variant
        if (productId && (row.variant_label || row.variant_sku || row.woo_variation_id != null)) {
          if (row.existingVariantId) {
            const vupd: any = {};
            if (row.variant_label) vupd.size = row.variant_label;
            if (row.variant_sku) vupd.variant_sku = row.variant_sku;
            if (row.woo_variation_id !== null && !Number.isNaN(row.woo_variation_id as number)) vupd.woo_variation_id = row.woo_variation_id;
            if (row.barcode === CLEAR_TOKEN) vupd.barcode = null; else if (row.barcode) vupd.barcode = row.barcode;
            if (row.qr_code === CLEAR_TOKEN) vupd.qr_code = null; else if (row.qr_code) vupd.qr_code = row.qr_code;
            if (Object.keys(vupd).length > 0) {
              const { error } = await supabase.from("core_product_variants").update(vupd).eq("id", row.existingVariantId);
              if (error) throw new Error(error.message);
              updatedVariant = true;
              variantsUpdated++;
            }
          } else if (row.variant_label) {
            const vpayload: any = {
              core_product_id: productId,
              size: row.variant_label,
              status: "active",
            };
            if (row.variant_sku) vpayload.variant_sku = row.variant_sku;
            if (row.woo_variation_id !== null && !Number.isNaN(row.woo_variation_id as number)) vpayload.woo_variation_id = row.woo_variation_id;
            if (row.barcode && row.barcode !== CLEAR_TOKEN) vpayload.barcode = row.barcode;
            if (row.qr_code && row.qr_code !== CLEAR_TOKEN) vpayload.qr_code = row.qr_code;
            const { error } = await supabase.from("core_product_variants").insert(vpayload);
            if (error) throw new Error(error.message);
            createdVariant = true;
            variantsCreated++;
          }
        }
      }

      jobRows.push({
        job_id: job.id, row_number: row.rowNumber, action: row.action, core_sku: row.core_sku,
        product_name: row.product_name, variant_label: row.variant_label,
        result: row.result,
        errors: row.errors, warnings: row.warnings, raw_payload: row.raw,
        created_product_id: createdProduct ? productId : null,
        updated_product_id: updatedProduct ? productId : null,
        created_variant_id: createdVariant ? null : null, // not capturing variant id to keep code short
        updated_variant_id: updatedVariant ? row.existingVariantId ?? null : null,
      });
    } catch (e: any) {
      errors++;
      jobRows.push({
        job_id: job.id, row_number: row.rowNumber, action: row.action, core_sku: row.core_sku,
        product_name: row.product_name, variant_label: row.variant_label,
        result: "error", errors: [e?.message ?? "error"], warnings: row.warnings, raw_payload: row.raw,
      });
    }
  }

  // insert job rows in chunks
  for (let i = 0; i < jobRows.length; i += 200) {
    await supabase.from("core_product_import_job_rows").insert(jobRows.slice(i, i + 200));
  }

  await supabase.from("core_product_import_jobs").update({
    status: errors > 0 && (productsCreated + productsUpdated + variantsCreated + variantsUpdated + archived) === 0 ? "failed" : "applied",
    products_created: productsCreated,
    products_updated: productsUpdated,
    variants_created: variantsCreated,
    variants_updated: variantsUpdated,
    errors_count: errors,
    warnings_count: summary.warnings,
    applied_at: new Date().toISOString(),
    applied_by: user?.id ?? null,
  }).eq("id", job.id);

  return { jobId: job.id, productsCreated, productsUpdated, variantsCreated, variantsUpdated, archived, errors };
}

// -------- Template / Export downloads --------

function toCsv(headers: readonly string[], rows: (string | number | null)[][]): string {
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function downloadTemplate() {
  const sample: Record<string, string>[] = [
    {
      action: "upsert", core_sku: "CAN0001", product_name: "Basico T-Shirt Canserbero", product_type: "franela",
      status: "active", strategic_priority: "regular", restock_enabled: "true", unit_cost_usd: "10.10",
      cost_structure_code: "", cost_structure_name: "",
      woo_product_id: "", woo_product_name: "",
      variant_label: "S", variant_sku: "CAN0001-S", woo_variation_id: "",
      barcode: "", qr_code: "", notes: "",
    },
    {
      action: "upsert", core_sku: "CAN0001", product_name: "Basico T-Shirt Canserbero", product_type: "franela",
      status: "active", strategic_priority: "regular", restock_enabled: "true", unit_cost_usd: "10.10",
      cost_structure_code: "", cost_structure_name: "",
      woo_product_id: "", woo_product_name: "",
      variant_label: "M", variant_sku: "CAN0001-M", woo_variation_id: "",
      barcode: "", qr_code: "", notes: "",
    },
    {
      action: "create", core_sku: "", product_name: "Producto nuevo sin variantes", product_type: "accesorio",
      status: "draft", strategic_priority: "regular", restock_enabled: "false", unit_cost_usd: "5.00",
      cost_structure_code: "", cost_structure_name: "",
      woo_product_id: "", woo_product_name: "",
      variant_label: "", variant_sku: "", woo_variation_id: "",
      barcode: "", qr_code: "", notes: "",
    },
  ];
  const rows = sample.map((s) => IMPORT_COLUMNS.map((c) => s[c] ?? ""));
  const csv = toCsv(IMPORT_COLUMNS, rows);
  download(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "core-catalogo-fabricacion-template.csv");
}

const REVERSE_STATUS: Record<string, string> = {
  active: "active", inactive: "inactive", archived: "archived",
  draft: "draft", discontinued: "discontinued", stock_only: "stock_only",
};
const REVERSE_PRIORITY: Record<string, string> = {
  core_essential: "core", regular: "regular", test: "experimental",
  seasonal: "seasonal", limited_drop: "limited_drop", low: "low",
};

export async function exportCatalog(opts: { search?: string; status?: string; type?: string; restock?: string }) {
  let q = supabase.from("core_products").select(
    "id, core_sku, name, product_type, commercial_status, product_priority, is_restockable, unit_cost, woo_product_id, woo_product_name, notes, updated_at, cost_structure_id"
  );
  if (opts.status && opts.status !== "all") q = q.eq("commercial_status", opts.status);
  if (opts.type && opts.type !== "all") q = q.eq("product_type", opts.type);
  if (opts.restock === "yes") q = q.eq("is_restockable", true);
  if (opts.restock === "no") q = q.eq("is_restockable", false);
  const { data: prods, error } = await q.order("core_sku");
  if (error) throw new Error(error.message);

  let products = (prods ?? []) as any[];
  if (opts.search) {
    const s = opts.search.toLowerCase();
    products = products.filter((p) => p.name.toLowerCase().includes(s) || p.core_sku.toLowerCase().includes(s));
  }
  const ids = products.map((p) => p.id);
  const { data: vars } = ids.length
    ? await supabase.from("core_product_variants").select("core_product_id, size, variant_sku, woo_variation_id, barcode, qr_code, notes").in("core_product_id", ids)
    : { data: [] as any[] };
  const { data: cs } = await supabase.from("core_cost_structures").select("id, name");
  const csMap = new Map((cs ?? []).map((c: any) => [c.id, c.name]));
  const varsByProduct = new Map<string, any[]>();
  (vars ?? []).forEach((v: any) => {
    const arr = varsByProduct.get(v.core_product_id) ?? [];
    arr.push(v);
    varsByProduct.set(v.core_product_id, arr);
  });

  const rows: (string | number | null)[][] = [];
  for (const p of products) {
    const csName = p.cost_structure_id ? csMap.get(p.cost_structure_id) ?? "" : "";
    const variants = varsByProduct.get(p.id) ?? [];
    if (variants.length === 0) {
      rows.push(buildExportRow(p, csName, null));
    } else {
      for (const v of variants) rows.push(buildExportRow(p, csName, v));
    }
  }
  const csv = toCsv(EXPORT_COLUMNS, rows);
  download(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `core-catalogo-fabricacion-${new Date().toISOString().slice(0, 10)}.csv`);
}

function buildExportRow(p: any, csName: string, v: any | null): (string | number | null)[] {
  return [
    "upsert",
    p.core_sku ?? "",
    p.name ?? "",
    p.product_type ?? "",
    REVERSE_STATUS[p.commercial_status] ?? p.commercial_status ?? "",
    REVERSE_PRIORITY[p.product_priority] ?? p.product_priority ?? "",
    p.is_restockable ? "true" : "false",
    Number(p.unit_cost ?? 0),
    "",
    csName ?? "",
    p.woo_product_id ?? "",
    p.woo_product_name ?? "",
    v?.size ?? "",
    v?.variant_sku ?? "",
    v?.woo_variation_id ?? "",
    v?.barcode ?? "",
    v?.qr_code ?? "",
    p.notes ?? "",
    p.updated_at ?? "",
  ];
}

export function downloadErrorsCsv(rows: PreviewRow[]) {
  const headers = ["row", "action", "core_sku", "product_name", "variant_label", "result", "errors", "warnings"];
  const data = rows
    .filter((r) => r.errors.length || r.warnings.length)
    .map((r) => [r.rowNumber, r.action, r.core_sku, r.product_name, r.variant_label, r.result, r.errors.join(" | "), r.warnings.join(" | ")]);
  const csv = toCsv(headers, data);
  download(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "core-import-errores.csv");
}
