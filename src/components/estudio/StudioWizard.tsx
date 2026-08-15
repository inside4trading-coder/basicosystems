import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertTriangle, ImagePlus, Loader2, Save, Sparkles, X } from "lucide-react";
import { modelLabel, imageModelOptions, describeImageModel, type EnabledModel } from "@/lib/estudioModels";
import { STUDIO_KIND_LABELS, type StudioKind, type StudioMode } from "@/lib/estudioNaming";
import { ManageDialogButton } from "@/components/estudio/DropdownWithManageDialog";
import ModelsTab from "@/components/estudio/config/ModelsTab";
import PromptTab from "@/components/estudio/config/PromptTab";
import BrandTab from "@/components/estudio/config/BrandTab";
import BackgroundsTab from "@/components/estudio/config/BackgroundsTab";
import { StudioBackgroundStep } from "@/components/estudio/StudioBackgroundStep";
import type { StudioBackground } from "@/lib/estudioBackgrounds";
import { cn } from "@/lib/utils";

export type ViewType = "frente" | "espalda" | "detalle" | "tres_cuartos";

export interface ViewInput {
  include: boolean;
  file: File | null;
  previewUrl: string | null;
}

export const VIEW_LABELS: Record<ViewType, string> = {
  frente: "Frente",
  espalda: "Espalda",
  detalle: "Detalle",
  tres_cuartos: "Tres cuartos",
};

export const OPTIONAL_VIEWS: ViewType[] = ["espalda", "detalle", "tres_cuartos"];

export const FORMAT_OPTIONS = [
  { value: "4:5", label: "Instagram 4:5" },
  { value: "9:16", label: "Story 9:16" },
  { value: "1:1", label: "Cuadrado 1:1" },
  { value: "16:9", label: "Web 16:9" },
];

/** Selector de foto (una vista de la prenda, o la persona que va a lucirla). */
export function ViewPhotoPicker({
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

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
          {n}
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="pl-8 space-y-3">{children}</div>
    </section>
  );
}

export interface StudioWizardProps {
  open: boolean;
  onClose: () => void;
  kind: StudioKind;
  kindDescription: string;
  format: string;
  onFormatChange: (v: string) => void;
  mode: StudioMode;
  onModeChange: (m: StudioMode) => void;
  views: Record<ViewType, ViewInput>;
  onViewFile: (view: ViewType, file: File | null) => void;
  onToggleView: (view: ViewType, include: boolean) => void;
  modelPhoto: ViewInput;
  onModelPhotoFile: (file: File | null) => void;
  promptText: string;
  onPromptChange: (v: string) => void;
  imageModels: EnabledModel[];
  imageModel: string;
  onImageModelChange: (v: string) => void;
  onModelsDialogClose: () => void;
  onPresetsDialogClose: () => void;
  onBrandDialogClose: () => void;
  generating: boolean;
  onGenerate: () => void;
  /** Fondos dinámicos activos (solo se usan cuando kind === "dinamico"). */
  backgrounds?: StudioBackground[];
  backgroundUrls?: Record<string, string>;
  backgroundId?: string | null;
  onBackgroundChange?: (id: string) => void;
  onBackgroundsChanged?: () => void;
  /** Prompt resuelto para fondo + modelo. `null` cuando falta configurarlo. */
  backgroundPrompt?: string | null;
  /** Guarda el texto actual como prompt base de fondo + modelo. */
  onSavePromptBase?: () => void | Promise<void>;
  /** Indica si ya existe un prompt base para la combinación activa. */
  hasPromptBase?: boolean;
}

