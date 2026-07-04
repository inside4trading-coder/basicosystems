/** Normaliza etiquetas Woo: trim, sin acentos, mayúsculas, sin espacios múltiples. */
export function normalizeSize(label: string | null | undefined): string {
  if (!label) return "";
  return label
    .replace(/^\s*talla\s+/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function normalizeColor(label: string | null | undefined): string {
  if (!label) return "";
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
