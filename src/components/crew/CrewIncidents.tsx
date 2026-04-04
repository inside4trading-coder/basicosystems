import { useState } from "react";
import { Calendar, User, FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/hooks/useCrewAudit";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

interface Incident {
  id: string;
  employee_id: string;
  employee_name: string;
  incident_date: string;
  type: "positive" | "negative";
  category: string;
  reason: string;
  registered_by: string | null;
  observation: string | null;
  created_at: string;
}

const categories = ["Puntualidad", "Rendimiento", "Actitud", "Logro", "Comunicación", "Otro"];

export function CrewIncidents({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["incidents", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .eq("employee_id", employeeId)
        .order("incident_date", { ascending: false });
      if (error) throw error;
      return data as Incident[];
    },
  });

  const insertMutation = useMutation({
    mutationFn: async (incident: Omit<Incident, "id" | "created_at">) => {
      const { error } = await supabase.from("incidents").insert(incident);
      if (error) throw error;
      logAudit({ employee_id: incident.employee_id, action: "Registró incidencia", new_value: `${incident.type === "positive" ? "Positiva" : "Negativa"} — ${incident.category}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents", employeeId] });
      toast.success("Incidencia registrada");
      setSheetOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="kpi-card space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />Registrar incidencia
        </Button>
      </div>

      {incidents.length === 0 ? (
        <div className="kpi-card">
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <FileText className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-muted-foreground">Sin incidencias registradas</p>
            <p className="text-xs text-muted-foreground/70">Las incidencias positivas y negativas aparecerán aquí</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => (
            <div key={inc.id} className="kpi-card flex overflow-hidden">
              <div className={`w-1.5 shrink-0 rounded-l-lg ${inc.type === "positive" ? "bg-status-success" : "bg-status-error"}`} />
              <div className="flex-1 p-4 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={inc.type === "positive" ? "status-badge-success" : "status-badge-error"}>
                    {inc.type === "positive" ? "Positiva" : "Negativa"}
                  </span>
                  <span className="text-xs border border-border rounded-full px-2 py-0.5 font-medium">{inc.category}</span>
                </div>
                <p className="font-semibold text-sm">{inc.reason}</p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(inc.incident_date).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  {inc.registered_by && <span className="flex items-center gap-1"><User className="h-3 w-3" />{inc.registered_by}</span>}
                </div>
                {inc.observation && <p className="text-xs text-muted-foreground italic">{inc.observation}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddIncidentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        employeeId={employeeId}
        employeeName={employeeName}
        onSave={(data) => insertMutation.mutate(data)}
        saving={insertMutation.isPending}
      />
    </div>
  );
}

function AddIncidentSheet({
  open, onOpenChange, employeeId, employeeName, onSave, saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId: string;
  employeeName: string;
  onSave: (data: Omit<Incident, "id" | "created_at">) => void;
  saving: boolean;
}) {
  const [type, setType] = useState<"positive" | "negative">("negative");
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [registeredBy, setRegisteredBy] = useState("");
  const [observation, setObservation] = useState("");

  const reset = () => {
    setType("negative"); setCategory(""); setReason("");
    setDate(new Date().toISOString().slice(0, 10));
    setRegisteredBy(""); setObservation("");
  };

  const handleSave = () => {
    if (!reason.trim()) { toast.error("El motivo es requerido"); return; }
    if (!category) { toast.error("Selecciona una categoría"); return; }
    onSave({
      employee_id: employeeId,
      employee_name: employeeName,
      incident_date: date,
      type,
      category,
      reason: reason.trim().slice(0, 120),
      registered_by: registeredBy.trim() || null,
      observation: observation.trim() || null,
    });
    reset();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>Registrar incidencia</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Empleado</label>
            <Input value={employeeName} disabled className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fecha</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo</label>
            <div className="flex gap-2 mt-1">
              <Button size="sm" variant={type === "positive" ? "default" : "outline"} onClick={() => setType("positive")}>Positiva</Button>
              <Button size="sm" variant={type === "negative" ? "destructive" : "outline"} onClick={() => setType("negative")}>Negativa</Button>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Categoría</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Motivo</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} placeholder="Máx. 120 caracteres" className="mt-1" />
            <p className="text-[10px] text-muted-foreground text-right mt-0.5">{reason.length}/120</p>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Registrado por</label>
            <Input value={registeredBy} onChange={(e) => setRegisteredBy(e.target.value)} placeholder="Nombre de quien registra" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Observación</label>
            <Textarea value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Opcional" className="mt-1" rows={3} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Guardando…" : "Guardar incidencia"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
