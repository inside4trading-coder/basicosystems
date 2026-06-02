/** Normaliza etiquetas de talla provenientes de Woo (quita "Talla", trim, uppercase). */
export function normalizeSize(label: string | null | undefined): string {
  if (!label) return "";
  return label
    .replace(/^\s*talla\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export const MATERIAL_TYPE_LABEL: Record<string, string> = {
  blank: "Blank",
  dtf: "DTF",
  packaging: "Packaging",
  supply: "Insumo",
  other: "Otro",
};

export const MATERIAL_UNIT_LABEL: Record<string, string> = {
  unit: "unidad",
  meter: "metro",
  sheet: "hoja",
  roll: "rollo",
  kg: "kg",
  other: "otro",
};

export const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  initial_stock: "Stock inicial",
  manual_in: "Entrada",
  manual_out: "Salida",
  adjustment: "Ajuste",
  correction: "Corrección",
  return: "Devolución",
  transfer_in: "Transferencia entrada",
  transfer_out: "Transferencia salida",
  fabrication_consumption: "Consumo fabricación",
};
