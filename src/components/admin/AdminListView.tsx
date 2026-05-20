import { useMemo, useState } from "react";
import { CheckCircle, MoreVertical, Pencil, Search, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  fmtMoneyOrVariable,
  relativeDate,
} from "./adminConstants";
import { MarkPaidDialog } from "./MarkPaidDialog";
import { Link } from "react-router-dom";
import { useAdminScope } from "@/contexts/AdminScope";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  instances: ObligationInstance[];
  onRowClick: (inst: ObligationInstance) => void;
  onEdit?: (inst: ObligationInstance) => void;
  onPaid: () => void;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
}

export function AdminListView({ instances, onRowClick, onEdit, onPaid, onClearFilters, hasActiveFilters }: Props) {
  const { basePath, instances: INSTANCES_TABLE, audit: AUDIT_TABLE } = useAdminScope();
  const [paying, setPaying] = useState<ObligationInstance | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [alsoFuture, setAlsoFuture] = useState(false);

  const allSelected = useMemo(
    () => instances.length > 0 && instances.every((i) => selected.has(i.id)),
    [instances, selected],
  );

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(instances.map((i) => i.id)) : new Set());
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const ids = Array.from(selected);
      const selectedRows = instances.filter((i) => selected.has(i.id));

      // 1) Borrar las instancias seleccionadas
      const { error } = await (supabase.from(INSTANCES_TABLE as any) as any)
        .delete()
        .in("id", ids);
      if (error) throw error;

      // 2) Si está marcado, borrar también instancias futuras de las mismas obligaciones
      let futureCount = 0;
      if (alsoFuture) {
        // Por cada obligación seleccionada, borrar instancias con due_date >
        // la fecha más antigua seleccionada de esa misma obligación
        const byObligation = new Map<string, string>();
        for (const r of selectedRows) {
          if (!r.obligation_id) continue;
          const prev = byObligation.get(r.obligation_id);
          if (!prev || r.due_date < prev) byObligation.set(r.obligation_id, r.due_date);
        }
        for (const [obligationId, minDate] of byObligation) {
          const { data, error: fErr } = await (supabase.from(INSTANCES_TABLE as any) as any)
            .delete()
            .eq("obligation_id", obligationId)
            .gt("due_date", minDate)
            .select("id");
          if (fErr) throw fErr;
          futureCount += data?.length ?? 0;
        }
      }

      await (supabase.from(AUDIT_TABLE as any) as any).insert({
        action: "bulk_delete_instances",
        new_value: `${ids.length} actual(es)${alsoFuture ? ` + ${futureCount} futura(s)` : ""}`,
      });
      toast.success(
        alsoFuture
          ? `${ids.length} eliminadas (+${futureCount} futuras)`
          : `${ids.length} obligación(es) eliminada(s)`,
      );
      setSelected(new Set());
      setAlsoFuture(false);
      setConfirmOpen(false);
      onPaid();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  };

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
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 mb-2 rounded-lg border border-destructive/30 bg-destructive/5 animate-fade-in">
          <div className="text-sm font-semibold">
            {selected.size} seleccionada{selected.size === 1 ? "" : "s"}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)} className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" /> Eliminar selección
            </Button>
          </div>
        </div>
      )}

      <div className="kpi-card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase font-bold text-muted-foreground tracking-wide">
              <tr>
                <th className="px-3 py-2.5 w-[40px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => toggleAll(!!v)}
                    aria-label="Seleccionar todo"
                  />
                </th>
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
                const isChecked = selected.has(i.id);
                return (
                  <tr
                    key={i.id}
                    onClick={() => onRowClick(i)}
                    className="border-t hover:bg-accent/40 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(v) => toggleOne(i.id, !!v)}
                        aria-label="Seleccionar fila"
                      />
                    </td>
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
                      {fmtMoneyOrVariable(i.amount, i.currency)}
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
                            {onEdit && (
                              <DropdownMenuItem onClick={() => onEdit(i)}>
                                <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                              </DropdownMenuItem>
                            )}
                            {i.obligation_id && (
                              <DropdownMenuItem asChild>
                                <Link to={`${basePath}/${i.obligation_id}`}>Editar plantilla</Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                setSelected(new Set([i.id]));
                                setConfirmOpen(true);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
                            </DropdownMenuItem>
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selected.size} obligación(es)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es permanente. Las instancias seleccionadas se borrarán de la base de datos.
              Las plantillas (obligaciones recurrentes) no se eliminan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleBulkDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
