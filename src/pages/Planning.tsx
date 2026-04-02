import { useState } from "react";
import { Loader2, AlertTriangle, RefreshCw, ExternalLink, Database, Table, Calendar } from "lucide-react";
import { toast } from "sonner";
import { usePlanningDatabases, usePlanningTasks } from "@/hooks/usePlanningData";
import type { NotionTask } from "@/hooks/usePlanningData";

// ── Notion color → HSL map ──
const NOTION_COLORS: Record<string, string> = {
  default: "hsl(0 0% 64%)",
  gray: "hsl(0 0% 64%)",
  brown: "hsl(25 50% 45%)",
  orange: "hsl(25 95% 53%)",
  yellow: "hsl(45 93% 47%)",
  green: "hsl(142 71% 45%)",
  blue: "hsl(217 91% 60%)",
  purple: "hsl(263 70% 50%)",
  pink: "hsl(330 81% 60%)",
  red: "hsl(354 100% 44%)",
};

function notionColor(color: string | undefined): string {
  return NOTION_COLORS[color || "default"] || NOTION_COLORS.default;
}

// ── Planning Table ──
function PlanningTable({ tasks, loading, error }: { tasks: NotionTask[]; loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-sm text-muted-foreground font-semibold">Cargando tareas…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[hsl(var(--status-error)/0.1)] border border-[hsl(var(--status-error)/0.2)] rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-error))]" />
          <p className="text-sm font-bold text-[hsl(var(--status-error))]">{error}</p>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Table className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-semibold">No hay tareas en esta fuente</p>
      </div>
    );
  }

  return (
    <div className="kpi-card overflow-hidden animate-fade-in">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-left py-3 px-4">Tarea</th>
              <th className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-left py-3 px-4">Estado</th>
              <th className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-left py-3 px-4">Prioridad</th>
              <th className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-left py-3 px-4">Responsable</th>
              <th className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-left py-3 px-4">Fecha</th>
              <th className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-left py-3 px-4">Fuente</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-4">
                  <a
                    href={task.notion_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold hover:text-primary transition-colors leading-snug"
                  >
                    {task.name || "Sin título"}
                  </a>
                  {task.area && (
                    <span className="ml-2 text-[11px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">{task.area}</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {task.status ? (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1"
                      style={{ backgroundColor: `${notionColor(task.status.color)}20`, color: notionColor(task.status.color) }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: notionColor(task.status.color) }} />
                      {task.status.name}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {task.priority ? (
                    <span
                      className="text-xs font-semibold rounded px-2 py-0.5"
                      style={{ backgroundColor: `${notionColor(task.priority.color)}20`, color: notionColor(task.priority.color) }}
                    >
                      {task.priority.name}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {task.assignee.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      {task.assignee.slice(0, 3).map((a, i) =>
                        a.avatar_url ? (
                          <img key={i} src={a.avatar_url} alt={a.name} title={a.name} className="w-6 h-6 rounded-full border-2 border-card object-cover" />
                        ) : (
                          <span key={i} title={a.name} className="w-6 h-6 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center border-2 border-card">
                            {a.name?.charAt(0)?.toUpperCase() || "?"}
                          </span>
                        )
                      )}
                      {task.assignee.length > 3 && (
                        <span className="text-[10px] text-muted-foreground font-semibold">+{task.assignee.length - 3}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                  {task.date?.start ? fmtDate(task.date.start) : "—"}
                  {task.date?.end ? ` → ${fmtDate(task.date.end)}` : ""}
                </td>
                <td className="py-3 px-4 text-xs text-muted-foreground truncate max-w-[140px]" title={task.database_name}>
                  {task.database_name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Planning Calendar ──
function PlanningCalendar({ tasks, loading, error }: { tasks: NotionTask[]; loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-sm text-muted-foreground font-semibold">Cargando tareas…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[hsl(var(--status-error)/0.1)] border border-[hsl(var(--status-error)/0.2)] rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-error))]" />
          <p className="text-sm font-bold text-[hsl(var(--status-error))]">{error}</p>
        </div>
      </div>
    );
  }

  const tasksWithDate = tasks.filter((t) => t.date?.start);
  if (tasksWithDate.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-semibold">No hay tareas con fecha asignada</p>
      </div>
    );
  }

  // Group by week
  const grouped: Record<string, NotionTask[]> = {};
  for (const t of tasksWithDate) {
    const d = new Date(t.date!.start!);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay() + 1);
    const key = weekStart.toISOString().slice(0, 10);
    (grouped[key] ||= []).push(t);
  }

  const sortedWeeks = Object.keys(grouped).sort();

  return (
    <div className="space-y-6 animate-fade-in">
      {sortedWeeks.map((week) => (
        <div key={week} className="kpi-card p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Semana del {fmtDate(week)}
          </h4>
          <div className="space-y-2">
            {grouped[week].sort((a, b) => (a.date!.start! > b.date!.start! ? 1 : -1)).map((task) => (
              <a
                key={task.id}
                href={task.notion_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <span className="text-xs text-muted-foreground font-semibold whitespace-nowrap w-16">
                  {fmtDate(task.date!.start!)}
                </span>
                {task.status && (
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: notionColor(task.status.color) }} />
                )}
                <span className="text-sm font-semibold truncate flex-1">{task.name}</span>
                {task.assignee.length > 0 && (
                  <div className="flex -space-x-1">
                    {task.assignee.slice(0, 2).map((a, i) =>
                      a.avatar_url ? (
                        <img key={i} src={a.avatar_url} alt={a.name} className="w-5 h-5 rounded-full border border-card" />
                      ) : (
                        <span key={i} className="w-5 h-5 rounded-full bg-secondary text-secondary-foreground text-[9px] font-bold flex items-center justify-center border border-card">
                          {a.name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      )
                    )}
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ──
function fmtDate(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

// ── Page ──
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
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setSelectedSource("all")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
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
        <PlanningTable tasks={tasks} loading={loadingTasks} error={taskError} />
      ) : (
        <PlanningCalendar tasks={tasks} loading={loadingTasks} error={taskError} />
      )}
    </div>
  );
}

// Extracted to avoid repeating in early-return states
function Header() {
  return (
    <div>
      <h2 className="text-2xl font-black tracking-tight">Planning</h2>
      <p className="text-sm text-muted-foreground">Visor de tareas sincronizado con Notion</p>
    </div>
  );
}
