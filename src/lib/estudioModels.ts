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
    model_id: "google/gemini-2.5-flash-image",
    name: "Gemini 2.5 Flash Image",
    tier: "Económico",
    description: "Rápido para pruebas y borradores.",
  },
  {
    model_id: "google/gemini-3-pro-image",
    name: "Gemini 3 Pro Image",
    tier: "Calidad final",
    description: "Mejor fidelidad para campaña y producto.",
  },
  {
    model_id: "google/gemini-3.1-flash-image",
    name: "Nano Banana 2 · Gemini 3.1 Flash Image",
    tier: "Balance",
    description: "Buen equilibrio entre fidelidad y velocidad.",
  },
  {
    model_id: "openai/gpt-5-image",
    name: "GPT-5 Image",
    tier: "Calidad final",
    description: "Alta fidelidad para producto y detalle.",
  },
  {
    model_id: "openai/gpt-5-image-mini",
    name: "GPT-5 Image Mini",
    tier: "Borrador",
    description: "Pruebas rápidas de composición.",
  },
];

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

