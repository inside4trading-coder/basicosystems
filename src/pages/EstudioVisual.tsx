import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { estudioDb } from "@/lib/estudioDb";
import { readEdgeFunctionError, describeEstudioLoadError } from "@/lib/estudioErrors";
import { loadEnabledModels, modelLabel, type EnabledModel } from "@/lib/estudioModels";
import { MotionPanel, type MotionSettings } from "@/components/estudio/MotionPanel";
import {
  DropdownWithManageDialog,
  ManageDialogButton,
  type DropdownOption,
} from "@/components/estudio/DropdownWithManageDialog";
import { EstudioLoadError } from "@/components/estudio/EstudioLoadError";
import { ImageLightbox } from "@/components/estudio/ImageLightbox";
import PromptTab from "@/components/estudio/config/PromptTab";
import ModelsTab from "@/components/estudio/config/ModelsTab";
import MotionTab from "@/components/estudio/config/MotionTab";
import BrandTab from "@/components/estudio/config/BrandTab";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Loader2, Sparkles, Download, ImagePlus, AlertTriangle, X, RefreshCw, Eye } from "lucide-react";
import {
  uploadEstudioSourcePhoto,
  resolveEstudioSignedUrl,
  downloadEstudioImage,
  downloadEstudioFile,
  downloadBlob,
} from "@/lib/estudioStorage";
import {
  composeInstagramFeed,
  composeInstagramStory,
  type EstudioBrandSettings,
} from "@/lib/estudioCompositing";

type PhotoType = "fondo_blanco" | "modelo" | "mockup";
type ViewType = "frente" | "espalda" | "detalle" | "tres_cuartos";
type GenerationType = "estatica" | "motion";

const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  fondo_blanco: "Fondo blanco",
  modelo: "Con modelo",
  mockup: "Mockup lifestyle",
};

const VIEW_LABELS: Record<ViewType, string> = {
  frente: "Frente",
  espalda: "Espalda",
  detalle: "Detalle",
  tres_cuartos: "Tres cuartos",
};

/** El frente es obligatorio: es la única vista que siempre parte de una foto real. */
const OPTIONAL_VIEWS: ViewType[] = ["espalda", "detalle", "tres_cuartos"];

// Ningún modelo de imagen de OpenRouter acepta un tamaño en píxeles: la salida se pide por
// proporción (`aspect_ratio`), así que el desplegable ofrece proporciones, no medidas.
const SIZE_OPTIONS: DropdownOption[] = [
  { value: "4:5", label: "Vertical 4:5 (catálogo y post)" },
  { value: "1:1", label: "Cuadrado 1:1" },
  { value: "9:16", label: "Vertical 9:16 (story / reel)" },
];

// Los estilos guardados antes de este cambio todavía pueden traer el tamaño en píxeles.
const LEGACY_SIZE_TO_ASPECT: Record<string, string> = {
  "1080x1350": "4:5",
  "1080x1080": "1:1",
  "1080x1920": "9:16",
};

const normalizeAspect = (value: string): string =>
  LEGACY_SIZE_TO_ASPECT[value] ?? (SIZE_OPTIONS.some((o) => o.value === value) ? value : "4:5");



const GENERATION_TYPE_OPTIONS: DropdownOption[] = [
  { value: "estatica", label: "Foto estática" },
  { value: "motion", label: "Foto motion (video corto)" },
];

const MOTION_ASPECT_OPTIONS: DropdownOption[] = [
  { value: "9:16", label: "Vertical 9:16 (Reel / Story)" },
  { value: "1:1", label: "Cuadrado 1:1 (Post)" },
  { value: "4:5", label: "Vertical 4:5 (Post)" },
  { value: "16:9", label: "Horizontal 16:9" },
];

// "Automática" es el default a propósito: cada modelo acepta un juego distinto de
// resoluciones y OpenRouter no publica cuál, así que forzar una es la causa más común de
// que la generación se rechace con un 400.
const MOTION_RESOLUTION_OPTIONS: DropdownOption[] = [
  { value: "auto", label: "Automática (la que soporte el modelo)" },
  { value: "480p", label: "480p (borrador — no todos los modelos la aceptan)" },
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p (mejor calidad)" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "En cola",
  processing: "Generando…",
  in_progress: "Generando…",
  completed: "Lista",
  failed: "Falló",
};

