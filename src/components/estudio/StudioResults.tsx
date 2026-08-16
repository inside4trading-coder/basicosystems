import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Copy, Download, DownloadCloud, Eye, FileText, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STUDIO_KIND_LABELS,
  formatStudioSeq,
  studioViewLabel,
  studioViewRank,
  type StudioKind,
  type StudioMode,
} from "@/lib/estudioNaming";

export type CompositionMode = "generative" | "cutout_ready" | "composited";

export interface StudioJob {
  id: string;
  created_at: string;
  status: string;
  session_id: string | null;
  view_type: string | null;
  photo_type: string;
  is_inferred: boolean | null;
  uses_model_reference: boolean | null;
  generated_image_path: string | null;
  source_photo_path: string | null;
  image_model: string | null;
  output_size: string | null;
  background_reference_path: string | null;
  prompt_used: string | null;
  cost_usd: number | null;
  error_message: string | null;
  composition_mode: CompositionMode | null;
  cutout_path: string | null;
  composition_path: string | null;
}


const COMPOSITION_BADGES: Record<CompositionMode, { label: string; hint: string; className: string }> = {
  generative: {
    label: "Generativo",
    hint: "Generativo: puede alterar detalles de la prenda.",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  cutout_ready: {
    label: "Recorte listo",
    hint: "Recorte listo: PNG entregado tal cual se subió.",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  },
  composited: {
    label: "Compuesto",
    hint: "Compuesto: usa recorte/capa de la prenda sobre fondo real.",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
};


export interface StudioSet {
  key: string;
  seq: number;
  kind: StudioKind;
  mode: StudioMode;
  createdAt: string;
  jobs: StudioJob[];
  status: "listo" | "procesando" | "fallido";
  costUsd: number | null;
  archived: boolean;
}


type FilterId =
  | "todos"
  | "listos"
  | "procesando"
  | "fallidos"
  | "individual"
  | "carrusel"
  | "catalogo"
  | "transparente"
  | "dinamico";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "listos", label: "Listos" },
  { id: "procesando", label: "Procesando" },
  { id: "fallidos", label: "Fallidos" },
  { id: "individual", label: "Individual" },
  { id: "carrusel", label: "Carrusel" },
  { id: "catalogo", label: "Foto catálogo" },
  { id: "transparente", label: "Fondo transparente" },
  { id: "dinamico", label: "Fondo dinámico" },
];

const STATUS_LABELS: Record<StudioSet["status"], string> = {
  listo: "Listo",
  procesando: "Procesando",
  fallido: "Fallido",
};

export interface StudioResultsProps {
  sets: StudioSet[];
  urls: Record<string, string>;
  onPreview: (jobId: string, title: string) => void;
  onDownloadJob: (set: StudioSet, job: StudioJob, index: number) => void;
  onDownloadAll: (set: StudioSet) => void;
  onDuplicate: (set: StudioSet) => void;
  onUseAsReference: (set: StudioSet) => void;
  onShowPrompt: (set: StudioSet) => void;
  onRetry: (set: StudioSet) => void;
  onArchive: (set: StudioSet, archived: boolean) => void;
  onRefresh: () => void;
}

