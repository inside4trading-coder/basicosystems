import { useState } from "react";
import { CheckCircle, MoreVertical, Pencil, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ObligationInstance } from "@/types/admin";
import { computeUrgency } from "@/types/admin";
import { parseLocalDate } from "@/lib/dateUtils";
import {
  IMPORTANCE_BADGE,
  IMPORTANCE_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
  URGENCY_BADGE,
  URGENCY_LABEL,
  fmtMoney,
  relativeDate,
} from "./adminConstants";
import { MarkPaidDialog } from "./MarkPaidDialog";
import { Link } from "react-router-dom";

interface Props {
  instances: ObligationInstance[];
  onRowClick: (inst: ObligationInstance) => void;
  onPaid: () => void;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
}

export function AdminListView({ instances, onRowClick, onPaid, onClearFilters, hasActiveFilters }: Props) {
  const [paying, setPaying] = useState<ObligationInstance | null>(null);

  if (instances.length === 0) {
    return (
      <div className="kpi-card text-center py-16 animate-fade-in">
        <Search className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold">Sin resultados para estos filtros</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Ajusta los filtros o el mes seleccionado para ver obligaciones.
        </p>
        {hasActiveFilters && onClearFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Limpiar filtros
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="kpi-card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase font-bold text-muted-foreground tracking-wide">
              <tr>
                <th className="text-left px-3 py-2.5">Vencimiento</th>
                <th className="text-left px-3 py-2.5">Obligación</th>
                <th className="text-left px-3 py-2.5">Proveedor</th>
                <th className="text-left px-3 py-2.5">Responsable</th>
                <th className="text-left px-3 py-2.5">Importancia</th>
                <th className="text-left px-3 py-2.5">Urgencia</th>
                <th className="text-right px-3 py-2.5">Monto</th>
                <th className="text-left px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5 w-[120px]"></th>
              </tr>
            </thead>
            <tbody>
              {instances.map((i) => {
                const urgency = i.urgency ?? computeUrgency(i.due_date);
                const due = parseLocalDate(i.due_date);
                return (
                  <tr
                    key={i.id}
                    onClick={() => onRowClick(i)}
                    className="border-t hover:bg-accent/40 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="font-bold">
                        {due.toLocaleDateString("es-VE", { day: "2-digit", month: "short" })}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{relativeDate(i.due_date)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold">{i.obligation_name ?? "—"}</div>
                      {i.category && (
                        <div className="text-[11px] text-muted-foreground">{i.category}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{i.provider ?? "—"}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {i.responsible || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {i.importance ? (
                        <span className={IMPORTANCE_BADGE[i.importance]}>{IMPORTANCE_LABEL[i.importance]}</span>
                      ) : (
                        <Badge variant="outline">—</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={URGENCY_BADGE[urgency]}>{URGENCY_LABEL[urgency]}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold">
                      {fmtMoney(i.amount, i.currency)}
                    </td>
                    <td className="px-3 py-3">
                      <span className={STATUS_BADGE[i.status]}>{STATUS_LABEL[i.status]}</span>
                    </td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {i.status !== "pagado" && i.status !== "anulado" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1"
                            onClick={() => setPaying(i)}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">Pagado</span>
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onRowClick(i)}>Ver detalle</DropdownMenuItem>
                            {i.obligation_id && (
                              <DropdownMenuItem asChild>
                                <Link to={`/administracion/${i.obligation_id}`}>Editar plantilla</Link>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <MarkPaidDialog
        instance={paying}
        open={!!paying}
        onOpenChange={(v) => !v && setPaying(null)}
        onSaved={() => {
          setPaying(null);
          onPaid();
        }}
      />
    </>
  );
}
