import { useState } from "react";
import { Loader2, AlertTriangle, RefreshCw, ExternalLink, Database, Table, Calendar } from "lucide-react";
import { toast } from "sonner";
import { usePlanningDatabases, usePlanningTasks } from "@/hooks/usePlanningData";
import PlanningTable from "@/components/planning/PlanningTable";
import PlanningCalendar from "@/components/planning/PlanningCalendar";

export default function Planning() {
  const { databases, loading: loadingDbs, error: dbError, refetch: refetchDbs } = usePlanningDatabases();
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [view, setView] = useState<"tabla" | "calendario">("tabla");
  const { tasks, loading: loadingTasks, error: taskError, refetch: refetchTasks } = usePlanningTasks(selectedSource, databases);
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
  if (databases.length === 0) {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Planning</h2>
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

      {/* Source selector + view toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 overflow-x-auto">
          <button
            onClick={() => setSelectedSource("all")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              selectedSource === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Todas las fuentes
          </button>
          {databases.map((db) => (
            <button
              key={db.id}
              onClick={() => setSelectedSource(db.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors truncate max-w-[160px] ${
                selectedSource === db.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              title={db.name}
            >
              {db.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
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
      {view === "tabla" ? (
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
      <h2 className="text-2xl font-black tracking-tight">Planning</h2>
      <p className="text-sm text-muted-foreground">Visor de tareas sincronizado con Notion</p>
    </div>
  );
}
