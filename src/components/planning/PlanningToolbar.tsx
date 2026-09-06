import { ChevronLeft, ChevronRight, ListChecks, Table as TableIcon, CalendarDays, Calendar, User, Archive, ArchiveRestore, Check } from "lucide-react";
import type { NotionDatabase } from "@/hooks/usePlanningData";
import type { StatusFilter } from "@/hooks/usePlanningFilters";
import { statusVisual, type DerivedStatus } from "@/lib/planningStatus";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type PlanningView = "agenda" | "semana" | "mes" | "tabla";

const VIEWS: { key: PlanningView; label: string; icon: typeof ListChecks }[] = [
  { key: "agenda", label: "Agenda", icon: ListChecks },
  { key: "semana", label: "Semana", icon: CalendarDays },
  { key: "mes", label: "Mes", icon: Calendar },
  { key: "tabla", label: "Tabla", icon: TableIcon },
];

const STATUSES: DerivedStatus[] = ["done", "in_progress", "pending", "overdue", "delegated", "no_date"];

interface Props {
  view: PlanningView;
  onView: (v: PlanningView) => void;
  periodLabel: string;
  showNav: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  databases: NotionDatabase[];
  archivedDatabases: NotionDatabase[];
  selectedSource: string;
  onSelectSource: (id: string) => void;
  onToggleArchive: (id: string) => void;
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  people: string[];
  person: string | "all";
  onPerson: (p: string | "all") => void;
  me: string | null;
  onSetMe: (name: string | null) => void;
}

export default function PlanningToolbar(props: Props) {
  const {
    view, onView, periodLabel, showNav, onPrev, onNext, onToday,
    databases, archivedDatabases, selectedSource, onSelectSource, onToggleArchive,
    status, onStatus, people, person, onPerson, me, onSetMe,
  } = props;

  const sourceLabel =
    selectedSource === "all" ? "Todas las fuentes" : databases.find((d) => d.id === selectedSource)?.name ?? "Fuente";
  const statusLabel = status === "all" ? "Todos los estados" : statusVisual(status).label;
  const personLabel = person === "all" ? "Todas las personas" : person;

  const handleMine = () => {
    if (me && people.includes(me)) onPerson(me);
    else if (me) onPerson(me);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {showNav ? (
          <div className="flex items-center gap-1">
            <button
              onClick={onPrev}
              aria-label="Anterior"
              className="h-8 w-8 rounded-md border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-black capitalize min-w-[190px] text-center">{periodLabel}</span>
            <button
              onClick={onNext}
              aria-label="Siguiente"
              className="h-8 w-8 rounded-md border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={onToday}
              className="ml-1 h-8 px-3 rounded-md border border-border text-xs font-bold hover:bg-muted transition-colors"
            >
              Hoy
            </button>
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => onView(v.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
                view === v.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <v.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Fuente */}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs font-semibold hover:bg-muted transition-colors max-w-[220px]">
            <span className="truncate">Fuente: {sourceLabel}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 max-h-[60vh] overflow-y-auto bg-popover z-50">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Fuentes activas</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onSelectSource("all")}>
              <Check className={cn("h-3.5 w-3.5 mr-2", selectedSource === "all" ? "opacity-100" : "opacity-0")} />
              Todas las fuentes
            </DropdownMenuItem>
            {databases.map((db) => (
              <DropdownMenuItem
                key={db.id}
                onClick={() => onSelectSource(db.id)}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex items-center min-w-0">
                  <Check className={cn("h-3.5 w-3.5 mr-2 flex-shrink-0", selectedSource === db.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{db.name}</span>
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onToggleArchive(db.id);
                  }}
                  title="Archivar fuente"
                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
            {archivedDatabases.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">
                  Archivadas ({archivedDatabases.length})
                </DropdownMenuLabel>
                {archivedDatabases.map((db) => (
                  <DropdownMenuItem
                    key={db.id}
                    onClick={(e) => {
                      e.preventDefault();
                      onToggleArchive(db.id);
                    }}
                    className="flex items-center justify-between gap-2 text-muted-foreground"
                  >
                    <span className="truncate pl-5">{db.name}</span>
                    <ArchiveRestore className="h-3.5 w-3.5 flex-shrink-0" />
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Estado */}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs font-semibold hover:bg-muted transition-colors">
            <span className="truncate">Estado: {statusLabel}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-popover z-50">
            <DropdownMenuItem onClick={() => onStatus("all")}>
              <Check className={cn("h-3.5 w-3.5 mr-2", status === "all" ? "opacity-100" : "opacity-0")} />
              Todos los estados
            </DropdownMenuItem>
            {STATUSES.map((s) => {
              const v = statusVisual(s);
              return (
                <DropdownMenuItem key={s} onClick={() => onStatus(s)}>
                  <Check className={cn("h-3.5 w-3.5 mr-2", status === s ? "opacity-100" : "opacity-0")} />
                  <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: v.dot }} />
                  {v.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Persona */}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs font-semibold hover:bg-muted transition-colors max-w-[220px]">
            <User className="h-3.5 w-3.5" />
            <span className="truncate">{personLabel}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60 max-h-[60vh] overflow-y-auto bg-popover z-50">
            <DropdownMenuItem onClick={() => onPerson("all")}>
              <Check className={cn("h-3.5 w-3.5 mr-2", person === "all" ? "opacity-100" : "opacity-0")} />
              Todas las personas
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">
              Personas etiquetadas
            </DropdownMenuLabel>
            {people.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">Nadie etiquetado en este período</div>
            )}
            {people.map((p) => (
              <DropdownMenuItem key={p} onClick={() => onPerson(p)} className="flex items-center justify-between gap-2">
                <span className="flex items-center min-w-0">
                  <Check className={cn("h-3.5 w-3.5 mr-2 flex-shrink-0", person === p ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{p}</span>
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onSetMe(me === p ? null : p);
                  }}
                  title={me === p ? "Ya no soy yo" : "Soy yo"}
                  className={cn(
                    "text-[9px] font-bold uppercase rounded px-1.5 py-0.5 flex-shrink-0",
                    me === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {me === p ? "Soy yo" : "Soy yo?"}
                </button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {me && (
          <button
            onClick={handleMine}
            className={cn(
              "h-8 px-3 rounded-md text-xs font-bold transition-colors",
              person === me ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted",
            )}
          >
            Mis tareas
          </button>
        )}

        {person !== "all" && (
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary/10 text-primary text-xs font-bold">
            Viendo tareas de: {person}
            <button onClick={() => onPerson("all")} aria-label="Quitar filtro de persona" className="hover:opacity-70">
              ×
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
