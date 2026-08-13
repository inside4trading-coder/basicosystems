/**
 * Numeración y nombres de archivo de BASICO STUDIO.
 *
 * El backend no guarda ni el tipo de tarjeta elegida ni el número correlativo, y este bloque
 * es solo de UI: la metadata de cada set (sesión de generación) se lleva en el navegador,
 * indexada por el `session_id` que ya se envía a la Edge Function.
 */

export type StudioKind = "catalogo" | "transparente" | "dinamico";
export type StudioMode = "individual" | "carrusel";

export interface StudioSetMeta {
  seq: number;
  kind: StudioKind;
  mode: StudioMode;
}

const META_KEY = "basico-studio-sets";
const SEQ_KEY = "basico-studio-seq";

export const STUDIO_KIND_LABELS: Record<StudioKind, string> = {
  catalogo: "Foto para catálogo",
  transparente: "Fondo transparente",
  dinamico: "Fondo dinámico",
};

function readMap(): Record<string, StudioSetMeta> {
  try {
    const raw = window.localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as Record<string, StudioSetMeta>) : {};
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, StudioSetMeta>) {
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(map));
  } catch {
    // Si el almacenamiento está lleno o bloqueado, la app sigue funcionando sin numeración.
  }
}

/** Reserva el siguiente número correlativo de generación (0001, 0002, …). */
export function nextStudioSeq(): number {
  let current = 0;
  try {
    current = Number(window.localStorage.getItem(SEQ_KEY) ?? "0") || 0;
  } catch {
    current = 0;
  }
  const next = current + 1;
  try {
    window.localStorage.setItem(SEQ_KEY, String(next));
  } catch {
    // idem
  }
  return next;
}

export function saveStudioSetMeta(sessionId: string, meta: StudioSetMeta) {
  const map = readMap();
  map[sessionId] = meta;
  writeMap(map);
}

export function getStudioSetMeta(sessionId: string | null): StudioSetMeta | null {
  if (!sessionId) return null;
  return readMap()[sessionId] ?? null;
}

export function formatStudioSeq(seq: number): string {
  return String(seq).padStart(4, "0");
}

/** `BASICO-STUDIO-0001-01.png` */
export function studioFileName(seq: number, index: number, ext = "png"): string {
  return `BASICO-STUDIO-${formatStudioSeq(seq)}-${String(index).padStart(2, "0")}.${ext}`;
}
