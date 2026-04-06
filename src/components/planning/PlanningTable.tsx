import { useState, useMemo, useCallback } from "react";
import { ExternalLink, ClipboardList, Calendar as CalendarIcon, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { NotionTask } from "@/hooks/usePlanningData";

interface PlanningTableProps {
  tasks: NotionTask[];
  loading: boolean;
  error: string | null;
  selectedDatabaseId: string;
}

const NOTION_BADGE: Record<string, string> = {
  default: "bg-muted text-muted-foreground",
  gray: "bg-gray-100 text-gray-700",
  brown: "bg-amber-100 text-amber-800",
  orange: "bg-orange-100 text-orange-700",
  yellow: "bg-yellow-100 text-yellow-700",
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
  pink: "bg-pink-100 text-pink-700",
  red: "bg-red-100 text-red-700",
};

function badgeClass(color: string | undefined) {
  return NOTION_BADGE[color || "default"] || NOTION_BADGE.default;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

type SortKey = "name" | "assignee" | "status" | "date" | "priority" | "area" | "source";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = {
  "Urgente": 0, "Urgent": 0,
  "Alta": 1, "High": 1,
  "Media": 2, "Medium": 2,
  "Baja": 3, "Low": 3,
};

function compareTasks(a: NotionTask, b: NotionTask, key: SortKey, dir: SortDir): number {
  let cmp = 0;
  switch (key) {
    case "name":
      cmp = (a.name || "").localeCompare(b.name || "");
      break;
    case "assignee":
      cmp = (a.assignee[0]?.name || "zzz").localeCompare(b.assignee[0]?.name || "zzz");
      break;
    case "status":
      cmp = (a.status?.name || "zzz").localeCompare(b.status?.name || "zzz");
      break;
    case "date":
      cmp = (a.date?.start || "9999").localeCompare(b.date?.start || "9999");
      break;
    case "priority": {
      const pa = PRIORITY_ORDER[a.priority?.name || ""] ?? 99;
      const pb = PRIORITY_ORDER[b.priority?.name || ""] ?? 99;
      cmp = pa - pb;
      break;
    }
    case "area":
      cmp = (a.area || "zzz").localeCompare(b.area || "zzz");
      break;
    case "source":
      cmp = (a.database_name || "zzz").localeCompare(b.database_name || "zzz");
      break;
  }
  return dir === "desc" ? -cmp : cmp;
}

export default function PlanningTable({ tasks, loading, error, selectedDatabaseId }: PlanningTableProps) {
  const showSource = selectedDatabaseId === "all";

  // ── Filter state ──
  const [fAssignee, setFAssignee] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPriority, setFPriority] = useState("");
  const [fSource, setFSource] = useState("");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");

  // ── Sort state ──
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortKey(null); setSortDir("asc"); }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey, sortDir]);

  const hasFilters = !!(fAssignee || fStatus || fPriority || fSource || fDateFrom || fDateTo);

  const clearFilters = () => {
    setFAssignee("");
    setFStatus("");
    setFPriority("");
    setFSource("");
    setFDateFrom("");
    setFDateTo("");
  };

  // ── Unique values for dropdowns ──
  const uniqueAssignees = useMemo(() => [...new Set(tasks.flatMap((t) => t.assignee.map((a) => a.name)).filter(Boolean))].sort(), [tasks]);
  const uniqueStatuses = useMemo(() => [...new Set(tasks.map((t) => t.status?.name).filter(Boolean) as string[])].sort(), [tasks]);
  const uniquePriorities = useMemo(() => [...new Set(tasks.map((t) => t.priority?.name).filter(Boolean) as string[])].sort(), [tasks]);
  const uniqueSources = useMemo(() => [...new Set(tasks.map((t) => t.database_name).filter(Boolean))].sort(), [tasks]);

  // ── Filtered + sorted tasks ──
  const filtered = useMemo(() => {
    const f = tasks.filter((t) => {
      if (fAssignee && !t.assignee.some((a) => a.name === fAssignee)) return false;
      if (fStatus && t.status?.name !== fStatus) return false;
      if (fPriority && t.priority?.name !== fPriority) return false;
      if (fSource && t.database_name !== fSource) return false;
      if (fDateFrom && (!t.date?.start || t.date.start < fDateFrom)) return false;
      if (fDateTo && (!t.date?.start || t.date.start > fDateTo)) return false;
      return true;
    });
    if (sortKey) {
      return [...f].sort((a, b) => compareTasks(a, b, sortKey, sortDir));
    }
    return f;
  }, [tasks, fAssignee, fStatus, fPriority, fSource, fDateFrom, fDateTo, sortKey, sortDir]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="kpi-card overflow-hidden animate-fade-in">
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 items-center">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 w-[80px]" />
              <Skeleton className="h-4 w-[60px]" />
              <Skeleton className="h-4 w-[70px]" />
              <Skeleton className="h-4 w-[50px]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="bg-[hsl(var(--status-error)/0.1)] border border-[hsl(var(--status-error)/0.2)] rounded-lg p-4">
        <p className="text-sm font-bold text-[hsl(var(--status-error))]">{error}</p>
      </div>
    );
  }

  // ── No tasks at all ──
  if (tasks.length === 0) {
    return (
      <div className="kpi-card p-8 text-center animate-fade-in">
        <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <h3 className="text-base font-bold mb-1">No hay tareas en esta fuente</h3>
        <p className="text-sm text-muted-foreground">Las tareas se gestionan directamente en Notion</p>
      </div>
    );
  }

  const selectClass = "text-xs border border-border rounded-md px-2.5 py-1.5 bg-card font-semibold focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={fAssignee} onChange={(e) => setFAssignee(e.target.value)} className={selectClass}>
          <option value="">Asignado a</option>
          {uniqueAssignees.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selectClass}>
          <option value="">Estado</option>
          {uniqueStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={fPriority} onChange={(e) => setFPriority(e.target.value)} className={selectClass}>
          <option value="">Prioridad</option>
          {uniquePriorities.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        {showSource && (
          <select value={fSource} onChange={(e) => setFSource(e.target.value)} className={selectClass}>
            <option value="">Fuente</option>
            {uniqueSources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        <div className="flex items-center gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <input type="date" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)} className={`${selectClass} w-[130px]`} />
          <span className="text-xs text-muted-foreground">→</span>
          <input type="date" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)} className={`${selectClass} w-[130px]`} />
        </div>

        {hasFilters && (
          <button onClick={clearFilters} className="text-xs font-semibold text-primary hover:underline ml-1">
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="kpi-card p-8 text-center">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-bold mb-1">No hay tareas que coincidan con los filtros</h3>
          <button onClick={clearFilters} className="text-xs font-semibold text-primary hover:underline mt-2">Limpiar filtros</button>
        </div>
      ) : (
        <div className="kpi-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {([
                    ["name", "Nombre"],
                    ["assignee", "Asignado a"],
                    ["status", "Estado"],
                    ["date", "Fecha"],
                    ["priority", "Prioridad"],
                    ["area", "Área"],
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <th
                      key={key}
                      onClick={() => toggleSort(key)}
                      className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-left py-3 px-4 cursor-pointer select-none hover:text-foreground transition-colors"
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {sortKey === key ? (
                          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </span>
                    </th>
                  ))}
                  {showSource && (
                    <th
                      onClick={() => toggleSort("source")}
                      className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-left py-3 px-4 cursor-pointer select-none hover:text-foreground transition-colors"
                    >
                      <span className="inline-flex items-center gap-1">
                        Fuente
                        {sortKey === "source" ? (
                          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </span>
                    </th>
                  )}
                  <th className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center py-3 px-4 w-10">Notion</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((task) => (
                  <tr key={task.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    {/* Name */}
                    <td className="py-3 px-4 max-w-[280px]">
                      <span className="font-semibold leading-snug truncate block">{task.name || "Sin título"}</span>
                    </td>

                    {/* Assignee */}
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

                    {/* Status */}
                    <td className="py-3 px-4">
                      {task.status ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${badgeClass(task.status.color)}`}>
                          {task.status.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {task.date?.start ? fmtDate(task.date.start) : "Sin fecha"}
                    </td>

                    {/* Priority */}
                    <td className="py-3 px-4">
                      {task.priority ? (
                        <span className={`text-xs font-semibold rounded px-2 py-0.5 ${badgeClass(task.priority.color)}`}>
                          {task.priority.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Area */}
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {task.area || <span className="text-muted-foreground/50">—</span>}
                    </td>

                    {/* Source */}
                    {showSource && (
                      <td className="py-3 px-4 text-xs text-muted-foreground truncate max-w-[140px]" title={task.database_name}>
                        {task.database_name}
                      </td>
                    )}

                    {/* Notion link */}
                    <td className="py-3 px-4 text-center">
                      <a href={task.notion_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                        <ExternalLink className="h-3.5 w-3.5 inline" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
