import { estudioDb } from "@/lib/estudioDb";

/**
 * Prompts base de BASICO STUDIO por tipo de card.
 *
 * Se guardan en la tabla existente `estudio_prompt_presets` (sin cambios de esquema):
 * cada card tiene una fila identificada por nombre canónico. Los estilos antiguos siguen
 * en la base pero ya no se muestran en la configuración.
 */
export type StudioBaseKind = "catalogo" | "transparente";

export const STUDIO_BASE_PRESET_NAMES: Record<StudioBaseKind, string> = {
  catalogo: "Foto para catálogo",
  transparente: "Fondo transparente",
};

/** Fila heredada que ya contenía el prompt de catálogo antes de la reorganización. */
const LEGACY_CATALOG_NAME = "Fondo blanco — default";

export interface StudioPromptPreset {
  id: string;
  name: string;
  photo_type: "fondo_blanco" | "modelo" | "mockup";
  prompt_text: string;
  image_model: string;
  is_default: boolean;
}

export async function loadStudioPromptPresets(): Promise<StudioPromptPreset[]> {
  const { data, error } = await estudioDb.from("estudio_prompt_presets").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as StudioPromptPreset[];
}

/** Devuelve la fila que hace de prompt base de esa card, o `null` si aún no existe. */
export function findBasePreset(
  presets: StudioPromptPreset[],
  kind: StudioBaseKind,
): StudioPromptPreset | null {
  const canonical = presets.find((p) => p.name === STUDIO_BASE_PRESET_NAMES[kind]);
  if (canonical) return canonical;
  if (kind === "catalogo") {
    return (
      presets.find((p) => p.name === LEGACY_CATALOG_NAME) ??
      presets.find((p) => p.photo_type === "fondo_blanco" && p.is_default) ??
      presets.find((p) => p.photo_type === "fondo_blanco") ??
      null
    );
  }
  return null;
}

/** Guarda el prompt base: actualiza la fila existente o crea la de esa card si falta. */
export async function saveStudioBasePrompt(
  presets: StudioPromptPreset[],
  kind: StudioBaseKind,
  promptText: string,
): Promise<void> {
  const existing = findBasePreset(presets, kind);
  if (existing) {
    const { error } = await estudioDb
      .from("estudio_prompt_presets")
      .update({ prompt_text: promptText, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }
  // Se reutiliza el modelo de cualquier preset existente: la columna es obligatoria pero
  // ya no se usa para generar (el modelo se elige en el asistente).
  const { error } = await estudioDb.from("estudio_prompt_presets").insert({
    name: STUDIO_BASE_PRESET_NAMES[kind],
    photo_type: "fondo_blanco",
    prompt_text: promptText,
    image_model: presets[0]?.image_model ?? "google/gemini-2.5-flash-image",
    is_default: false,
  });
  if (error) throw error;
}

/** Sección estructurada con el contexto extra que escribió el usuario para esa prenda. */
export const GARMENT_NOTES_HEADER = "Additional garment notes:";

/** Devuelve el prompt final: base + notas de la prenda (si las hay). */
export function withGarmentNotes(prompt: string, notes: string | null | undefined): string {
  const clean = (notes ?? "").trim();
  if (!clean) return prompt;
  return `${prompt}\n\n${GARMENT_NOTES_HEADER}\n${clean}`;
}

