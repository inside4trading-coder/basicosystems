// Resuelve el código de variante interno (p. ej. MSW56) para etiquetas / fichas.
// Solo presentación: no toca QR, escaneo ni inventario.

export const VARIANT_CODE_FALLBACK = "Código variante no disponible";

const SIZE_TOKENS = new Set([
  "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL", "4XL",
  "TALLAS", "TALLAM", "TALLAL", "TALLAXL", "TALLAXS", "TALLAXXL",
  "UNICA", "ÚNICA", "U",
]);

const CODE_RE = /^[A-Z]{2,6}\d{2,6}$/;

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const low = s.toLowerCase();
  if (low === "null" || low === "none" || low === "undefined") return null;
  return s;
}

/** "MSW56 L" -> "MSW56" ; "JGM45 Talla M" -> "JGM45" ; deja intacto lo demás. */
export function stripSizeSuffix(raw: string): string {
  const parts = raw.trim().split(/[\s_]+/).filter(Boolean);
  while (parts.length > 1) {
    const last = parts[parts.length - 1].toUpperCase().replace(/\s+/g, "");
    const prev = parts.length > 2 ? parts[parts.length - 2].toUpperCase() : "";
    if (SIZE_TOKENS.has(last) || (prev === "TALLA" && last.length <= 4)) {
      parts.pop();
      if (parts[parts.length - 1]?.toUpperCase() === "TALLA") parts.pop();
      continue;
    }
    break;
  }
  return parts.join(" ");
}

/** Busca un token tipo MSW56 dentro del unit_code (OP-000017-MSW56-L-001). */
function fromUnitCode(unitCode: string | null | undefined): string | null {
  const s = clean(unitCode);
  if (!s) return null;
  const tokens = s.toUpperCase().split(/[-/\s]+/).filter(Boolean);
  for (const t of tokens) {
    if (CODE_RE.test(t)) return t;
  }
  return null;
}

export type VariantCodeSource = {
  unit_variant_sku?: string | null;
  variant_variant_sku?: string | null;
  variant_woo_sku?: string | null;
  unit_code?: string | null;
};

/**
 * Prioridad: variant_sku de la unidad → variant_sku de la variante →
 * woo_sku de la variación → código embebido en unit_code → fallback textual.
 */
export function resolveVariantCode(src: VariantCodeSource): string {
  const candidates = [
    clean(src.unit_variant_sku),
    clean(src.variant_variant_sku),
    clean(src.variant_woo_sku),
  ];
  for (const c of candidates) {
    if (!c) continue;
    const base = stripSizeSuffix(c);
    if (base) return base;
  }
  return fromUnitCode(src.unit_code) ?? VARIANT_CODE_FALLBACK;
}
