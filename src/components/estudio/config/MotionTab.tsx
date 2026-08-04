import { useEffect, useState } from "react";
import { toast } from "sonner";
import { estudioDb } from "@/lib/estudioDb";
import { loadEnabledModels, modelLabel, type EnabledModel } from "@/lib/estudioModels";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { EstudioLoadError } from "@/components/estudio/EstudioLoadError";
import { describeEstudioLoadError } from "@/lib/estudioErrors";

interface MotionPreset {
  id: string;
  name: string;
  prompt_text: string;
  default_duration_seconds: number;
  video_model: string;
  is_default: boolean;
}

export default function MotionTab() {
  const [presets, setPresets] = useState<MotionPreset[]>([]);
  const [models, setModels] = useState<EnabledModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, videoModels] = await Promise.all([
      estudioDb.from("estudio_motion_presets").select("*").order("created_at"),
      loadEnabledModels("video"),
    ]);
    if (error) {
      setLoadError(describeEstudioLoadError(error, "No se pudieron cargar los presets de movimiento."));
      setLoading(false);
      return;
    }
    setLoadError(null);
    setPresets((data ?? []) as MotionPreset[]);
    setModels(videoModels);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const update = (id: string, patch: Partial<MotionPreset>) =>
    setPresets((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const save = async (preset: MotionPreset) => {
    setSavingId(preset.id);
    const { error } = await estudioDb
      .from("estudio_motion_presets")
      .update({
        prompt_text: preset.prompt_text,
        default_duration_seconds: preset.default_duration_seconds,
        video_model: preset.video_model,
        updated_at: new Date().toISOString(),
      })
      .eq("id", preset.id);
    setSavingId(null);
    if (error) {
      toast.error("No se pudo guardar el preset.");
      return;
    }
    toast.success("Preset de movimiento guardado.");
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  if (loadError) return <EstudioLoadError message={loadError} onRetry={load} />;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Cada preset describe cómo debe moverse la prenda. La duración es el valor por defecto:
        se puede ajustar en cada generación.
      </p>

      {models.length === 0 && (
        <Card className="p-4 rounded-2xl border-destructive/40 bg-destructive/5">
          <p className="text-sm text-destructive">
            No hay modelos de video habilitados. Habilita al menos uno con el lápiz de "Modelo de
            generación".
          </p>
        </Card>
      )}

      {presets.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin presets de movimiento todavía.</p>
      )}

      {presets.map((preset) => (
        <Card key={preset.id} className="p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <Label className="font-semibold">
              {preset.name}
              {preset.is_default && <span className="ml-2 text-xs text-muted-foreground">(default)</span>}
            </Label>
          </div>

          <Textarea
            rows={3}
            value={preset.prompt_text}
            onChange={(e) => update(preset.id, { prompt_text: e.target.value })}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor={`dur-${preset.id}`}>Duración por defecto (segundos)</Label>
              <Input
                id={`dur-${preset.id}`}
                type="number"
                min={1}
                max={20}
                value={preset.default_duration_seconds}
                onChange={(e) =>
                  update(preset.id, { default_duration_seconds: Number(e.target.value) || 1 })
                }
              />
            </div>

            <div>
              <Label>Modelo de video</Label>
              <Select
                value={preset.video_model}
                onValueChange={(v) => update(preset.id, { video_model: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Elige un modelo" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.model_id} value={m.model_id}>
                      {modelLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => save(preset)} disabled={savingId === preset.id}>
              {savingId === preset.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Guardar
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
