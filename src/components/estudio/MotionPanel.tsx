import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { estudioDb } from "@/lib/estudioDb";
import { readEdgeFunctionError } from "@/lib/estudioErrors";
import { loadEnabledModels, modelLabel, type EnabledModel } from "@/lib/estudioModels";
import { resolveEstudioSignedUrl, downloadEstudioFile } from "@/lib/estudioStorage";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Clapperboard, Download } from "lucide-react";

const POLL_INTERVAL_MS = 5000;

const ASPECT_OPTIONS = [
  { value: "9:16", label: "Vertical 9:16 (Reel / Story)" },
  { value: "1:1", label: "Cuadrado 1:1 (Post)" },
  { value: "4:5", label: "Vertical 4:5 (Post)" },
  { value: "16:9", label: "Horizontal 16:9" },
];

// "Automática" es el default a propósito: cada modelo acepta un juego distinto de
// resoluciones y OpenRouter no publica cuál, así que forzar una es la causa más común de
// que la generación se rechace con un 400.
const RESOLUTION_OPTIONS = [
  { value: "auto", label: "Automática (la que soporte el modelo)" },
  { value: "480p", label: "480p (borrador — no todos los modelos la aceptan)" },
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p (mejor calidad)" },
];

interface MotionPreset {
  id: string;
  name: string;
  prompt_text: string;
  default_duration_seconds: number;
  video_model: string;
  is_default: boolean;
}

interface VideoJob {
  id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  video_storage_path: string | null;
  cost_usd: number | null;
  error_message: string | null;
  duration_seconds: number;
}

/** Configuración de movimiento elegida antes de generar, en la pantalla principal. */
export interface MotionSettings {
  presetId: string;
  /** Solo para mostrarlo en el resumen, sin volver a consultar los presets. */
  presetName: string;
  videoModel: string;
  duration: number;
  aspectRatio: string;
  resolution: string;
}