/** Cada cuánto se reconsulta un video que sigue generándose. */
const VIDEO_POLL_MS = 8000;

interface PromptPreset {
  id: string;
  name: string;
  photo_type: PhotoType;
  prompt_text: string;
  image_model: string;
  output_size: string | null;
  is_default: boolean;
}

interface MotionPreset {
  id: string;
  name: string;
  default_duration_seconds: number;
  video_model: string;
  is_default: boolean;
}

interface ImageJob {
  id: string;
  created_at: string;
  status: string;
  photo_type: PhotoType;
  view_type: ViewType | null;
  is_inferred: boolean | null;
  uses_model_reference: boolean | null;
  generated_image_path: string | null;
  cost_usd: number | null;
  error_message: string | null;
}


interface VideoJob {
  id: string;
  created_at: string;
  status: string;
  duration_seconds: number;
  resolution: string | null;
  aspect_ratio: string | null;
  video_storage_path: string | null;
  cost_usd: number | null;
  error_message: string | null;
}

interface ViewInput {
  include: boolean;
  file: File | null;
  previewUrl: string | null;
}

interface ViewResult {
  viewType: ViewType;
  isInferred: boolean;
  /** La imagen combinó la prenda con la foto de una persona real. */
  usesModelReference?: boolean;
  generatedPath?: string;
  generatedUrl?: string;
  feedBlob?: Blob | null;
  storyBlob?: Blob | null;
  costUsd?: number | null;
  errorMessage?: string;
}


const emptyViewInput = (): ViewInput => ({ include: false, file: null, previewUrl: null });

/**
 * Previsualiza un Blob gestionando el ciclo de vida del object URL.
 * Llamar a `URL.createObjectURL` dentro del JSX crea un blob nuevo en cada re-render
 * y ninguno se libera.
 */
