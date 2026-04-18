import { useState } from "react";
import { DollarSign, User, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/hooks/useCrewAudit";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

interface SalaryEntry {
  id: string;
  employee_id: string;
  effective_date: string;
  base_salary: number;
  bonus: number;
  commission: number;
  reason: string;
  approved_by: string | null;
  observations: string | null;
  created_at: string;
}

export function CrewSalaryHistory({ employeeId, currentSalary }: { employeeId: string; currentSalary: number | null }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["salary_history", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_history")
        .select("*")
        .eq("employee_id", employeeId)
        .order("effective_date", { ascending: false });
      if (error) throw error;
      return data as SalaryEntry[];
    },
  });

  const insertMutation = useMutation({
    mutationFn: async (entry: Omit<SalaryEntry, "id" | "created_at">) => {
      const { error } = await supabase.from("salary_history").insert(entry);
      if (error) throw error;
      logAudit({
        employee_id: entry.employee_id,
        action: "Cambió sueldo",
        old_value: currentSalary ? `$${currentSalary}` : undefined,
        new_value: `$${entry.base_salary}`,
        field_changed: entry.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary_history", employeeId] });
      toast.success("Registro salarial guardado");
      setSheetOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="kpi-card space-y-4 p-6">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {currentSalary != null && (
        <div className="kpi-card p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Salario actual</h2>
          <p className="text-2xl font-black tracking-tight mt-1">${currentSalary.toLocaleString("es-VE")}</p>
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />Registrar ajuste salarial
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="kpi-card">
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <DollarSign className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-muted-foreground">Sin historial salarial registrado</p>
          </div>
        </div>
      ) : (
        <div className="kpi-card p-6">
          <div className="relative border-l-2 border-border pl-6 space-y-6">
            {entries.map((entry) => (
              <div key={entry.id} className="relative">
                <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                <div className="space-y-1">
                  <p className="font-semibold text-sm">
                    {new Date(entry.effective_date).toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                  <p className="text-xl font-black tracking-tight">${entry.base_salary.toLocaleString("es-VE")}</p>
                  <div className="flex flex-wrap gap-2">
                    {entry.bonus > 0 && (
                      <span className="text-xs bg-muted rounded-full px-2 py-0.5 font-medium">Bono: ${entry.bonus.toLocaleString("es-VE")}</span>
                    )}
                    {entry.commission > 0 && (
                      <span className="text-xs bg-muted rounded-full px-2 py-0.5 font-medium">Comisión: ${entry.commission.toLocaleString("es-VE")}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{entry.reason}</p>
                  {entry.approved_by && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />{entry.approved_by}
                    </p>
                  )}
                  {entry.observations && <p className="text-xs text-muted-foreground italic">{entry.observations}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AddSalarySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        employeeId={employeeId}
        currentSalary={currentSalary}
        onSave={(data) => insertMutation.mutate(data)}
        saving={insertMutation.isPending}
      />
    </div>
  );
}

function AddSalarySheet({ open, onOpenChange, employeeId, currentSalary, onSave, saving }: {
  open: boolean; onOpenChange: (v: boolean) => void; employeeId: string; currentSalary: number | null;
  onSave: (data: Omit<SalaryEntry, "id" | "created_at">) => void; saving: boolean;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [baseSalary, setBaseSalary] = useState(currentSalary?.toString() || "");
  const [bonus, setBonus] = useState("0");
  const [commission, setCommission] = useState("0");
  const [reason, setReason] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [observations, setObservations] = useState("");

  const reset = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setBaseSalary(currentSalary?.toString() || "");
    setBonus("0"); setCommission("0"); setReason(""); setApprovedBy(""); setObservations("");
  };

  const handleSave = () => {
    if (!reason.trim()) { toast.error("El motivo es requerido"); return; }
    if (!baseSalary || isNaN(Number(baseSalary))) { toast.error("Sueldo base inválido"); return; }
    onSave({
      employee_id: employeeId,
      effective_date: date,
      base_salary: Number(baseSalary),
      bonus: Number(bonus) || 0,
      commission: Number(commission) || 0,
      reason: reason.trim(),
      approved_by: approvedBy.trim() || null,
      observations: observations.trim() || null,
    });
    reset();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>Registrar ajuste salarial</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fecha</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sueldo base ($)</label>
            <Input type="number" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bono ($)</label>
              <Input type="number" value={bonus} onChange={(e) => setBonus(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Comisión ($)</label>
              <Input type="number" value={commission} onChange={(e) => setCommission(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Motivo del ajuste</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1" placeholder="Ej: Aumento semestral" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Aprobado por</label>
            <Input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Observaciones</label>
            <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} className="mt-1" rows={3} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Guardando…" : "Guardar registro"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
