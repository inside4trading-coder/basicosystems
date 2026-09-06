import { useState, useEffect, useMemo } from "react";
import { Loader2, AlertTriangle, RefreshCw, ExternalLink, Database } from "lucide-react";
import { toast } from "sonner";
import { usePlanningDatabases, usePlanningTasks, type NotionTask } from "@/hooks/usePlanningData";
import { usePlanningFilters, usePeopleOptions } from "@/hooks/usePlanningFilters";
import PlanningTable from "@/components/planning/PlanningTable";
import PlanningCalendar from "@/components/planning/PlanningCalendar";
import PlanningAgenda from "@/components/planning/PlanningAgenda";
import PlanningToolbar, { type PlanningView } from "@/components/planning/PlanningToolbar";
import {
  addDays,
  monthLabel,
  startOfWeek,
  taskStartDate,
  weekRangeLabel,
} from "@/lib/planningDates";


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

  const visibleDatabases = useMemo(
    () => allDatabases.filter((d) => !isArchived(d.id)),
    [allDatabases, archived],
  );
  const archivedDatabases = useMemo(
    () => allDatabases.filter((d) => isArchived(d.id)),
    [allDatabases, archived],
  );

  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [view, setView] = useState<PlanningView>("agenda");
  const [cursor, setCursor] = useState<Date>(() => new Date());

  useEffect(() => {
    if (selectedSource !== "all" && !visibleDatabases.find((d) => d.id === selectedSource)) {
      setSelectedSource("all");
    }
  }, [visibleDatabases, selectedSource]);

  const { tasks, loading: loadingTasks, error: taskError, refetch: refetchTasks } = usePlanningTasks(selectedSource, visibleDatabases);
  const [syncing, setSyncing] = useState(false);

  const filters = usePlanningFilters();

  // Tasks in the visible period (used to derive the people list)
  const periodTasks = useMemo<NotionTask[]>(() => {
    if (view === "agenda" || view === "tabla") return tasks;
    if (view === "semana") {
      const start = startOfWeek(cursor);
      const end = addDays(start, 7);
      return tasks.filter((t) => {
        const d = taskStartDate(t);
        return d ? d >= start && d < end : false;
      });
    }
    return tasks.filter((t) => {
      const d = taskStartDate(t);
      return d ? d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth() : false;
    });
  }, [tasks, view, cursor]);

  const people = usePeopleOptions(periodTasks.length > 0 ? periodTasks : tasks);
  const filteredTasks = useMemo(() => filters.apply(tasks), [tasks, filters]);

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

  const selectedDb = visibleDatabases.find((d) => d.id === selectedSource);

  const shift = (dir: 1 | -1) => {
    setCursor((prev) => {
      if (view === "semana") return addDays(prev, dir * 7);
      const d = new Date(prev);
      d.setDate(1);
      d.setMonth(d.getMonth() + dir);
      return d;
    });
  };

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

  const periodLabel = view === "semana" ? weekRangeLabel(cursor) : monthLabel(cursor);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="mono-cap text-[10px] text-primary">01 · PLANIFICACIÓN</p>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">Planificación</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Visor de tareas sincronizado con Notion</p>
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

      <PlanningToolbar
        view={view}
        onView={setView}
        periodLabel={periodLabel}
        showNav={view === "mes" || view === "semana"}
        onPrev={() => shift(-1)}
        onNext={() => shift(1)}
        onToday={() => setCursor(new Date())}
        databases={visibleDatabases}
        archivedDatabases={archivedDatabases}
        selectedSource={selectedSource}
        onSelectSource={setSelectedSource}
        onToggleArchive={(id) => {
          toggleArchive(id);
          toast.success(isArchived(id) ? "Fuente restaurada" : "Fuente archivada");
        }}
        status={filters.status}
        onStatus={filters.setStatus}
        people={people}
        person={filters.person}
        onPerson={filters.setPerson}
        me={filters.me}
        onSetMe={filters.setMe}
      />

      {/* Content */}
      {view === "agenda" ? (
        <PlanningAgenda tasks={filteredTasks} loading={loadingTasks} error={taskError} />
      ) : view === "tabla" ? (
        <PlanningTable tasks={filteredTasks} loading={loadingTasks} error={taskError} selectedDatabaseId={selectedSource} />
      ) : (
        <PlanningCalendar
          tasks={filteredTasks}
          loading={loadingTasks}
          error={taskError}
          cursor={cursor}
          view={view}
          notionUrl={selectedDb?.url}
        />
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight">Planificación</h1>
      <p className="text-sm text-muted-foreground">Visor de tareas sincronizado con Notion</p>
    </div>
  );
}
