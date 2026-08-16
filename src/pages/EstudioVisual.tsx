import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { estudioDb } from "@/lib/estudioDb";
import { readEdgeFunctionError, describeEstudioLoadError } from "@/lib/estudioErrors";
import { loadEnabledModels, type EnabledModel } from "@/lib/estudioModels";
import {
  loadStudioBackgrounds,
  loadStudioBackgroundPrompts,
  resolveBackgroundPrompt,
  saveStudioBackgroundPrompts,
  type StudioBackground,
  type StudioBackgroundPrompt,
} from "@/lib/estudioBackgrounds";
import { EstudioLoadError } from "@/components/estudio/EstudioLoadError";
import { ImageLightbox } from "@/components/estudio/ImageLightbox";
import { StudioActionCards } from "@/components/estudio/StudioActionCards";
import {
  StudioWizard,
  OPTIONAL_VIEWS,
  type ViewInput,
  type ViewType,
} from "@/components/estudio/StudioWizard";
import {
  StudioResults,
  sortReadyJobs,
  type StudioJob,
  type StudioSet,
} from "@/components/estudio/StudioResults";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  STUDIO_KIND_LABELS,
  getStudioSetMeta,
  nextStudioSeq,
  saveStudioSetMeta,
  studioFileName,
  type StudioKind,
  type StudioMode,
} from "@/lib/estudioNaming";
import {
  resolveEstudioSignedUrl,
  downloadEstudioImage,
  uploadEstudioSourcePhoto,
  uploadEstudioCutout,
  uploadEstudioComposition,
} from "@/lib/estudioStorage";
import { composeCutoutOnBackground } from "@/lib/estudioCompositing";


interface PromptPreset {
  id: string;
  name: string;
  photo_type: "fondo_blanco" | "modelo" | "mockup";
  prompt_text: string;
  image_model: string;
  output_size: string | null;
  is_default: boolean;
}

const KIND_DESCRIPTIONS: Record<StudioKind, string> = {
  catalogo: "Imagen limpia y profesional para tienda online y producto.",
  transparente: "Aísla la prenda y genera PNG limpio listo para diseño, e-commerce y composición.",
  dinamico: "Crea escenas visuales para campañas, redes y carruseles.",
};

/** Instrucción extra de la tarjeta de fondo transparente (no se guarda ningún estilo nuevo). */
const TRANSPARENT_SUFFIX =
  "\n\nRecorta la prenda con precisión y entrégala sobre fondo completamente transparente (PNG con canal alfa), sin sombra proyectada sobre el fondo, sin superficie ni escenario. Bordes limpios, sin halos ni restos del fondo original.";

/** Las cuatro escenas del carrusel: distintas entre sí, misma prenda sin alterar. */
const CAROUSEL_SCENES = [
  "Escena 1 de 4: estudio con textura sutil de cemento pulido y luz lateral suave.",
  "Escena 2 de 4: exterior urbano minimalista, luz natural de día, fondo desenfocado.",
  "Escena 3 de 4: fondo de color sólido rojo de marca, iluminación de campaña con contraste alto.",
  "Escena 4 de 4: plano de detalle macro de la tela y los acabados de la prenda.",
];

const emptyViewInput = (): ViewInput => ({ include: false, file: null, previewUrl: null });