function BlobPreview({ blob, alt, className }: { blob: Blob; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  return url ? <img src={url} alt={alt} className={className} /> : null;
}

/** Selector de foto (una vista de la prenda, o la persona que va a lucirla). */
function ViewPhotoPicker({
  altLabel,
  input,
  onFile,
  onClear,
}: {
  altLabel: string;
  input: ViewInput;
  onFile: (file: File) => void;
  onClear: () => void;
}) {

  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-3">
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}>
        <ImagePlus className="mr-2 h-4 w-4" />
        {input.file ? "Cambiar foto" : "Subir foto"}
      </Button>
      {input.previewUrl && (
        <div className="relative">
          <img
            src={input.previewUrl}
            alt={`Foto ${altLabel}`}
            className="h-16 w-16 object-cover rounded-lg border"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute -right-2 -top-2 h-5 w-5"
            aria-label="Quitar foto"
            onClick={onClear}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function EstudioVisual() {
  // Estilo de fotografía = una fila de estudio_prompt_presets (tipo + nombre).
  const [presets, setPresets] = useState<PromptPreset[]>([]);
  const [presetId, setPresetId] = useState<string>("");
  const [promptText, setPromptText] = useState("");
  const [outputSize, setOutputSize] = useState<string>(SIZE_OPTIONS[0].value);

  const [imageModels, setImageModels] = useState<EnabledModel[]>([]);
  const [imageModel, setImageModel] = useState<string>("");

  const [generationType, setGenerationType] = useState<GenerationType>("estatica");
  const [motionPresets, setMotionPresets] = useState<MotionPreset[]>([]);
  const [motionPresetId, setMotionPresetId] = useState<string>("");
  const [videoModels, setVideoModels] = useState<EnabledModel[]>([]);
  const [videoModel, setVideoModel] = useState<string>("");
  const [motionDuration, setMotionDuration] = useState<number>(5);
  const [motionAspect, setMotionAspect] = useState<string>("9:16");
  const [motionResolution, setMotionResolution] = useState<string>("auto");

  const [views, setViews] = useState<Record<ViewType, ViewInput>>({
    frente: { include: true, file: null, previewUrl: null },
    espalda: emptyViewInput(),
    detalle: emptyViewInput(),
    tres_cuartos: emptyViewInput(),
  });

  // Foto de la persona que debe lucir la prenda. Es opcional: sin ella el módulo funciona
  // igual que antes.
  const [modelPhoto, setModelPhoto] = useState<ViewInput>(emptyViewInput());



  const [brand, setBrand] = useState<EstudioBrandSettings | null>(null);
  // Vive aparte de `brand` porque no es un ajuste de composición: decide si la variante
  // de Story llega a generarse. Default `false`, igual que la columna en base.
  const [generateStory, setGenerateStory] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<ViewResult[]>([]);
  const [history, setHistory] = useState<ImageJob[]>([]);
  const [videos, setVideos] = useState<VideoJob[]>([]);
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [presetsError, setPresetsError] = useState<string | null>(null);

  const selectedPreset = presets.find((p) => p.id === presetId) ?? null;

  const loadPresets = async () => {
    const { data, error } = await estudioDb
      .from("estudio_prompt_presets")
      .select("*")
      .order("photo_type")
      .order("name");
    // Sin esto la pantalla queda con el prompt vacío y sin explicación — que es exactamente
    // lo que pasa si la migración del módulo todavía no se aplicó a la base.
    if (error) {
      setPresetsError(describeEstudioLoadError(error, "No se pudieron cargar los estilos de fotografía."));
      return;
    }
    setPresetsError(null);
    const list = (data ?? []) as PromptPreset[];
    setPresets(list);
    setPresetId((current) => {
      if (current && list.some((p) => p.id === current)) return current;
      return (list.find((p) => p.is_default) ?? list[0])?.id ?? "";
    });
  };

  const loadModels = async () => {
    const [images, videos] = await Promise.all([
      loadEnabledModels("image"),
      loadEnabledModels("video"),
    ]);
    setImageModels(images);
    setVideoModels(videos);
    setImageModel((current) => (current && images.some((m) => m.model_id === current) ? current : ""));
    setVideoModel((current) =>
      current && videos.some((m) => m.model_id === current) ? current : videos[0]?.model_id ?? "",
    );
  };

  const loadMotionPresets = async () => {
    const { data } = await estudioDb
      .from("estudio_motion_presets")
      .select("id, name, default_duration_seconds, video_model, is_default")
      .order("created_at");
    const list = (data ?? []) as MotionPreset[];
    setMotionPresets(list);

    // Si el preset elegido sigue existiendo se respeta; si no, se adopta el default.
    const keep = motionPresetId && list.some((p) => p.id === motionPresetId);
    if (keep) return;

    const preferred = list.find((p) => p.is_default) ?? list[0];
    setMotionPresetId(preferred?.id ?? "");
    if (preferred) {
      setMotionDuration(preferred.default_duration_seconds);
      setVideoModel((m) => m || preferred.video_model);
    }
  };

  const loadBrand = async () => {
    const { data } = await estudioDb.from("estudio_brand_template").select("*").maybeSingle();
    if (!data) return;
    let logoUrl: string | null = null;
    if (data.logo_storage_path) {
      logoUrl = await resolveEstudioSignedUrl(data.logo_storage_path);
    }
    setBrand({
      logoUrl,
      primaryColor: data.primary_color,
      secondaryColor: data.secondary_color,
      logoPosition: data.logo_position,
    });
    setGenerateStory(Boolean(data.generate_story_variant));
  };

  const loadHistory = async () => {
    const { data } = await estudioDb
      .from("estudio_image_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(12);
    setHistory((data ?? []) as ImageJob[]);
  };

  const loadVideos = useCallback(async () => {
    const { data } = await estudioDb
      .from("estudio_video_jobs")
      .select("id, created_at, status, duration_seconds, resolution, aspect_ratio, video_storage_path, cost_usd, error_message")
      .order("created_at", { ascending: false })
      .limit(12);
    const list = (data ?? []) as VideoJob[];
    setVideos(list);

    const ready = list.filter((v) => v.status === "completed" && v.video_storage_path);
    const urls = await Promise.all(
      ready.map(async (v) => [v.id, await resolveEstudioSignedUrl(v.video_storage_path!)] as const),
    );
    setVideoUrls(Object.fromEntries(urls));
  }, []);

  /**
   * Recupera los videos que quedaron a medias porque se cerró la pestaña durante la
   * generación: la función consulta OpenRouter y baja al bucket los que ya terminaron.
   */
  const reconcileVideos = useCallback(async () => {
    await supabase.functions.invoke("estudio-video-status", { body: {} }).catch(() => {});
    await loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    loadPresets();
    loadModels();
    loadMotionPresets();
    loadBrand();
    loadHistory();
    reconcileVideos();
    // Carga inicial: las mismas funciones se vuelven a llamar al cerrar cada diálogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mientras haya un video generándose se sigue consultando, también si la generación
  // empezó en otra sesión del navegador.
  const hasRunningVideos = videos.some((v) => v.status === "pending" || v.status === "in_progress");
  useEffect(() => {
    if (!hasRunningVideos) return;
    const id = window.setInterval(reconcileVideos, VIDEO_POLL_MS);
    return () => window.clearInterval(id);
  }, [hasRunningVideos, reconcileVideos]);

  // Al cambiar de estilo se adoptan su prompt, su modelo y su dimensión como punto de partida.
  useEffect(() => {
    if (!selectedPreset) return;
    setPromptText(selectedPreset.prompt_text);
    if (selectedPreset.image_model) setImageModel(selectedPreset.image_model);
    if (selectedPreset.output_size) setOutputSize(normalizeAspect(selectedPreset.output_size));
  }, [selectedPreset?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Libera las previsualizaciones al desmontar.
  useEffect(() => {
    return () => {
      Object.values(views).forEach((v) => v.previewUrl && URL.revokeObjectURL(v.previewUrl));
      if (modelPhoto.previewUrl) URL.revokeObjectURL(modelPhoto.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setViewFile = (view: ViewType, file: File | null) => {
    setViews((prev) => {
      const current = prev[view];
      if (current.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return {
        ...prev,
        [view]: {
          include: view === "frente" ? true : file ? true : current.include,
          file,
          previewUrl: file ? URL.createObjectURL(file) : null,
        },
      };
    });
    setResults([]);
  };

  const setModelPhotoFile = (file: File | null) => {
    setModelPhoto((prev) => {
      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return {
        include: Boolean(file),
        file,
        previewUrl: file ? URL.createObjectURL(file) : null,
      };
    });
    setResults([]);
  };


  const toggleView = (view: ViewType, include: boolean) => {
    setViews((prev) => ({ ...prev, [view]: { ...prev[view], include } }));
  };

  const motionSettings: MotionSettings | undefined = useMemo(() => {
    if (generationType !== "motion") return undefined;
    return {
      presetId: motionPresetId,
      presetName: motionPresets.find((p) => p.id === motionPresetId)?.name ?? "Movimiento",
      videoModel,
      duration: motionDuration,
      aspectRatio: motionAspect,
      resolution: motionResolution,
    };
  }, [
    generationType,
    motionPresetId,
    motionPresets,
    videoModel,
    motionDuration,
    motionAspect,
    motionResolution,
  ]);

  const handleGenerate = async () => {
    const frontFile = views.frente.file;
    if (!frontFile) {
      toast.error("Sube la foto frontal de la prenda.");
      return;
    }
    if (!selectedPreset) {
      toast.error("Elige un estilo de fotografía.");
      return;
    }

    setGenerating(true);
    setResults([]);
    try {
      const frontPath = await uploadEstudioSourcePhoto(frontFile);
      const modelPath = modelPhoto.file ? await uploadEstudioSourcePhoto(modelPhoto.file) : null;

      // Una vista sin foto propia se deduce del frente: se marca como inferida para que
      // nunca se confunda con una foto real de esa vista.
      const requests: { viewType: ViewType; sourcePath: string; isInferred: boolean }[] = [
        { viewType: "frente", sourcePath: frontPath, isInferred: false },
      ];
      for (const view of OPTIONAL_VIEWS) {
        const input = views[view];
        if (!input.include) continue;
        const sourcePath = input.file ? await uploadEstudioSourcePhoto(input.file) : frontPath;
        requests.push({ viewType: view, sourcePath, isInferred: !input.file });
      }

      const sessionId = crypto.randomUUID();
      const promptOverride = promptText !== selectedPreset.prompt_text ? promptText : undefined;

      const generated = await Promise.all(
        requests.map(async (item): Promise<ViewResult> => {
          try {
            const { data, error } = await supabase.functions.invoke("estudio-generate-image", {
              body: {
                sourcePhotoPath: item.sourcePath,
                modelPhotoPath: modelPath ?? undefined,
                photoType: selectedPreset.photo_type,
                promptPresetId: selectedPreset.id,
                promptOverride,
                imageModel: imageModel || undefined,
                outputSize,
                sessionId,
                viewType: item.viewType,
                isInferred: item.isInferred,
              },
            });


            // supabase-js convierte cualquier respuesta no-2xx en un FunctionsHttpError
            // genérico y descarta el cuerpo, así que el motivo real ("saldo insuficiente",
            // "límite alcanzado") se pierde si no se lee la respuesta original.
            if (error) throw new Error(await readEdgeFunctionError(error));
            if (data?.error) throw new Error(data.error);

            return {
              viewType: item.viewType,
              isInferred: item.isInferred,
              usesModelReference: Boolean(data.usesModelReference ?? modelPath),
              generatedPath: data.generatedImagePath,
              generatedUrl: await resolveEstudioSignedUrl(data.generatedImagePath),
              costUsd: data.costUsd ?? null,
              feedBlob: null,
              storyBlob: null,
            };

          } catch (e) {
            return {
              viewType: item.viewType,
              isInferred: item.isInferred,
              errorMessage: e instanceof Error ? e.message : "La generación falló.",
            };
          }
        }),
      );

      setResults(generated);
      loadHistory();

      const okCount = generated.filter((r) => r.generatedPath).length;
      if (okCount === 0) {
        toast.error(generated[0]?.errorMessage ?? "Ninguna vista se pudo generar.");
      } else if (okCount < generated.length) {
        toast.warning(`Se generaron ${okCount} de ${generated.length} vistas.`);
      } else {
        toast.success(okCount === 1 ? "Imagen generada correctamente." : `${okCount} vistas generadas.`);
      }

      // Las imágenes ya están generadas y pagadas: se muestran aunque falle el compositing.
      if (brand && okCount > 0) {
        let composingFailed = false;
        const composed = await Promise.all(
          generated.map(async (r) => {
            if (!r.generatedUrl) return r;
            try {
              return {
                ...r,
                feedBlob: await composeInstagramFeed(r.generatedUrl, brand),
                storyBlob: generateStory ? await composeInstagramStory(r.generatedUrl, brand) : null,
              };
            } catch {
              composingFailed = true;
              return r;
            }
          }),
        );
        setResults(composed);
        if (composingFailed) {
          toast.warning("Las fotos se generaron, pero alguna variante de Instagram no se pudo componer.");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar la imagen.");
    } finally {
      setGenerating(false);
    }
  };

  const styleOptions: DropdownOption[] = presets.map((p) => ({
    value: p.id,
    label: `${PHOTO_TYPE_LABELS[p.photo_type]} — ${p.name}`,
  }));

  const inferredCount = OPTIONAL_VIEWS.filter((v) => views[v].include && !views[v].file).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Estudio Visual</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Genera la foto de estudio con IA y sus variantes para Instagram a partir de una foto de la prenda.
        </p>
      </div>

      {presetsError && (
        <EstudioLoadError
          message={presetsError}
          hint="Hasta entonces la generación no va a funcionar, aunque el formulario se vea completo."
          onRetry={loadPresets}
        />
      )}

      <Card className="p-6 rounded-2xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <DropdownWithManageDialog
            label="Estilo de fotografía"
            value={presetId}
            onValueChange={setPresetId}
            options={styleOptions}
            placeholder="Elige un estilo"
            emptyMessage="No hay estilos guardados todavía."
            manage={{
              title: "Estilos de fotografía",
              description: "Prompt y modelo por defecto de cada estilo.",
              onClose: loadPresets,
              children: <PromptTab />,
            }}
          />

          <DropdownWithManageDialog
            label="Dimensiones"
            value={outputSize}
            onValueChange={setOutputSize}
            options={SIZE_OPTIONS}
            hint="Se le exige al modelo este tamaño exacto de salida."
          />

          <DropdownWithManageDialog
            label="Modelo de generación"
            value={imageModel}
            onValueChange={setImageModel}
            options={imageModels.map((m) => ({ value: m.model_id, label: modelLabel(m) }))}
            placeholder="Elige un modelo"
            emptyMessage="No hay modelos habilitados."
            manage={{
              title: "Modelos habilitados",
              description: "Controla qué modelos de imagen y de video se pueden elegir.",
              onClose: loadModels,
              children: <ModelsTab />,
            }}
          />

          <DropdownWithManageDialog
            label="Tipo de generación"
            value={generationType}
            onValueChange={(v) => setGenerationType(v as GenerationType)}
            options={GENERATION_TYPE_OPTIONS}
            hint={
              generationType === "motion"
                ? "El video se genera después, con la foto ya lista."
                : undefined
            }
            manage={
              generationType === "motion"
                ? {
                    title: "Tipos de movimiento",
                    description: "Cómo debe moverse la prenda en el video.",
                    onClose: loadMotionPresets,
                    children: <MotionTab />,
                  }
                : undefined
            }
          />
        </div>

        {generationType === "motion" && (
          <div className="rounded-xl border p-4 space-y-5">
            <p className="text-sm text-muted-foreground">
              Configuración del video. Primero se genera la foto; el video se lanza después con un
              botón de confirmación, ya con esta configuración.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <Label className="mb-2 block">Tipo de movimiento</Label>
                <Select
                  value={motionPresetId}
                  onValueChange={(id) => {
                    setMotionPresetId(id);
                    const p = motionPresets.find((x) => x.id === id);
                    if (p) {
                      setMotionDuration(p.default_duration_seconds);
                      setVideoModel(p.video_model);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elige un movimiento" />
                  </SelectTrigger>
                  <SelectContent>
                    {motionPresets.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-2 block">Modelo de video</Label>
                {videoModels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay modelos de video habilitados.
                  </p>
                ) : (
                  <Select value={videoModel} onValueChange={setVideoModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Elige un modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {videoModels.map((m) => (
                        <SelectItem key={m.model_id} value={m.model_id}>
                          {modelLabel(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Duración</Label>
                <span className="text-sm font-medium tabular-nums">{motionDuration} s</span>
              </div>
              <Slider
                min={1}
                max={12}
                step={1}
                value={[motionDuration]}
                onValueChange={([v]) => setMotionDuration(v)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                No todos los modelos aceptan cualquier duración; si la rechaza, se avisa con el
                motivo exacto.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <Label className="mb-2 block">Formato del video</Label>
                <Select value={motionAspect} onValueChange={setMotionAspect}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTION_ASPECT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Resolución</Label>
                <Select value={motionResolution} onValueChange={setMotionResolution}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTION_RESOLUTION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label className="block">Vistas de la prenda</Label>
            <p className="text-xs text-muted-foreground mt-1">
              El frente es obligatorio. Para las demás vistas puedes subir su propia foto o dejar
              que la IA la deduzca del frente.
            </p>
          </div>

          <div className="rounded-xl border divide-y">
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{VIEW_LABELS.frente}</span>
                <span className="text-xs text-muted-foreground">(obligatoria)</span>
              </div>
              <ViewPhotoPicker
                altLabel={VIEW_LABELS.frente}
                input={views.frente}
                onFile={(f) => setViewFile("frente", f)}
                onClear={() => setViewFile("frente", null)}
              />
            </div>

            {OPTIONAL_VIEWS.map((view) => {
              const input = views[view];
              return (
                <div key={view} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={`view-${view}`} className="font-medium text-sm">
                      {VIEW_LABELS[view]}
                    </Label>
                    <Switch
                      id={`view-${view}`}
                      checked={input.include}
                      onCheckedChange={(v) => toggleView(view, v)}
                    />
                  </div>
                  {input.include && (
                    <>
                      <ViewPhotoPicker
                        altLabel={VIEW_LABELS[view]}
                        input={input}
                        onFile={(f) => setViewFile(view, f)}
                        onClear={() => setViewFile(view, null)}
                      />
                      {!input.file && (
                        <p className="text-xs text-amber-600 dark:text-amber-500 flex items-start gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          Sin foto propia, la IA deduce esta vista desde el frente. Puede no
                          coincidir con la prenda real.
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border p-4">
          <div>
            <Label className="block">Modelo (persona que lleva la prenda)</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Opcional. Si subes la foto de una persona, la IA la usa como referencia junto con la
              prenda para generar la pieza de campaña.
            </p>
          </div>
          <ViewPhotoPicker
            altLabel="del modelo"
            input={modelPhoto}
            onFile={(f) => setModelPhotoFile(f)}
            onClear={() => setModelPhotoFile(null)}
          />
          {modelPhoto.file && (
            <p className="text-xs text-amber-600 dark:text-amber-500 flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              El resultado es una persona sintetizada a partir de esa foto, no una fotografía real:
              se marca así en la tarjeta y en el historial. Usa solo fotos con permiso de la persona.
            </p>
          )}
        </div>



        <div>
          <Label htmlFor="prompt" className="mb-2 block">
            Prompt para esta generación
          </Label>
          <Textarea id="prompt" rows={5} value={promptText} onChange={(e) => setPromptText(e.target.value)} />
          <p className="text-xs text-muted-foreground mt-1">
            Este cambio aplica solo a esta generación. Para guardarlo como default, edítalo con el
            lápiz de "Estilo de fotografía".
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleGenerate} disabled={generating || !views.frente.file}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {generating ? "Generando…" : "Generar"}
          </Button>
          <ManageDialogButton
            buttonLabel="Plantilla de Instagram"
            manage={{
              title: "Plantilla de Instagram",
              description: "Logo, colores y posición aplicados a las variantes de Instagram.",
              onClose: loadBrand,
              children: <BrandTab />,
            }}
          />
          {inferredCount > 0 && (
            <span className="text-xs text-amber-600 dark:text-amber-500">
              {inferredCount} {inferredCount === 1 ? "vista inferida" : "vistas inferidas"} por IA
            </span>
          )}
        </div>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Resultado de la sesión</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((r) => (
              <Card key={r.viewType} className="p-6 rounded-2xl space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="font-medium">{VIEW_LABELS[r.viewType]}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.usesModelReference && (
                      <span className="text-xs rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 px-2 py-0.5">
                        Modelo sintetizado
                      </span>
                    )}
                    {r.isInferred ? (
                      <span className="text-xs rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5">
                        Inferido por IA
                      </span>
                    ) : (
                      <span className="text-xs rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                        Desde foto real
                      </span>
                    )}
                  </div>
                </div>

                {r.errorMessage ? (
                  <p className="text-sm text-destructive">{r.errorMessage}</p>
                ) : (
                  <>
                    {r.usesModelReference && (
                      <p className="text-xs text-sky-700 dark:text-sky-400">
                        Modelo sintetizado a partir de una foto de referencia.
                      </p>
                    )}
                    {r.isInferred && (
                      <p className="text-xs text-amber-600 dark:text-amber-500 flex items-start gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        Esta vista no se fotografió: la IA la dedujo del frente y puede no coincidir
                        con la prenda real. Revísala antes de publicarla.
                      </p>
                    )}

                    {r.generatedUrl && (
                      <img
                        src={r.generatedUrl}
                        alt={`Foto generada — ${VIEW_LABELS[r.viewType]}`}
                        className="w-full rounded-lg border"
                      />
                    )}
                    {r.costUsd != null && (
                      <p className="text-xs text-muted-foreground">
                        Costo: ${r.costUsd.toFixed(4)} USD
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          r.generatedPath && downloadEstudioImage(r.generatedPath, `estudio-${r.viewType}.png`)
                        }
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Foto
                      </Button>
                      {r.feedBlob && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadBlob(r.feedBlob!, `instagram-feed-${r.viewType}.png`)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Post IG
                        </Button>
                      )}
                      {r.storyBlob && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadBlob(r.storyBlob!, `instagram-story-${r.viewType}.png`)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Story IG
                        </Button>
                      )}
                      {r.feedBlob && (
                        <BlobPreview
                          blob={r.feedBlob}
                          alt="Variante de Instagram"
                          className="h-12 w-12 object-cover rounded border"
                        />
                      )}
                    </div>

                    {generationType === "motion" && r.generatedPath && (
                      <MotionPanel
                        sourceImagePath={r.generatedPath}
                        settings={motionSettings}
                        onJobChange={loadVideos}
                      />
                    )}
                  </>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card className="p-6 rounded-2xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Videos recientes</h2>
          <Button variant="ghost" size="sm" onClick={reconcileVideos}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>
        {videos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay videos.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {videos.map((v) => (
              <div key={v.id} className="border rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{v.duration_seconds} s</span>
                  <span
                    className={
                      v.status === "completed"
                        ? "text-emerald-600"
                        : v.status === "failed"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }
                  >
                    {STATUS_LABELS[v.status] ?? v.status}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">
                  {new Date(v.created_at).toLocaleString("es-VE")}
                  {v.aspect_ratio && ` · ${v.aspect_ratio}`}
                  {v.resolution && ` · ${v.resolution}`}
                  {v.cost_usd != null && ` · $${v.cost_usd.toFixed(4)}`}
                </p>

                {videoUrls[v.id] && (
                  <video src={videoUrls[v.id]} controls loop className="w-full rounded-lg border" />
                )}

                {v.status === "completed" && v.video_storage_path && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadEstudioFile(
                        v.video_storage_path!,
                        `estudio-motion-${v.id.slice(0, 8)}-${v.duration_seconds}s.mp4`,
                      )
                    }
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Descargar
                  </Button>
                )}

                {v.status === "failed" && v.error_message && (
                  <p className="text-xs text-destructive">{v.error_message}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6 rounded-2xl">
        <h2 className="text-lg font-semibold mb-4">Generaciones recientes</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay generaciones.</p>
        ) : (
          <div className="space-y-2">
            {history.map((job) => (
              <div key={job.id} className="border-b py-2 last:border-0 space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{PHOTO_TYPE_LABELS[job.photo_type]}</span>
                    {job.view_type && (
                      <span className="text-xs rounded-full bg-muted text-muted-foreground px-2 py-0.5 shrink-0">
                        {VIEW_LABELS[job.view_type]}
                      </span>
                    )}
                    {job.is_inferred && (
                      <span className="text-xs rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 shrink-0">
                        Inferido
                      </span>
                    )}
                    {job.uses_model_reference && (
                      <span
                        className="text-xs rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 px-2 py-0.5 shrink-0"
                        title="Modelo sintetizado a partir de una foto de referencia"
                      >
                        Modelo sintetizado
                      </span>
                    )}
                  </div>

                  <span className="text-muted-foreground shrink-0">
                    {new Date(job.created_at).toLocaleString("es-VE")}
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    {job.cost_usd != null && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        ${job.cost_usd.toFixed(4)}
                      </span>
                    )}
                    <span
                      className={
                        job.status === "completed"
                          ? "text-emerald-600"
                          : job.status === "failed"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }
                    >
                      {STATUS_LABELS[job.status] ?? job.status}
                    </span>
                    {job.status === "completed" && job.generated_image_path && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          downloadEstudioImage(job.generated_image_path!, `estudio-${job.id.slice(0, 8)}.png`)
                        }
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {job.status === "failed" && job.error_message && (
                  <p className="text-xs text-destructive">{job.error_message}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
