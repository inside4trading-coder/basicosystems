import { estudioDb } from "@/lib/estudioDb";

/** Fondo dinámico configurable: portada para la card y referencia para el pipeline. */
export interface StudioBackground {
  id: string;
  name: string;
  slug: string;
  cover_path: string | null;
  reference_path: string | null;
  is_active: boolean;
  sort_order: number;
}

/** Prompt de una combinación exacta fondo + modelo. No hay fallback entre combinaciones. */
export interface StudioBackgroundPrompt {
  id: string;
  background_id: string;
  model_id: string;
  prompt_text: string;
}

export async function loadStudioBackgrounds(opts?: { onlyActive?: boolean }): Promise<StudioBackground[]> {
  let query = estudioDb.from("estudio_backgrounds").select("*").order("sort_order").order("name");
  if (opts?.onlyActive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as StudioBackground[];
}

export async function loadStudioBackgroundPrompts(backgroundId?: string): Promise<StudioBackgroundPrompt[]> {
  let query = estudioDb.from("estudio_background_prompts").select("*");
  if (backgroundId) query = query.eq("background_id", backgroundId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as StudioBackgroundPrompt[];
}

/**
 * Devuelve el prompt exacto de esa combinación o `null`.
 * Deliberadamente no cae en el prompt de otro modelo ni en el estilo genérico.
 */
export function resolveBackgroundPrompt(
  prompts: StudioBackgroundPrompt[],
  backgroundId: string | null,
  modelId: string,
): string | null {
  if (!backgroundId || !modelId) return null;
  const row = prompts.find((p) => p.background_id === backgroundId && p.model_id === modelId);
  const text = row?.prompt_text?.trim();
  return text ? text : null;
}

export async function saveStudioBackground(
  values: Omit<StudioBackground, "id"> & { id?: string },
): Promise<StudioBackground> {
  const payload = {
    name: values.name,
    slug: values.slug,
    cover_path: values.cover_path,
    reference_path: values.reference_path,
    is_active: values.is_active,
    sort_order: values.sort_order,
  };
  const query = values.id
    ? estudioDb.from("estudio_backgrounds").update(payload).eq("id", values.id).select().single()
    : estudioDb.from("estudio_backgrounds").insert(payload).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return data as StudioBackground;
}

/** Guarda los prompts editados: vacío borra la fila, con texto hace upsert de la combinación. */
export async function saveStudioBackgroundPrompts(
  backgroundId: string,
  byModel: Record<string, string>,
): Promise<void> {
  const rows = Object.entries(byModel)
    .filter(([, text]) => text.trim().length > 0)
    .map(([model_id, prompt_text]) => ({ background_id: backgroundId, model_id, prompt_text: prompt_text.trim() }));

  const emptyModels = Object.entries(byModel)
    .filter(([, text]) => text.trim().length === 0)
    .map(([model_id]) => model_id);

  if (rows.length) {
    const { error } = await estudioDb
      .from("estudio_background_prompts")
      .upsert(rows, { onConflict: "background_id,model_id" });
    if (error) throw error;
  }
  if (emptyModels.length) {
    const { error } = await estudioDb
      .from("estudio_background_prompts")
      .delete()
      .eq("background_id", backgroundId)
      .in("model_id", emptyModels);
    if (error) throw error;
  }
}

export function slugifyBackgroundName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