export function StudioWizard(props: StudioWizardProps) {
  const {
    open,
    onClose,
    kind,
    kindDescription,
    format,
    onFormatChange,
    mode,
    onModeChange,
    views,
    onViewFile,
    onToggleView,
    modelPhoto,
    onModelPhotoFile,
    promptText,
    onPromptChange,
    imageModels,
    imageModel,
    onImageModelChange,
    onModelsDialogClose,
    onPresetsDialogClose,
    onBrandDialogClose,
    generating,
    onGenerate,
    backgrounds = [],
    backgroundUrls = {},
    backgroundId = null,
    onBackgroundChange,
    onBackgroundsChanged,
    backgroundPrompt,
    onSavePromptBase,
    hasPromptBase,
  } = props;

  const [savingPromptBase, setSavingPromptBase] = useState(false);

  const isCarousel = kind === "dinamico" && mode === "carrusel";
  const extraViews = isCarousel ? 0 : OPTIONAL_VIEWS.filter((v) => views[v].include).length;
  const outputs = isCarousel ? 4 : 1 + extraViews;
  const inferred = isCarousel ? 0 : OPTIONAL_VIEWS.filter((v) => views[v].include && !views[v].file).length;
  const stepFormato = kind === "dinamico" ? 4 : 3;
  const stepGenerar = stepFormato + 1;
  const missingBackground = kind === "dinamico" && !backgroundId;
  const modelOptions = imageModelOptions(imageModels);
  const selectedModel = modelOptions.find((m) => m.model_id === imageModel) ?? null;
  const missingModel = !imageModel || !selectedModel?.available;
  const missingBackgroundPrompt =
    kind === "dinamico" && !!backgroundId && backgroundPrompt === null && !promptText.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl w-screen h-[100dvh] sm:h-auto sm:w-full sm:max-h-[90vh] overflow-y-auto rounded-none sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-tight">
            {STUDIO_KIND_LABELS[kind]}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{kindDescription}</p>
        </DialogHeader>

        <div className="space-y-7 pt-2">
          <Step n={1} title="Tipo">
            <div className="rounded-xl border p-3 text-sm">
              <span className="font-semibold">{STUDIO_KIND_LABELS[kind]}</span>
              {kind === "dinamico" && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(["individual", "carrusel"] as StudioMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onModeChange(m)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        mode === m ? "border-primary bg-primary/5" : "hover:bg-muted",
                      )}
                    >
                      <p className="font-semibold text-sm">
                        {m === "individual" ? "Imagen individual" : "Carrusel x4"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m === "individual"
                          ? "Una escena a partir de la foto de la prenda."
                          : "Cuatro escenas distintas listas para publicar en orden."}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Step>

          <Step n={2} title="Prenda">
            <div className="rounded-xl border divide-y">
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{VIEW_LABELS.frente}</span>
                  <span className="text-xs text-muted-foreground">(obligatoria)</span>
                </div>
                <ViewPhotoPicker
                  altLabel={VIEW_LABELS.frente}
                  input={views.frente}
                  onFile={(f) => onViewFile("frente", f)}
                  onClear={() => onViewFile("frente", null)}
                />
              </div>

              {!isCarousel &&
                OPTIONAL_VIEWS.map((view) => {
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
                          onCheckedChange={(v) => onToggleView(view, v)}
                        />
                      </div>
                      {input.include && (
                        <>
                          <ViewPhotoPicker
                            altLabel={VIEW_LABELS[view]}
                            input={input}
                            onFile={(f) => onViewFile(view, f)}
                            onClear={() => onViewFile(view, null)}
                          />
                          {!input.file && (
                            <p className="text-xs text-amber-600 dark:text-amber-500 flex items-start gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              Sin foto propia, la IA deduce esta vista desde el frente.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

              <div className="p-4 space-y-2">
                <Label className="font-medium text-sm">Referencia de modelo (opcional)</Label>
                <p className="text-xs text-muted-foreground">
                  Si subes la foto de una persona, la IA la usa como referencia junto con la prenda.
                </p>
                <ViewPhotoPicker
                  altLabel="del modelo"
                  input={modelPhoto}
                  onFile={(f) => onModelPhotoFile(f)}
                  onClear={() => onModelPhotoFile(null)}
                />
                {modelPhoto.file && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    El resultado es una persona sintetizada a partir de esa foto. Usa solo fotos con
                    permiso de la persona.
                  </p>
                )}
              </div>
            </div>
          </Step>

          {kind === "dinamico" && (
            <Step n={3} title="Fondo">
              <StudioBackgroundStep
                backgrounds={backgrounds}
                coverUrls={backgroundUrls}
                selectedId={backgroundId ?? null}
                onSelect={(id) => onBackgroundChange?.(id)}
                onChanged={() => onBackgroundsChanged?.()}
              />
              {backgroundId && backgroundPrompt === null && (
                <p className="text-xs text-amber-600 dark:text-amber-500 flex items-start gap-1.5 mt-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Este fondo no tiene prompt configurado para el modelo elegido.
                </p>
              )}
            </Step>
          )}

          <Step n={stepFormato} title="Formato">
            <Select value={format} onValueChange={onFormatChange}>
              <SelectTrigger className="sm:max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Step>

          <Step n={stepGenerar} title="Generar">
            <div className="space-y-2">
              <Label className="font-medium text-sm">Modelo de generación</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {modelOptions.map((m) => {
                  const active = m.model_id === imageModel && m.available;
                  return (
                    <button
                      key={m.model_id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={!m.available}
                      onClick={() => m.available && onImageModelChange(m.model_id)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        active ? "border-primary bg-primary/5" : "hover:bg-muted",
                        !m.available && "opacity-50 cursor-not-allowed hover:bg-transparent",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm leading-tight">{m.name}</p>
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            m.available ? "border-primary/40 text-primary" : "text-muted-foreground",
                          )}
                        >
                          {m.available ? m.tier : "No configurado"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                    </button>
                  );
                })}
              </div>
              {missingModel && (
                <p className="text-xs text-amber-600 dark:text-amber-500 flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Elige un modelo disponible para poder generar.
                </p>
              )}
            </div>

            <div className="rounded-xl border p-4 text-sm space-y-1">

              <p>
                <span className="text-muted-foreground">Tipo: </span>
                {STUDIO_KIND_LABELS[kind]}
              </p>
              {kind === "dinamico" && (
                <p>
                  <span className="text-muted-foreground">Fondo: </span>
                  {backgrounds.find((b) => b.id === backgroundId)?.name ?? "Sin elegir"}
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Formato: </span>
                {FORMAT_OPTIONS.find((o) => o.value === format)?.label ?? format}
              </p>
              <p>
                <span className="text-muted-foreground">Salida: </span>
                {isCarousel ? "Carrusel · 4 imágenes" : "Imagen individual"}
              </p>
              <p>
                <span className="text-muted-foreground">Cantidad de salidas: </span>
                {outputs}
              </p>
              <p className="text-muted-foreground text-xs">
                El costo real se muestra en cada resultado cuando el modelo lo informa.
              </p>
              {inferred > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  {inferred} {inferred === 1 ? "vista inferida" : "vistas inferidas"} por IA.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={onGenerate}
                disabled={generating || !views.frente.file || missingBackground}
                size="lg"
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {generating ? "Generando…" : isCarousel ? "Generar carrusel" : "Generar"}
              </Button>
              <Button variant="ghost" onClick={onClose} disabled={generating}>
                Cancelar
              </Button>
            </div>
            {missingBackground && (
              <p className="text-xs text-muted-foreground mt-2">
                Elige un fondo para poder generar.
              </p>
            )}
          </Step>

          <Accordion type="single" collapsible>
            <AccordionItem value="avanzado">
              <AccordionTrigger className="text-sm">Avanzado</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div>
                  <Label className="mb-2 block">Modelo de IA</Label>
                  <div className="flex items-center gap-2">
                    <Select value={imageModel} onValueChange={onImageModelChange}>
                      <SelectTrigger className="sm:max-w-sm">
                        <SelectValue placeholder="Elige un modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        {imageModels.map((m) => (
                          <SelectItem key={m.model_id} value={m.model_id}>
                            {modelLabel(m)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="prompt" className="mb-2 block">
                    Prompt para esta generación
                  </Label>
                  <Textarea
                    id="prompt"
                    rows={5}
                    value={promptText}
                    onChange={(e) => onPromptChange(e.target.value)}
                  />
                  <div className="flex items-center justify-between gap-3 mt-2">
                    <p className="text-xs text-muted-foreground">
                      Aplica solo a esta generación.
                    </p>
                    {kind === "dinamico" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          savingPromptBase ||
                          !backgroundId ||
                          !imageModel ||
                          !promptText.trim() ||
                          !onSavePromptBase
                        }
                        onClick={async () => {
                          if (!onSavePromptBase) return;
                          setSavingPromptBase(true);
                          try {
                            await onSavePromptBase();
                          } finally {
                            setSavingPromptBase(false);
                          }
                        }}
                      >
                        {savingPromptBase ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-3.5 w-3.5" />
                        )}
                        {hasPromptBase ? "Actualizar prompt base" : "Guardar como prompt base"}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <ManageDialogButton
                    buttonLabel="Estilos de fotografía"
                    manage={{
                      title: "Estilos de fotografía",
                      description: "Prompt y modelo por defecto de cada estilo.",
                      onClose: onPresetsDialogClose,
                      children: <PromptTab />,
                    }}
                  />
                  <ManageDialogButton
                    buttonLabel="Modelos habilitados"
                    manage={{
                      title: "Modelos habilitados",
                      description: "Controla qué modelos se pueden elegir.",
                      onClose: onModelsDialogClose,
                      children: <ModelsTab />,
                    }}
                  />
                  {kind === "dinamico" && (
                    <ManageDialogButton
                      buttonLabel="Fondos dinámicos"
                      manage={{
                        title: "Fondos dinámicos",
                        description: "Portada, imagen de referencia y prompt por modelo de cada fondo.",
                        onClose: () => onBackgroundsChanged?.(),
                        children: <BackgroundsTab />,
                      }}
                    />
                  )}
                  <ManageDialogButton
                    buttonLabel="Preset de marca BASICO"
                    manage={{
                      title: "Preset de marca BASICO",
                      description: "Logo, colores y posición aplicados a las variantes de Instagram.",
                      onClose: onBrandDialogClose,
                      children: <BrandTab />,
                    }}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </DialogContent>
    </Dialog>
  );
}
