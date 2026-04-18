import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useAdminData } from "@/hooks/useAdminData";
import {
  ALL_IMPORTANCE,
  ALL_STATUSES,
  IMPORTANCE_LABEL,
  STATUS_LABEL,
} from "./adminConstants";
import type { ImportanceLevel, InstanceStatus } from "@/types/admin";

export interface ListFilters {
  monthDate: Date;
  category: string | null;
  responsible: string | null;
  status: InstanceStatus | null;
  importance: ImportanceLevel | null;
  onlyOverdue: boolean;
  next7Days: boolean;
}

interface Props {
  filters: ListFilters;
  onChange: (next: ListFilters) => void;
}

export function AdminListFilters({ filters, onChange }: Props) {
  const { fetchConfig } = useAdminData();
  const [categories, setCategories] = useState<string[]>([]);
  const [responsibles, setResponsibles] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchConfig("obligation_category"), fetchConfig("responsible").catch(() => [])]).then(
      ([cats, resps]) => {
        if (cancelled) return;
        setCategories(cats.map((c) => c.value));
        setResponsibles(resps.map((r) => r.value));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fetchConfig]);

  const monthLabel = filters.monthDate.toLocaleDateString("es-VE", { month: "long", year: "numeric" });
  const goPrev = () => {
    const d = new Date(filters.monthDate);
    d.setMonth(d.getMonth() - 1);
    onChange({ ...filters, monthDate: d });
  };
  const goNext = () => {
    const d = new Date(filters.monthDate);
    d.setMonth(d.getMonth() + 1);
    onChange({ ...filters, monthDate: d });
  };

  const hasFilters =
    !!filters.category ||
    !!filters.responsible ||
    !!filters.status ||
    !!filters.importance ||
    filters.onlyOverdue ||
    filters.next7Days;

  const clear = () =>
    onChange({
      ...filters,
      category: null,
      responsible: null,
      status: null,
      importance: null,
      onlyOverdue: false,
      next7Days: false,
    });

  return (
    <div className="kpi-card !p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-3 h-9 flex items-center min-w-[160px] justify-center text-sm font-bold uppercase border rounded-md bg-card">
            {monthLabel}
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Select
          value={filters.category ?? "_all"}
          onValueChange={(v) => onChange({ ...filters, category: v === "_all" ? null : v })}
        >
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {responsibles.length > 0 && (
          <Select
            value={filters.responsible ?? "_all"}
            onValueChange={(v) => onChange({ ...filters, responsible: v === "_all" ? null : v })}
          >
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Responsable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos</SelectItem>
              {responsibles.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={filters.status ?? "_all"}
          onValueChange={(v) => onChange({ ...filters, status: v === "_all" ? null : (v as InstanceStatus) })}
        >
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos los estados</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.importance ?? "_all"}
          onValueChange={(v) =>
            onChange({ ...filters, importance: v === "_all" ? null : (v as ImportanceLevel) })
          }
        >
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="Importancia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Toda</SelectItem>
            {ALL_IMPORTANCE.map((i) => (
              <SelectItem key={i} value={i}>{IMPORTANCE_LABEL[i]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Toggle
          pressed={filters.onlyOverdue}
          onPressedChange={(p) => onChange({ ...filters, onlyOverdue: p })}
          variant="outline"
          size="sm"
          className="h-9"
        >
          Solo vencidas
        </Toggle>
        <Toggle
          pressed={filters.next7Days}
          onPressedChange={(p) => onChange({ ...filters, next7Days: p })}
          variant="outline"
          size="sm"
          className="h-9"
        >
          Próximas 7 días
        </Toggle>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9" onClick={clear}>
            <X className="h-4 w-4" /> Limpiar
          </Button>
        )}

        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          {hasFilters ? "Filtros activos" : "Sin filtros"}
        </div>
      </div>
    </div>
  );
}
