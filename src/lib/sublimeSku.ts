/**
 * SKU DEFINITIVO SUBLIME
 *
 * No se inventa un formato nuevo: se detecta la convención real ya usada en
 * `sublime_variants` (hoy `SUB####` y `JUL####`) y se continúa la serie.
 * El SKU vive SIEMPRE a nivel de variante y debe ser único.
 */

export const SKU_PLACEHOLDERS = ["pendiente", "null", "undefined", "n/a", "na", "-", "sin sku"];

/** Limpia espacios y mayúsculas. */
export function normalizeSku(raw: string | null | undefined): string {
  return String(raw ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

/** Un SKU definitivo válido: no vacío y no un marcador de "pendiente". */
export function isValidSku(raw: string | null | undefined): boolean {
  const s = normalizeSku(raw);
  if (!s) return false;
  if (SKU_PLACEHOLDERS.includes(s.toLowerCase())) return false;
  return s.length >= 3;
}

/** Texto seguro para mostrar: nunca "null"/"undefined"/vacío. */
export function displaySku(raw: string | null | undefined): string | null {
  return isValidSku(raw) ? normalizeSku(raw) : null;
}

export interface SkuConvention {
  prefix: string;
  digits: number;
  lastNumber: number;
}

const SERIAL_RE = /^([A-Z]{2,6})(\d{3,8})$/;

/** Deduce la convención dominante a partir de los SKU existentes. */
export function detectSkuConvention(existing: (string | null | undefined)[]): SkuConvention {
  const counts = new Map<string, { count: number; digits: number; max: number }>();
  for (const raw of existing) {
    const s = normalizeSku(raw);
    const m = SERIAL_RE.exec(s);
    if (!m) continue;
    const [, prefix, digits] = m;
    const cur = counts.get(prefix) ?? { count: 0, digits: digits.length, max: 0 };
    cur.count += 1;
    cur.digits = Math.max(cur.digits, digits.length);
    cur.max = Math.max(cur.max, Number(digits));
    counts.set(prefix, cur);
  }
  let best: SkuConvention = { prefix: "SUB", digits: 4, lastNumber: 0 };
  let bestCount = 0;
  for (const [prefix, info] of counts) {
    if (info.count > bestCount) {
      bestCount = info.count;
      best = { prefix, digits: info.digits, lastNumber: info.max };
    }
  }
  return best;
}

/** Siguiente SKU libre siguiendo la convención detectada. */
export function nextSublimeSku(existing: (string | null | undefined)[], convention?: SkuConvention): string {
  const conv = convention ?? detectSkuConvention(existing);
  const taken = new Set(existing.map((s) => normalizeSku(s)).filter(Boolean));
  let n = conv.lastNumber;
  for (let i = 0; i < 100000; i++) {
    n += 1;
    const candidate = `${conv.prefix}${String(n).padStart(conv.digits, "0")}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${conv.prefix}${Date.now()}`;
}

/** Motivo por el que un SKU propuesto no puede guardarse. */
export function skuConflict(
  candidate: string,
  variantId: string,
  all: { id: string; sku: string | null }[]
): string | null {
  const s = normalizeSku(candidate);
  if (!s) return "El SKU no puede quedar vacío.";
  if (!isValidSku(s)) return "Ese texto no es un SKU válido.";
  const clash = all.find((v) => v.id !== variantId && normalizeSku(v.sku) === s);
  return clash ? `El SKU ${s} ya pertenece a otra variante.` : null;
}
