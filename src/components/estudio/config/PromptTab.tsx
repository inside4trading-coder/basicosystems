import { useEffect, useState } from "react";
import { toast } from "sonner";
import { estudioDb } from "@/lib/estudioDb";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { EstudioLoadError } from "@/components/estudio/EstudioLoadError";
import { describeEstudioLoadError } from "@/lib/estudioErrors";

type PhotoType = "fondo_blanco" | "modelo" | "mockup";

const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  fondo_blanco: "Fondo blanco",
  modelo: "Con modelo",
  mockup: "Mockup lifestyle",
};

// IDs verificados contra GET https://openrouter.ai/api/v1/models.
// Ojo: "openai/gpt-image-1" y "openai/gpt-image-2" NO existen en OpenRouter — si se usan,
// toda generación falla. Esta lista se reemplazará por el catálogo dinámico curado (Mejora B).
const MODEL_OPTIONS = [
  { value: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image (económico, ~$0.04/imagen)" },
  { value: "google/gemini-3.1-flash-image", label: "Gemini 3.1 Flash Image" },
  { value: "google/gemini-3-pro-image", label: "Gemini 3 Pro Image (mayor calidad)" },
  { value: "openai/gpt-5-image-mini", label: "GPT-5 Image Mini (borradores)" },
  { value: "openai/gpt-5-image", label: "GPT-5 Image" },
  { value: "openai/gpt-5.4-image-2", label: "GPT-5.4 Image 2 (mejor calidad, más costoso)" },
];

interface Preset {
  id: string;
  name: string;
  photo_type: PhotoType;
  prompt_text: string;
  image_model: string;
  is_default: boolean;
}

export default function PromptTab() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await estudioDb
        .from("estudio_prompt_presets")
        .select("*")
        .order("photo_type");
      if (error) {
        setLoadError(describeEstudioLoadError(error, "No se pudieron cargar los presets de prompt."));
        return;
      }
      setPresets((data ?? []) as Preset[]);
    } finally {
      // En `finally` para que la pestaña nunca se quede colgada en "Cargando…".
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const update = (id: string, patch: Partial<Preset>) => {
    setPresets((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const save = async (preset: Preset) => {
    setSavingId(preset.id);
    const { error } = await estudioDb
      .from("estudio_prompt_presets")
      .update({
        prompt_text: preset.prompt_text,
        image_model: preset.image_model,
        updated_at: new Date().toISOString(),
      })
      .eq("id", preset.id);
    setSavingId(null);
    if (error) {
      toast.error("No se pudo guardar el cambio.");
      return;
    }
    toast.success("Prompt guardado.");
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  if (loadError) return <EstudioLoadError message={loadError} onRetry={load} />;

  const byType = (Object.keys(PHOTO_TYPE_LABELS) as PhotoType[]).map((type) => ({
    type,
    items: presets.filter((p) => p.photo_type === type),
  }));

  return (
    <div className="space-y-6">
      {byType.map(({ type, items }) => (
        <Card key={type} className="p-6 rounded-2xl space-y-4">
          <h3 className="font-semibold">{PHOTO_TYPE_LABELS[type]}</h3>
          {items.length === 0 && <p className="text-sm text-muted-foreground">Sin presets todavía.</p>}
          {items.map((preset) => (
            <div key={preset.id} className="space-y-3 border-t pt-4 first:border-0 first:pt-0">
              <div className="flex items-center justify-between">
                <Label className="font-medium">
                  {preset.name} {preset.is_default && <span className="text-xs text-muted-foreground">(default)</span>}
                </Label>
              </div>
              <Textarea
                rows={4}
                value={preset.prompt_text}
                onChange={(e) => update(preset.id, { prompt_text: e.target.value })}
              />
              <div className="flex items-center gap-3">
                <Select value={preset.image_model} onValueChange={(v) => update(preset.id, { image_model: v })}>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => save(preset)} disabled={savingId === preset.id}>
                  {savingId === preset.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Guardar
                </Button>
              </div>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
