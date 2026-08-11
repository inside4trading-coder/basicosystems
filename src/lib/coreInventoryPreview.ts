// Vencimiento de "entradas preparadas" (previews de escritura Woo).
// Una entrada preparada usa un snapshot del stock de WooCommerce; si pasa demasiado
// tiempo, el stock real pudo cambiar por ventas y el esperado deja de ser válido.

export const INVENTORY_PREVIEW_TTL_MINUTES = 15;

type PreviewLike = {
  created_at?: string | null;
  request_payload?: any;
};

/** Momento en que se tomó el stock (se actualiza al regenerar, no solo al crear). */
export function previewGeneratedAt(log: PreviewLike | null | undefined): Date | null {
  if (!log) return null;
  const raw =
    (log.request_payload && (log.request_payload as any).preview_generated_at) ||
    log.created_at ||
    null;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export function previewAgeMinutes(log: PreviewLike | null | undefined): number | null {
  const d = previewGeneratedAt(log);
  if (!d) return null;
  return (Date.now() - d.getTime()) / 60000;
}

/** true si la entrada preparada superó el TTL y debe actualizarse contra Woo. */
export function isPreviewStale(log: PreviewLike | null | undefined): boolean {
  const age = previewAgeMinutes(log);
  if (age === null) return true;
  return age >= INVENTORY_PREVIEW_TTL_MINUTES;
}

export function previewAgeLabel(log: PreviewLike | null | undefined): string {
  const age = previewAgeMinutes(log);
  if (age === null) return "—";
  if (age < 1) return "hace menos de 1 min";
  if (age < 60) return `hace ${Math.floor(age)} min`;
  const hours = Math.floor(age / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

export const PREVIEW_STALE_TEXT =
  `Esta entrada fue preparada hace más de ${INVENTORY_PREVIEW_TTL_MINUTES} minutos. ` +
  `Actualiza el stock esperado para usar el stock Woo actual.`;
