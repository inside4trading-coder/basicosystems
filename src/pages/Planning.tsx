import { useState, useEffect, useMemo } from "react";
import { Loader2, AlertTriangle, RefreshCw, ExternalLink, Database, Table, Calendar, ListChecks, Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { usePlanningDatabases, usePlanningTasks } from "@/hooks/usePlanningData";
import PlanningTable from "@/components/planning/PlanningTable";
import PlanningCalendar from "@/components/planning/PlanningCalendar";
import PlanningAgenda from "@/components/planning/PlanningAgenda";

const ARCHIVED_KEY = "planning:archived_sources";

function useArchivedSources() {
  const [archived, setArchived] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(ARCHIVED_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(ARCHIVED_KEY, JSON.stringify(archived)); } catch {}
  }, [archived]);
  const toggle = (id: string) =>
    setArchived((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  return { archived, toggle, isArchived: (id: string) => archived.includes(id) };
}

export default function Planning() {
  const { databases: allDatabases, loading: loadingDbs, error: dbError, refetch: refetchDbs } = usePlanningDatabases();
  const { archived, toggle: toggleArchive, isArchived } = useArchivedSources();
  const [showArchived, setShowArchived] = useState(false);

  const visibleDatabases = useMemo(
    () => allDatabases.filter((d) => (showArchived ? isArchived(d.id) : !isArchived(d.id))),
    [allDatabases, archived, showArchived]
  );
  const databases = visibleDatabases;

  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [view, setView] = useState<"agenda" | "tabla" | "calendario">("agenda");

  // Reset selection if it's no longer visible
  useEffect(() => {
    if (selectedSource !== "all" && !visibleDatabases.find((d) => d.id === selectedSource)) {
      setSelectedSource("all");
    }
  }, [visibleDatabases, selectedSource]);

  const { tasks, loading: loadingTasks, error: taskError, refetch: refetchTasks } = usePlanningTasks(selectedSource, visibleDatabases);
  const [syncing, setSyncing] = useState(false);

  const isTokenError = (msg: string | null) =>
    msg && (msg.toLowerCase().includes("401") || msg.toLowerCase().includes("unauthorized"));

  const handleSync = async () => {
    setSyncing(true);
    try {
      await refetchDbs();
      await refetchTasks();
      toast.success("Sincronización completada");
    } catch {
      toast.error("Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const selectedDb = databases.find((d) => d.id === selectedSource);

  // ── Token error ──
  if (dbError && isTokenError(dbError)) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="kpi-card p-8 text-center animate-fade-in">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--status-error))]" />
          <h3 className="text-base font-bold mb-1">Token de Notion inválido</h3>
          <p className="text-sm text-muted-foreground">Verifica que NOTION_TOKEN esté configurado correctamente en los Secrets del proyecto.</p>
        </div>
      </div>
    );
  }

  // ── Loading databases ──
  if (loadingDbs) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground font-semibold">Cargando fuentes de Notion…</span>
        </div>
      </div>
    );
  }

  // ── Error loading databases ──
  if (dbError) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="kpi-card p-8 text-center animate-fade-in">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--status-error))]" />
          <p className="text-sm font-bold text-[hsl(var(--status-error))] mb-3">{dbError}</p>
          <button onClick={refetchDbs} className="text-xs font-semibold text-primary hover:underline">Reintentar</button>
        </div>
      </div>
    );
  }

  // ── No databases ──
  if (allDatabases.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="kpi-card p-8 text-center animate-fade-in">
          <Database className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-bold mb-1">No hay fuentes compartidas</h3>
          <p className="text-sm text-muted-foreground">Comparte al menos una base de datos de Notion con la integración para comenzar.</p>
        </div>
      </div>
    );
  }

  const archivedCount = archived.filter((id) => allDatabases.some((d) => d.id === id)).length;
  const activeCount = allDatabases.length - archivedCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Planificación</h2>
          <p className="text-sm text-muted-foreground">Visor de tareas sincronizado con Notion</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar
          </button>
          {selectedDb && (
            <a
              href={selectedDb.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir en Notion
            </a>
          )}
        </div>
      </div>

      {/* Active / Archived toggle */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        <button
          onClick={() => setShowArchived(false)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            !showArchived ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Activas ({activeCount})
        </button>
        <button
          onClick={() => setShowArchived(true)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            showArchived ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Archive className="h-3.5 w-3.5" /> Archivadas ({archivedCount})
        </button>
      </div>

      {/* Source selector + view toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 overflow-x-auto">
          <button
            onClick={() => setSelectedSource("all")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              selectedSource === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {showArchived ? "Todas archivadas" : "Todas las fuentes"}
          </button>
          {visibleDatabases.length === 0 && (
            <span className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
              {showArchived ? "Sin fuentes archivadas" : "Sin fuentes activas"}
            </span>
          )}
          {visibleDatabases.map((db) => (
            <div
              key={db.id}
              className={`group flex items-center rounded-md transition-colors ${
                selectedSource === db.id ? "bg-card shadow-sm" : "hover:bg-card/50"
              }`}
            >
              <button
                onClick={() => setSelectedSource(db.id)}
                className={`pl-3 pr-1 py-1.5 rounded-l-md text-xs font-semibold transition-colors truncate max-w-[160px] ${
                  selectedSource === db.id ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                }`}
                title={db.name}
              >
                {db.name}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleArchive(db.id);
                  toast.success(showArchived ? "Fuente restaurada" : "Fuente archivada");
                }}
                className="px-1.5 py-1.5 rounded-r-md text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition"
                title={showArchived ? "Restaurar fuente" : "Archivar fuente"}
              >
                {showArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>


        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setView("agenda")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              view === "agenda" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ListChecks className="h-3.5 w-3.5" /> Agenda
          </button>
          <button
            onClick={() => setView("tabla")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              view === "tabla" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Table className="h-3.5 w-3.5" /> Tabla
          </button>
          <button
            onClick={() => setView("calendario")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              view === "calendario" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="h-3.5 w-3.5" /> Calendario
          </button>
        </div>
      </div>

      {/* Content */}
      {view === "agenda" ? (
        <PlanningAgenda tasks={tasks} loading={loadingTasks} error={taskError} />
      ) : view === "tabla" ? (
        <PlanningTable tasks={tasks} loading={loadingTasks} error={taskError} selectedDatabaseId={selectedSource} />
      ) : (
        <PlanningCalendar tasks={tasks} loading={loadingTasks} error={taskError} selectedDatabaseId={selectedSource} />
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <h2 className="text-2xl font-black tracking-tight">Planificación</h2>
      <p className="text-sm text-muted-foreground">Visor de tareas sincronizado con Notion</p>
    </div>
  );
}
