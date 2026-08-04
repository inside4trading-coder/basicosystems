import { estudioDb } from "@/lib/estudioDb";

export type ModelKind = "image" | "video";

export interface EnabledModel {
  id: string;
  model_id: string;
  kind: ModelKind;
  label: string | null;
  is_enabled: boolean;
}

/** Modelo tal como lo expone el catálogo vivo de OpenRouter. */
export interface CatalogModel {
  id: string;
  name: string;
  /** Precio por token de salida de imagen. `null` para video: OpenRouter no lo publica. */
  imageOutputPrice: number | null;
}

/**
 * Una imagen generada consume ~1290 tokens de salida, así que el precio por token del
 * catálogo se traduce a un costo aproximado por imagen. Es una estimación para orientar
 * la elección de modelo; el costo real llega en `usage.cost` de cada generación.
 */
const TOKENS_PER_IMAGE = 1290;

export function estimatedImageCost(model: CatalogModel): number | null {
  if (model.imageOutputPrice == null) return null;
  return model.imageOutputPrice * TOKENS_PER_IMAGE;
}

export async function loadEnabledModels(kind: ModelKind): Promise<EnabledModel[]> {
  const { data, error } = await estudioDb
    .from("estudio_enabled_models")
    .select("*")
    .eq("kind", kind)
    .eq("is_enabled", true)
    .order("label");
  if (error) return [];
  return (data ?? []) as EnabledModel[];
}

export function modelLabel(model: Pick<EnabledModel, "model_id" | "label">): string {
  return model.label?.trim() || model.model_id;
}