export function MotionPanel({
  sourceImagePath,
  settings,
}: {
  sourceImagePath: string;
  /**
   * Cuando la pantalla ya preguntó cómo debe moverse la foto, el panel hereda esa elección
   * en vez de volver a pedirla: aquí solo queda confirmar y generar.
   */
  settings?: MotionSettings;
}) {
  const [presets, setPresets] = useState<MotionPreset[]>([]);
  const [models, setModels] = useState<EnabledModel[]>([]);
  const [presetId, setPresetId] = useState<string>(settings?.presetId ?? "");
  const [videoModel, setVideoModel] = useState<string>(settings?.videoModel ?? "");
  const [duration, setDuration] = useState<number>(settings?.duration ?? 5);
  const [aspectRatio, setAspectRatio] = useState<string>(settings?.aspectRatio ?? "9:16");
  const [resolution, setResolution] = useState<string>(settings?.resolution ?? "auto");

  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<VideoJob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    // Con la configuración ya elegida arriba no hace falta consultar nada: el panel solo
    // confirma y genera. Con varias vistas en pantalla, esto evita repetir las consultas
    // una vez por tarjeta.
    if (settings) return;

    (async () => {
      const [{ data }, videoModels] = await Promise.all([
        estudioDb.from("estudio_motion_presets").select("*").order("created_at"),
        loadEnabledModels("video"),
      ]);
      const list = (data ?? []) as MotionPreset[];
      setPresets(list);
      setModels(videoModels);

      const preferred = list.find((p) => p.is_default) ?? list[0];
      if (preferred) {
        setPresetId(preferred.id);
        setDuration(preferred.default_duration_seconds);
        setVideoModel(preferred.video_model);
      }
    })();
    // Solo al montar: el panel aparece cuando ya existe la imagen, con la elección hecha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La configuración de arriba puede cambiar después de generar la foto; se refleja aquí.
  useEffect(() => {
    if (!settings) return;
    setPresetId(settings.presetId);
    setVideoModel(settings.videoModel);
    setDuration(settings.duration);
    setAspectRatio(settings.aspectRatio);
    setResolution(settings.resolution);
  }, [settings]);

  // Al cambiar de preset se adoptan su duración y su modelo como punto de partida.
  const onPresetChange = (id: string) => {
    setPresetId(id);
    const p = presets.find((x) => x.id === id);
    if (p) {
      setDuration(p.default_duration_seconds);
      setVideoModel(p.video_model);
    }
  };

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshJob = useCallback(
    async (jobId: string) => {
      // La función consulta OpenRouter y, si terminó, baja el video al bucket.
      await supabase.functions.invoke("estudio-video-status", { body: { jobId } });

      const { data } = await estudioDb
        .from("estudio_video_jobs")
        .select("id, status, video_storage_path, cost_usd, error_message, duration_seconds")
        .eq("id", jobId)
        .maybeSingle();
      if (!data) return;

      const row = data as VideoJob;
      setJob(row);

      if (row.status === "completed" && row.video_storage_path) {
        stopPolling();
        setVideoUrl(await resolveEstudioSignedUrl(row.video_storage_path));
        toast.success("Video listo.");
      } else if (row.status === "failed") {
        stopPolling();
        toast.error(row.error_message ?? "La generación de video falló.");
      }
    },
    [stopPolling],
  );

  useEffect(() => stopPolling, [stopPolling]);

  const handleGenerate = async () => {
    if (!videoModel) {
      toast.error('Habilita al menos un modelo de video con el lápiz junto a "Modelo de generación".');
      return;
    }
    setSubmitting(true);
    setVideoUrl(null);
    setJob(null);
    try {
      const { data, error } = await supabase.functions.invoke("estudio-generate-video", {
        body: {
          sourceImagePath,
          motionPresetId: presetId || undefined,
          videoModel,
          durationSeconds: duration,
          aspectRatio,
          resolution,
        },
      });
      if (error) throw new Error(await readEdgeFunctionError(error));
      if (data?.error) throw new Error(data.error);

      const jobId = data.jobId as string;
      setJob({
        id: jobId,
        status: "in_progress",
        video_storage_path: null,
        cost_usd: null,
        error_message: null,
        duration_seconds: duration,
      });

      stopPolling();
      pollRef.current = window.setInterval(() => refreshJob(jobId), POLL_INTERVAL_MS);
      refreshJob(jobId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo iniciar la generación de video.");
    } finally {
      setSubmitting(false);
    }
  };

  const running = job?.status === "in_progress" || job?.status === "pending";

  return (
    <Card className="p-6 rounded-2xl space-y-5">
      <div className="flex items-center gap-2">
        <Clapperboard className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Dar movimiento</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Convierte esta imagen en un video corto para Reels o Stories. El video se genera a partir de la foto
        limpia, sin el logo superpuesto.
      </p>

      {!settings && models.length === 0 ? (
        <p className="text-sm text-destructive">
          No hay modelos de video habilitados. Actívalos con el lápiz junto a "Modelo de generación".
        </p>
      ) : (
        <>
          {settings ? (
            <p className="text-sm">
              <span className="text-muted-foreground">Configuración elegida: </span>
              {settings.presetName} · {duration} s · {aspectRatio} ·{" "}
              {resolution === "auto" ? "resolución automática" : resolution}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <Label className="mb-2 block">Tipo de movimiento</Label>
                  <Select value={presetId} onValueChange={onPresetChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Elige un movimiento" />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-2 block">Modelo de video</Label>
                  <Select value={videoModel} onValueChange={setVideoModel}>
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
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Duración</Label>
                  <span className="text-sm font-medium tabular-nums">{duration} s</span>
                </div>
                <Slider
                  min={1}
                  max={12}
                  step={1}
                  value={[duration]}
                  onValueChange={([v]) => setDuration(v)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  No todos los modelos aceptan cualquier duración; si la rechaza, se avisa con el motivo
                  exacto.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <Label className="mb-2 block">Formato</Label>
                  <Select value={aspectRatio} onValueChange={setAspectRatio}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASPECT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-2 block">Resolución</Label>
                  <Select value={resolution} onValueChange={setResolution}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOLUTION_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <Button onClick={handleGenerate} disabled={submitting || running}>
            {submitting || running ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Clapperboard className="mr-2 h-4 w-4" />
            )}
            {running ? "Generando video…" : "Generar video"}
          </Button>

          {running && (
            <p className="text-xs text-muted-foreground">
              La generación tarda entre 30 segundos y varios minutos. Puedes cerrar la pestaña: al volver al
              módulo, el video se recupera automáticamente.
            </p>
          )}

          {job?.status === "failed" && job.error_message && (
            <p className="text-sm text-destructive">{job.error_message}</p>
          )}

          {videoUrl && (
            <div className="space-y-2">
              <video src={videoUrl} controls loop className="w-full max-w-sm rounded-lg border" />
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    job?.video_storage_path &&
                    downloadEstudioFile(job.video_storage_path, `estudio-motion-${duration}s.mp4`)
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Descargar video
                </Button>
                {job?.cost_usd != null && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Costo: ${job.cost_usd.toFixed(4)} USD
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