export default function EstudioVisual() {
  const [presets, setPresets] = useState<PromptPreset[]>([]);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const [imageModels, setImageModels] = useState<EnabledModel[]>([]);
  const [imageModel, setImageModel] = useState<string>("");

  const [wizardKind, setWizardKind] = useState<StudioKind | null>(null);
  const [format, setFormat] = useState("4:5");
  const [mode, setMode] = useState<StudioMode>("individual");
  const [promptText, setPromptText] = useState("");
  const [generating, setGenerating] = useState(false);

  const [views, setViews] = useState<Record<ViewType, ViewInput>>({
    frente: { include: true, file: null, previewUrl: null },
    espalda: emptyViewInput(),
    detalle: emptyViewInput(),
    tres_cuartos: emptyViewInput(),
  });
  const [modelPhoto, setModelPhoto] = useState<ViewInput>(emptyViewInput());
  const [cutout, setCutout] = useState<ViewInput>(emptyViewInput());


  const [jobs, setJobs] = useState<StudioJob[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [promptDialog, setPromptDialog] = useState<{ title: string; body: string } | null>(null);
  const [backgrounds, setBackgrounds] = useState<StudioBackground[]>([]);
  const [backgroundPrompts, setBackgroundPrompts] = useState<StudioBackgroundPrompt[]>([]);
  const [backgroundUrls, setBackgroundUrls] = useState<Record<string, string>>({});
  const [backgroundId, setBackgroundId] = useState<string | null>(null);

  const loadPresets = useCallback(async () => {
    const { data, error } = await estudioDb
      .from("estudio_prompt_presets")
      .select("*")
      .order("photo_type")
      .order("name");
    if (error) {
      setPresetsError(describeEstudioLoadError(error, "No se pudieron cargar los estilos de fotografía."));
      return;
    }
    setPresetsError(null);
    setPresets((data ?? []) as PromptPreset[]);
  }, []);

  const loadModels = useCallback(async () => {
    const images = await loadEnabledModels("image");
    setImageModels(images);
    setImageModel((current) => (current && images.some((m) => m.model_id === current) ? current : images[0]?.model_id ?? ""));
  }, []);

  const loadJobs = useCallback(async () => {
    const { data } = await estudioDb
      .from("estudio_image_jobs")
      .select(
        "id, created_at, status, session_id, view_type, photo_type, is_inferred, uses_model_reference, generated_image_path, source_photo_path, image_model, output_size, background_reference_path, prompt_used, cost_usd, error_message, composition_mode, cutout_path, composition_path",
      )
      .order("created_at", { ascending: false })
      .limit(60);
    const list = (data ?? []) as StudioJob[];
    setJobs(list);

    const ready = list.filter((j) => j.status === "completed" && j.generated_image_path);
    const entries = await Promise.all(
      ready.map(async (j) => [j.id, await resolveEstudioSignedUrl(j.generated_image_path!)] as const),
    );
    setUrls(Object.fromEntries(entries));
  }, []);

  const loadBackgrounds = useCallback(async () => {
    try {
      const [list, prompts] = await Promise.all([
        loadStudioBackgrounds({ onlyActive: true }),
        loadStudioBackgroundPrompts(),
      ]);
      setBackgrounds(list);
      setBackgroundPrompts(prompts);
      const entries = await Promise.all(
        list
          .filter((b) => b.cover_path)
          .map(async (b) => [b.id, await resolveEstudioSignedUrl(b.cover_path!)] as const),
      );
      setBackgroundUrls(Object.fromEntries(entries));
      setBackgroundId((current) => (current && list.some((b) => b.id === current) ? current : null));
    } catch {
      setBackgrounds([]);
    }
  }, []);

  useEffect(() => {
    loadPresets();
    loadModels();
    loadJobs();
    loadBackgrounds();
  }, [loadPresets, loadModels, loadJobs, loadBackgrounds]);

  const resolvedBackgroundPrompt = useMemo(
    () => resolveBackgroundPrompt(backgroundPrompts, backgroundId, imageModel),
    [backgroundPrompts, backgroundId, imageModel],
  );

  const selectedBackground = useMemo(
    () => backgrounds.find((b) => b.id === backgroundId) ?? null,
    [backgrounds, backgroundId],
  );

  /** Persiste el texto actual como prompt base de fondo + modelo. */
  const handleSavePromptBase = useCallback(async () => {
    if (!backgroundId || !imageModel) return;
    await saveStudioBackgroundPrompts(backgroundId, { [imageModel]: promptText });
    const prompts = await loadStudioBackgroundPrompts();
    setBackgroundPrompts(prompts);
    toast.success("Prompt base guardado");
  }, [backgroundId, imageModel, promptText]);

  /** Al elegir fondo o cambiar de modelo, el prompt visible pasa a ser el de esa combinación. */
  useEffect(() => {
    if (wizardKind !== "dinamico" || !backgroundId) return;
    setPromptText(resolvedBackgroundPrompt ?? "");
  }, [wizardKind, backgroundId, resolvedBackgroundPrompt]);


  const presetForKind = useCallback(
    (kind: StudioKind): PromptPreset | null => {
      const photoType = kind === "dinamico" ? "mockup" : "fondo_blanco";
      const pool = presets.filter((p) => p.photo_type === photoType);
      return pool.find((p) => p.is_default) ?? pool[0] ?? presets[0] ?? null;
    },
    [presets],
  );

  const basePromptFor = useCallback(
    (kind: StudioKind) => {
      const preset = presetForKind(kind);
      const base = preset?.prompt_text ?? "";
      return kind === "transparente" ? `${base}${TRANSPARENT_SUFFIX}` : base;
    },
    [presetForKind],
  );

  const openWizard = useCallback(
    (kind: StudioKind, opts?: { format?: string; mode?: StudioMode; prompt?: string }) => {
      setWizardKind(kind);
      setMode(kind === "dinamico" ? opts?.mode ?? "individual" : "individual");
      setFormat(opts?.format ?? "4:5");
      setPromptText(opts?.prompt ?? basePromptFor(kind));
      const preset = presetForKind(kind);
      if (preset?.image_model) setImageModel(preset.image_model);
    },
    [basePromptFor, presetForKind],
  );

  const closeWizard = () => {
    setCutout((prev) => {
      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return emptyViewInput();
    });
    setWizardKind(null);
  };


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
  };

  const setCutoutFile = (file: File | null) => {
    setCutout((prev) => {
      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return {
        include: Boolean(file),
        file,
        previewUrl: file ? URL.createObjectURL(file) : null,
      };
    });
  };


  const toggleView = (view: ViewType, include: boolean) => {
    setViews((prev) => ({ ...prev, [view]: { ...prev[view], include } }));
  };

  const handleGenerate = async () => {
    const kind = wizardKind;
    const frontFile = views.frente.file;
    if (!kind) return;
    if (!frontFile) {
      toast.error("Sube la foto frontal de la prenda.");
      return;
    }
    const preset = presetForKind(kind);
    if (!preset) {
      toast.error("No hay estilos de fotografía disponibles.");
      return;
    }
    const cutoutFile = cutout.file;
    const useComposition = Boolean(cutoutFile) && (kind === "transparente" || kind === "dinamico");

    if (kind === "dinamico") {
      if (!selectedBackground) {
        toast.error("Elige un fondo para el fondo dinámico.");
        return;
      }
      if (!useComposition && !resolvedBackgroundPrompt && !promptText.trim()) {
        toast.error("Ese fondo no tiene prompt configurado para el modelo elegido.");
        return;
      }
    }

    // Composición real por capas: la prenda no pasa por ningún modelo generativo.
    if (useComposition && cutoutFile) {
      setGenerating(true);
      try {
        const sessionId = crypto.randomUUID();
        const seq = nextStudioSeq();
        saveStudioSetMeta(sessionId, { seq, kind, mode: "individual" });

        const cutoutPath = await uploadEstudioCutout(cutoutFile);
        let compositionPath: string | null = null;
        let compositionMode: "cutout_ready" | "composited" = "cutout_ready";

        if (kind === "dinamico") {
          const backgroundUrl = selectedBackground ? backgroundUrls[selectedBackground.id] : null;
          if (!backgroundUrl) throw new Error("No se pudo cargar la imagen del fondo elegido.");
          const cutoutUrl = URL.createObjectURL(cutoutFile);
          try {
            const blob = await composeCutoutOnBackground(backgroundUrl, cutoutUrl, format);
            compositionPath = await uploadEstudioComposition(blob, sessionId);
          } finally {
            URL.revokeObjectURL(cutoutUrl);
          }
          compositionMode = "composited";
        }

        const { data: auth } = await supabase.auth.getUser();
        const { error } = await estudioDb.from("estudio_image_jobs").insert({
          created_by: auth.user?.id ?? null,
          status: "completed",
          photo_type: preset.photo_type,
          source_photo_path: cutoutPath,
          cutout_path: cutoutPath,
          composition_path: compositionPath,
          background_reference_path:
            kind === "dinamico" ? selectedBackground?.reference_path ?? null : null,
          generated_image_path: compositionPath ?? cutoutPath,
          composition_mode: compositionMode,
          fidelity_pipeline_version: 1,
          output_size: format,
          cost_usd: 0,
          session_id: sessionId,
          view_type: "frente",
          is_inferred: false,
          prompt_used: null,
        });
        if (error) throw error;

        toast.success(
          compositionMode === "composited"
            ? "Composición lista: la prenda no se alteró."
            : "Recorte guardado tal cual, sin generación.",
        );
        await loadJobs();
        closeWizard();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo componer la imagen.");
      } finally {
        setGenerating(false);
      }
      return;
    }


    const isCarousel = kind === "dinamico" && mode === "carrusel";
    setGenerating(true);
    try {
      const frontPath = await uploadEstudioSourcePhoto(frontFile);
      const modelPath = modelPhoto.file ? await uploadEstudioSourcePhoto(modelPhoto.file) : null;

      const requests: { viewType: ViewType; sourcePath: string; isInferred: boolean; suffix?: string }[] = [];
      if (isCarousel) {
        for (const scene of CAROUSEL_SCENES) {
          requests.push({ viewType: "frente", sourcePath: frontPath, isInferred: false, suffix: `\n\n${scene}` });
        }
      } else {
        requests.push({ viewType: "frente", sourcePath: frontPath, isInferred: false });
        for (const view of OPTIONAL_VIEWS) {
          const input = views[view];
          if (!input.include) continue;
          const sourcePath = input.file ? await uploadEstudioSourcePhoto(input.file) : frontPath;
          requests.push({ viewType: view, sourcePath, isInferred: !input.file });
        }
      }

      const sessionId = crypto.randomUUID();
      const seq = nextStudioSeq();
      saveStudioSetMeta(sessionId, { seq, kind, mode: isCarousel ? "carrusel" : "individual" });

      const results = await Promise.all(
        requests.map(async (item) => {
          try {
            const { data, error } = await supabase.functions.invoke("estudio-generate-image", {
              body: {
                sourcePhotoPath: item.sourcePath,
                modelPhotoPath: modelPath ?? undefined,
                backgroundReferencePath:
                  kind === "dinamico" ? selectedBackground?.reference_path ?? undefined : undefined,
                photoType: preset.photo_type,
                promptPresetId: preset.id,
                promptOverride: `${promptText}${item.suffix ?? ""}`,
                imageModel: imageModel || undefined,
                outputSize: format,
                sessionId,
                viewType: item.viewType,
                isInferred: item.isInferred,
              },
            });
            if (error) throw new Error(await readEdgeFunctionError(error));
            if (data?.error) throw new Error(data.error);
            return { ok: true as const };
          } catch (e) {
            return { ok: false as const, message: e instanceof Error ? e.message : "La generación falló." };
          }
        }),
      );

      const okCount = results.filter((r) => r.ok).length;
      if (okCount === 0) {
        toast.error(results.find((r) => !r.ok)?.message ?? "Ninguna imagen se pudo generar.");
      } else if (okCount < results.length) {
        toast.warning(`Se generaron ${okCount} de ${results.length} imágenes.`);
      } else {
        toast.success(okCount === 1 ? "Imagen generada." : `${okCount} imágenes generadas.`);
      }

      await loadJobs();
      if (okCount > 0) closeWizard();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar la imagen.");
    } finally {
      setGenerating(false);
    }
  };

  // Los sets se arman en el cliente agrupando por la sesión que ya guarda el backend.
  const sets: StudioSet[] = useMemo(() => {
    const groups = new Map<string, StudioJob[]>();
    for (const job of jobs) {
      const key = job.session_id ?? job.id;
      const arr = groups.get(key) ?? [];
      arr.push(job);
      groups.set(key, arr);
    }

    const built: StudioSet[] = [];
    // De más antiguo a más nuevo, para que los sets previos a esta versión reciban un
    // correlativo estable la primera vez que se ven.
    const ordered = [...groups.entries()].sort(
      (a, b) => new Date(a[1][a[1].length - 1].created_at).getTime() - new Date(b[1][b[1].length - 1].created_at).getTime(),
    );

    for (const [key, list] of ordered) {
      const items = [...list].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      let meta = getStudioSetMeta(key);
      if (!meta) {
        const inferredKind: StudioKind = items[0].photo_type === "fondo_blanco" ? "catalogo" : "dinamico";
        meta = { seq: nextStudioSeq(), kind: inferredKind, mode: items.length >= 4 ? "carrusel" : "individual" };
        saveStudioSetMeta(key, meta);
      }

      const anyRunning = items.some((j) => j.status !== "completed" && j.status !== "failed");
      const anyDone = items.some((j) => j.status === "completed");
      const costs = items.map((j) => j.cost_usd).filter((c): c is number => c != null);

      built.push({
        key,
        seq: meta.seq,
        kind: meta.kind,
        mode: meta.mode,
        createdAt: items[0].created_at,
        jobs: items,
        status: anyRunning ? "procesando" : anyDone ? "listo" : "fallido",
        costUsd: costs.length ? costs.reduce((a, b) => a + b, 0) : null,
      });
    }

    return built.reverse();
  }, [jobs]);

  const readyJobs = (set: StudioSet) =>
    sortReadyJobs(set.jobs.filter((j) => j.status === "completed" && j.generated_image_path));

  const handleDownloadJob = async (set: StudioSet, job: StudioJob, index: number) => {
    if (!job.generated_image_path) return;
    await downloadEstudioImage(
      job.generated_image_path,
      studioFileName(set.seq, index + 1, set.mode === "carrusel" ? null : job.view_type),
    );
  };

  const handleDownloadAll = async (set: StudioSet) => {
    const ready = readyJobs(set);
    for (let i = 0; i < ready.length; i++) {
      await downloadEstudioImage(
        ready[i].generated_image_path!,
        studioFileName(set.seq, i + 1, set.mode === "carrusel" ? null : ready[i].view_type),
      );
    }
    toast.success("Las imágenes se descargan en orden.");
  };

  /** Detalle por vista: fuente usada, modelo, fondo, formato y prompt. */
  const buildSetDetail = (set: StudioSet): { title: string; body: string } => {
    const ordered = sortReadyJobs(set.jobs);
    const multiView = set.mode !== "carrusel" && new Set(ordered.map((j) => j.view_type)).size > 1;
    const tipo =
      set.mode === "carrusel"
        ? "Carrusel"
        : multiView
          ? "Batch multi-vista"
          : "Generación individual";

    const blocks = ordered.map((job, i) => {
      const bg = backgrounds.find((b) => b.reference_path === job.background_reference_path);
      return [
        `— ${String(i + 1).padStart(2, "0")} · Vista: ${studioViewLabel(job.view_type)}`,
        `Imagen fuente: ${job.source_photo_path ?? "—"}`,
        `Modelo: ${job.image_model ?? "—"}`,
        `Fondo: ${bg?.name ?? job.background_reference_path ?? "—"}`,
        `Formato: ${job.output_size ?? "—"}`,
        job.error_message ? `Error: ${job.error_message}` : null,
        "",
        job.prompt_used ?? "Sin prompt guardado.",
      ]
        .filter(Boolean)
        .join("\n");
    });

    return {
      title: `${STUDIO_KIND_LABELS[set.kind]} — detalles`,
      body: [`Tipo: ${tipo}`, "", ...blocks].join("\n\n"),
    };
  };


  const handlePreview = (jobId: string, title: string) => {
    const url = urls[jobId];
    if (!url) {
      toast.error("No se pudo abrir la vista previa.");
      return;
    }
    setPreviewTitle(title);
    setPreviewUrl(url);
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-[0.25em] text-primary font-bold">Basico</p>
        <h1 className="text-4xl font-black tracking-tight">Basico Studio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Crea imágenes de producto listas para catálogo, campañas y redes.
        </p>
      </header>

      {presetsError && (
        <EstudioLoadError
          message={presetsError}
          hint="Hasta entonces la generación no va a funcionar."
          onRetry={loadPresets}
        />
      )}

      <StudioActionCards onSelect={(kind) => openWizard(kind)} />

      <StudioResults
        sets={sets}
        urls={urls}
        onPreview={handlePreview}
        onDownloadJob={handleDownloadJob}
        onDownloadAll={handleDownloadAll}
        onDuplicate={(set) =>
          openWizard(set.kind, { mode: set.mode, prompt: set.jobs[0].prompt_used ?? undefined })
        }
        onUseAsReference={(set) => {
          openWizard(set.kind, { mode: set.mode, prompt: set.jobs[0].prompt_used ?? undefined });
          toast.info("Se cargó la configuración de ese resultado. Sube la foto de la prenda.");
        }}
        onShowPrompt={(set) => setPromptDialog(buildSetDetail(set))}

        onRetry={(set) => openWizard(set.kind, { mode: set.mode, prompt: set.jobs[0].prompt_used ?? undefined })}
        onRefresh={loadJobs}
      />

      {wizardKind && (
        <StudioWizard
          open
          onClose={closeWizard}
          kind={wizardKind}
          kindDescription={KIND_DESCRIPTIONS[wizardKind]}
          format={format}
          onFormatChange={setFormat}
          mode={mode}
          onModeChange={setMode}
          views={views}
          onViewFile={setViewFile}
          onToggleView={toggleView}
          modelPhoto={modelPhoto}
          onModelPhotoFile={setModelPhotoFile}
          cutout={cutout}
          onCutoutFile={setCutoutFile}

          promptText={promptText}
          onPromptChange={setPromptText}
          imageModels={imageModels}
          imageModel={imageModel}
          onImageModelChange={setImageModel}
          onModelsDialogClose={loadModels}
          onPresetsDialogClose={loadPresets}
          onBrandDialogClose={() => {}}
          generating={generating}
          onGenerate={handleGenerate}
          backgrounds={backgrounds}
          backgroundUrls={backgroundUrls}
          backgroundId={backgroundId}
          onBackgroundChange={setBackgroundId}
          onBackgroundsChanged={loadBackgrounds}
          backgroundPrompt={resolvedBackgroundPrompt}
          onSavePromptBase={handleSavePromptBase}
          hasPromptBase={resolvedBackgroundPrompt !== null}
        />
      )}

      <Dialog open={!!promptDialog} onOpenChange={(o) => !o && setPromptDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{promptDialog?.title}</DialogTitle>
          </DialogHeader>
          <pre className="text-xs whitespace-pre-wrap max-h-[60vh] overflow-y-auto text-muted-foreground">
            {promptDialog?.body}
          </pre>
        </DialogContent>
      </Dialog>

      <ImageLightbox url={previewUrl} title={previewTitle} onClose={() => setPreviewUrl(null)} />
    </div>
  );
}