export function StudioResults({
  sets,
  urls,
  onPreview,
  onDownloadJob,
  onDownloadAll,
  onDuplicate,
  onUseAsReference,
  onShowPrompt,
  onRetry,
  onArchive,
  onRefresh,
}: StudioResultsProps) {
  const [filter, setFilter] = useState<FilterId>("todos");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"galeria" | "archivados">("galeria");

  const archivedCount = useMemo(() => sets.filter((s) => s.archived).length, [sets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sets.filter((s) => {
      if (s.archived !== (view === "archivados")) return false;
      const matchesFilter =
        filter === "todos" ||
        (filter === "listos" && s.status === "listo") ||
        (filter === "procesando" && s.status === "procesando") ||
        (filter === "fallidos" && s.status === "fallido") ||
        (filter === "individual" && s.mode === "individual") ||
        (filter === "carrusel" && s.mode === "carrusel") ||
        filter === s.kind;
      if (!matchesFilter) return false;
      if (!q) return true;
      const haystack = [
        `BASICO-STUDIO-${formatStudioSeq(s.seq)}`,
        STUDIO_KIND_LABELS[s.kind],
        s.mode,
        new Date(s.createdAt).toLocaleString("es-VE"),
        s.jobs.map((j) => j.prompt_used ?? "").join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sets, filter, query, view]);


  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black tracking-tight">Resultados recientes</h2>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "text-xs rounded-full border px-3 py-1.5 transition-colors",
              filter === f.id
                ? "bg-primary text-primary-foreground border-primary"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar resultados, prendas o códigos…"
        className="sm:max-w-sm"
      />

      {filtered.length === 0 ? (
        <Card className="p-8 rounded-2xl text-center text-sm text-muted-foreground">
          No hay resultados que coincidan.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((set) => (
            <SetCard
              key={set.key}
              set={set}
              urls={urls}
              onPreview={onPreview}
              onDownloadJob={onDownloadJob}
              onDownloadAll={onDownloadAll}
              onDuplicate={onDuplicate}
              onUseAsReference={onUseAsReference}
              onShowPrompt={onShowPrompt}
              onRetry={onRetry}
            />
          ))}
        </div>
      )}
    </section>
  );
}

type SetCardProps = Omit<StudioResultsProps, "sets" | "onRefresh"> & { set: StudioSet };

/** Ordena las imágenes listas por vista (frente, espalda, detalle, otro) manteniendo el orden real dentro de cada vista. */
export function sortReadyJobs(jobs: StudioJob[]): StudioJob[] {
  return [...jobs].sort((a, b) => {
    const rank = studioViewRank(a.view_type) - studioViewRank(b.view_type);
    if (rank !== 0) return rank;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function SetCard({
  set,
  urls,
  onPreview,
  onDownloadJob,
  onDownloadAll,
  onDuplicate,
  onUseAsReference,
  onShowPrompt,
  onRetry,
}: SetCardProps) {
  const [active, setActive] = useState(0);
  const code = `BASICO-STUDIO-${formatStudioSeq(set.seq)}`;
  const failed = set.status === "fallido";
  const ready = useMemo(
    () =>
      sortReadyJobs(set.jobs.filter((j) => j.status === "completed" && j.generated_image_path)),
    [set.jobs],
  );

  const distinctViews = new Set(ready.map((j) => j.view_type ?? "otro")).size;
  const multiView = set.mode !== "carrusel" && distinctViews > 1;
  const current = ready[Math.min(active, Math.max(ready.length - 1, 0))];
  const badge = COMPOSITION_BADGES[set.jobs[0]?.composition_mode ?? "generative"];

  const subtitle =
    set.mode === "carrusel"
      ? "Carrusel · 4 imágenes"
      : multiView
        ? `${ready.length} vistas`
        : "Individual";

  return (
    <Card className={cn("rounded-2xl overflow-hidden", failed && "border-destructive/40")}>
      {!failed && (
        <div className="bg-muted">
          {ready.length === 0 ? (
            <div className="h-40 w-full flex items-center justify-center text-xs text-muted-foreground">
              {set.status === "procesando" ? "Generando…" : "Sin vista previa"}
            </div>
          ) : set.mode === "carrusel" ? (
            <div className="flex gap-1 overflow-x-auto p-1">
              {ready.map((j, i) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => onPreview(j.id, `${code}-${String(i + 1).padStart(2, "0")}`)}
                  className="shrink-0"
                  aria-label="Ver imagen"
                >
                  <img
                    src={urls[j.id]}
                    alt={`${code} imagen ${i + 1}`}
                    className="h-40 w-32 object-cover rounded-lg"
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  current && onPreview(current.id, `${code} · ${studioViewLabel(current.view_type)}`)
                }
                className="block w-full"
                aria-label="Ver imagen"
              >
                <img src={urls[current.id]} alt={code} className="w-full h-56 object-cover" />
              </button>
              <span className="absolute top-2 left-2 text-[11px] rounded-full bg-background/90 px-2 py-0.5 font-medium">
                Vista: {studioViewLabel(current.view_type)}
              </span>
              {ready.length > 1 && (
                <div className="flex gap-1 p-1 overflow-x-auto">
                  {ready.map((j, i) => (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => setActive(i)}
                      className={cn(
                        "shrink-0 rounded-lg overflow-hidden border-2",
                        i === active ? "border-primary" : "border-transparent opacity-70",
                      )}
                      aria-label={`Ver ${studioViewLabel(j.view_type)}`}
                    >
                      <img
                        src={urls[j.id]}
                        alt={studioViewLabel(j.view_type)}
                        className="h-14 w-12 object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{code}</p>
            <p className="text-xs text-muted-foreground">
              {STUDIO_KIND_LABELS[set.kind]} · {subtitle}
            </p>
          </div>
          <span
            className={cn(
              "text-[11px] rounded-full px-2 py-0.5 shrink-0",
              set.status === "listo" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
              set.status === "procesando" && "bg-muted text-muted-foreground",
              set.status === "fallido" && "bg-destructive/10 text-destructive",
            )}
          >
            {STATUS_LABELS[set.status]}
          </span>
        </div>

        <span
          title={badge.hint}
          className={cn("inline-block text-[11px] rounded-full px-2 py-0.5", badge.className)}
        >
          {badge.label}
        </span>

        <p className="text-xs text-muted-foreground">
          {new Date(set.createdAt).toLocaleString("es-VE")}
          {set.costUsd != null && ` · $${set.costUsd.toFixed(4)} USD`}
        </p>

        {failed ? (
          <div className="space-y-2">
            <p className="text-xs text-destructive flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {set.jobs.find((j) => j.error_message)?.error_message ?? "La generación falló."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onRetry(set)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reintentar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onShowPrompt(set)}>
                <FileText className="mr-2 h-4 w-4" />
                Ver error
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {ready.map((j, i) => (
              <Button
                key={j.id}
                size="sm"
                variant="outline"
                onClick={() => onDownloadJob(set, j, i)}
              >
                <Download className="mr-2 h-4 w-4" />
                {set.mode === "carrusel"
                  ? String(i + 1).padStart(2, "0")
                  : multiView
                    ? studioViewLabel(j.view_type)
                    : "Descargar"}
              </Button>
            ))}
            {ready.length > 1 && (
              <Button size="sm" onClick={() => onDownloadAll(set)}>
                <DownloadCloud className="mr-2 h-4 w-4" />
                Descargar todo
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onDuplicate(set)}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onUseAsReference(set)}>
              <Eye className="mr-2 h-4 w-4" />
              Usar como referencia
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onShowPrompt(set)}>
              <FileText className="mr-2 h-4 w-4" />
              Ver detalles
            </Button>
          </div>
        )}

        {set.mode === "carrusel" && !failed && (
          <p className="text-[11px] text-muted-foreground">
            Las imágenes se descargan en orden para carrusel.
          </p>
        )}
      </div>
    </Card>
  );
}

