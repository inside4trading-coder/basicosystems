import { useEffect, useState } from "react";
import { Clock, User, Plus, X, CheckSquare, Pencil, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { RecurringTask } from "@/types/crew";

interface CrewRecurringTasksProps {
  tasks: RecurringTask[];
  onAdd: (task: RecurringTask) => void;
  onUpdate: (taskId: string, patch: Partial<RecurringTask>) => void;
  onToggle: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onReorder: (taskId: string, direction: "up" | "down") => void;
}

const priorityDot: Record<string, string> = {
  low: "bg-[hsl(var(--status-success))]",
  medium: "bg-[hsl(var(--status-warning))]",
  high: "bg-[hsl(var(--status-error))]",
};

const freqLabel: Record<string, string> = {
  daily: "Diaria",
  weekly: "Semanal",
  monthly: "Mensual",
};

export function CrewRecurringTasks({ tasks, onAdd, onUpdate, onToggle, onDelete, onReorder }: CrewRecurringTasksProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTask | null>(null);

  const openEdit = (t: RecurringTask) => {
    setEditing(t);
    setSheetOpen(true);
  };

  const openAdd = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  if (tasks.length === 0 && !sheetOpen) {
    return (
      <div className="kpi-card">
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <CheckSquare className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-muted-foreground">Sin tareas recurrentes asignadas</p>
          <p className="text-xs text-muted-foreground/70">Solo los admins pueden gestionar las tareas recurrentes de cada empleado</p>
          <Button size="sm" className="mt-3" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" />Agregar tarea
          </Button>
        </div>
        <TaskSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          editing={editing}
          onSaveNew={onAdd}
          onSaveEdit={onUpdate}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {tasks.map((t, idx) => (
          <div key={t.id} className="kpi-card flex items-center gap-3">
            {/* Reorder controls */}
            <div className="flex flex-col gap-0.5 shrink-0">
              <button
                onClick={() => onReorder(t.id, "up")}
                disabled={idx === 0}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Subir"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onReorder(t.id, "down")}
                disabled={idx === tasks.length - 1}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Bajar"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Priority dot */}
            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${priorityDot[t.priority] ?? priorityDot.low}`} />

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">{t.name}</p>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{freqLabel[t.frequency]}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t.day} · {t.time}</span>
                {t.area && <span>{t.area}</span>}
                {t.responsible && <span className="flex items-center gap-1"><User className="h-3 w-3" />{t.responsible}</span>}
              </div>
            </div>

            {/* Toggle + edit + delete */}
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={t.active} onCheckedChange={() => onToggle(t.id)} />
              <button
                onClick={() => openEdit(t)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(t.id)}
                className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Eliminar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={openAdd}>
        <Plus className="h-4 w-4 mr-1" />Agregar tarea
      </Button>

      <TaskSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editing={editing}
        onSaveNew={onAdd}
        onSaveEdit={onUpdate}
      />
    </div>
  );
}

function TaskSheet({
  open,
  onOpenChange,
  editing,
  onSaveNew,
  onSaveEdit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: RecurringTask | null;
  onSaveNew: (task: RecurringTask) => void;
  onSaveEdit: (taskId: string, patch: Partial<RecurringTask>) => void;
}) {
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("09:00");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [area, setArea] = useState("");
  const [responsible, setResponsible] = useState("");
  const [active, setActive] = useState(true);

  const reset = () => {
    setName(""); setFrequency("daily"); setDay(""); setTime("09:00");
    setPriority("medium"); setArea(""); setResponsible(""); setActive(true);
  };

  // Hydrate when opening for edit
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setFrequency(editing.frequency);
      setDay(editing.day);
      setTime(editing.time || "09:00");
      setPriority(editing.priority);
      setArea(editing.area);
      setResponsible(editing.responsible);
      setActive(editing.active);
    } else {
      reset();
    }
  }, [open, editing]);

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("El nombre de la tarea es requerido");
      return;
    }
    const payload = {
      name: name.trim(),
      frequency,
      day: day.trim(),
      time,
      priority,
      area: area.trim(),
      responsible: responsible.trim(),
      active,
    };
    if (editing) {
      onSaveEdit(editing.id, payload);
      toast.success("Tarea actualizada");
    } else {
      onSaveNew({ id: crypto.randomUUID(), ...payload });
      toast.success("Tarea agregada");
    }
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg font-black tracking-tight">
            {editing ? "Editar tarea recurrente" : "Agregar tarea recurrente"}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre de la tarea *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Frecuencia</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diaria</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Día</Label>
              <Input value={day} onChange={(e) => setDay(e.target.value)} placeholder="Ej: Lunes, 15 de cada mes" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hora</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Área</Label>
            <Input value={area} onChange={(e) => setArea(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Responsable</Label>
            <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Activa</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { onOpenChange(false); reset(); }}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave}>{editing ? "Guardar cambios" : "Guardar"}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
