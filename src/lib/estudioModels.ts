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

export type ModelTier = "Económico" | "Borrador" | "Balance" | "Calidad final";

export interface ModelPresentation {
  model_id: string;
  name: string;
  tier: ModelTier;
  description: string;
}

/**
 * Presentación amigable de los modelos de imagen para el selector del paso "Generar".
 * Solo es texto: el `model_id` que se envía sigue siendo el mismo de siempre.
 */
export const IMAGE_MODEL_PRESENTATION: ModelPresentation[] = [
  {
    model_id: "bytedance-seed/seedream-5.0-lite",
    name: "ByteDance Seed: Seedream 5.0 Lite",
    tier: "Borrador",
    description: "Rápido y económico para pruebas de composición.",
  },
  {
    model_id: "bytedance-seed/seedream-4.5",
    name: "ByteDance Seed: Seedream 4.5",
    tier: "Balance",
    description: "Buen equilibrio entre fidelidad y velocidad.",
  },
  {
    model_id: "bytedance-seed/seedream-5.0-pro",
    name: "ByteDance Seed: Seedream 5.0 Pro",
    tier: "Calidad final",
    description: "Mejor fidelidad para campaña y producto.",
  },
];

/** Modelos curados del hub: siempre disponibles en el modal aunque OpenRouter no los liste. */
export const CURATED_IMAGE_MODEL_IDS = IMAGE_MODEL_PRESENTATION.map((m) => m.model_id);


/** Combina el catálogo de presentación con los modelos realmente habilitados. */
export function imageModelOptions(enabled: EnabledModel[]) {
  const known = new Set(IMAGE_MODEL_PRESENTATION.map((m) => m.model_id));
  const extras: ModelPresentation[] = enabled
    .filter((m) => !known.has(m.model_id))
    .map((m) => ({
      model_id: m.model_id,
      name: modelLabel(m),
      tier: "Balance" as ModelTier,
      description: "Modelo habilitado desde configuración.",
    }));
  return [...IMAGE_MODEL_PRESENTATION, ...extras].map((p) => ({
    ...p,
    available: enabled.some((m) => m.model_id === p.model_id),
  }));
}

export function describeImageModel(modelId: string): ModelPresentation | null {
  return IMAGE_MODEL_PRESENTATION.find((m) => m.model_id === modelId) ?? null;
}

