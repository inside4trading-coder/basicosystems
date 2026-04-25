import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, MapPin, Calendar, Pencil, MoreVertical,
  AlertTriangle, GraduationCap, Archive, Trash2, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCrewData } from "@/hooks/useCrewData";
import { logAudit, logFieldChanges } from "@/hooks/useCrewAudit";
import { CrewGeneralData } from "@/components/crew/CrewGeneralData";
import { CrewRecurringTasks } from "@/components/crew/CrewRecurringTasks";
import { CrewIncidents } from "@/components/crew/CrewIncidents";
import { CrewDocuments } from "@/components/crew/CrewDocuments";
import { CrewSalaryHistory } from "@/components/crew/CrewSalaryHistory";
import { CrewPrivateNotes } from "@/components/crew/CrewPrivateNotes";
import { CrewAuditLog } from "@/components/crew/CrewAuditLog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Employee, EmployeeStatus, RecurringTask } from "@/types/crew";

const statusConfig: Record<EmployeeStatus, { label: string; className: string }> = {
  active: { label: "Activo", className: "status-badge-success" },
  inactive: { label: "Inactivo", className: "status-badge-warning" },
  archived: { label: "Archivado", className: "status-badge-inactive" },
  graduated: { label: "Egresado", className: "status-badge-inactive" },
};

export default function CrewProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    employees, loading, updateEmployee, deleteEmployee, changeStatus,
    addRecurringTask, updateRecurringTask, toggleRecurringTask, deleteRecurringTask, reorderRecurringTask,
  } = useCrewData();

  const employee = employees.find((e) => e.id === id);

  const [editing, setEditing] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<Partial<Employee>>({});
  const [archiveDialog, setArchiveDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [resolvedPhotoUrl, setResolvedPhotoUrl] = useState<string | null>(null);

  // Resolve photo URL from storage path
  useEffect(() => {
    if (!employee?.photo_url) { setResolvedPhotoUrl(null); return; }
    if (employee.photo_url.startsWith("http") || employee.photo_url.startsWith("blob:")) {
      setResolvedPhotoUrl(employee.photo_url);
      return;
    }
    supabase.storage.from("crew-documents").createSignedUrl(employee.photo_url, 3600)
      .then(({ data }) => setResolvedPhotoUrl(data?.signedUrl ?? null));
  }, [employee?.photo_url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3 animate-fade-in">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">Empleado no encontrado</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/crew")}>Volver a Crew</Button>
      </div>
    );
  }

  const st = statusConfig[employee.status];
  const fullName = `${employee.first_name} ${employee.last_name}`;

  const startEditing = () => { setPendingUpdates({}); setEditing(true); };
  const cancelEditing = () => { setPendingUpdates({}); setEditing(false); };

  const saveEditing = async () => {
    const fn = pendingUpdates.first_name ?? employee.first_name;
    const ln = pendingUpdates.last_name ?? employee.last_name;
    const pos = pendingUpdates.position ?? employee.position;
    if (!fn?.trim() || !ln?.trim() || !pos?.trim()) {
      toast.error("Nombre, apellido y cargo son requeridos");
      return;
    }
    try {
      logFieldChanges(employee.id, employee, pendingUpdates);
      await updateEmployee(employee.id, pendingUpdates);
      setEditing(false);
      setPendingUpdates({});
      toast.success("Cambios guardados");
    } catch (err: any) {
      toast.error(err.message ?? "Error al guardar");
    }
  };

  const handleChangeStatus = async (newStatus: EmployeeStatus) => {
    if (newStatus === "archived") { setArchiveDialog(true); return; }
    try {
      logAudit({ employee_id: employee.id, action: "Cambió estado", field_changed: "Estado", old_value: statusConfig[employee.status].label, new_value: statusConfig[newStatus].label });
      await changeStatus(employee.id, newStatus);
      toast.success(`Estado cambiado a ${statusConfig[newStatus].label}`);
    } catch (err: any) {
      toast.error(err.message ?? "Error al cambiar estado");
    }
  };

  const confirmArchive = async () => {
    try {
      logAudit({ employee_id: employee.id, action: "Archivó", old_value: statusConfig[employee.status].label, new_value: "Archivado" });
      await changeStatus(employee.id, "archived");
      setArchiveDialog(false);
      toast.success("Empleado archivado");
    } catch (err: any) {
      toast.error(err.message ?? "Error al archivar");
    }
  };

  const confirmDelete = async () => {
    if (deleteConfirmName.trim().toLowerCase() !== fullName.toLowerCase()) {
      toast.error("El nombre no coincide"); return;
    }
    try {
      logAudit({ employee_id: employee.id, action: "Eliminó permanentemente" });
      await deleteEmployee(employee.id);
      toast.success("Empleado eliminado permanentemente");
      navigate("/crew");
    } catch (err: any) {
      toast.error(err.message ?? "Error al eliminar");
    }
  };

  const handleAddTask = async (task: RecurringTask) => {
    try {
      logAudit({ employee_id: employee.id, action: "Agregó tarea", new_value: task.name });
      await addRecurringTask(employee.id, task);
    } catch (err: any) {
      toast.error(err.message ?? "Error al agregar tarea");
    }
  };

  const handleToggleTask = async (taskId: string) => {
    const task = employee.recurring_tasks.find((t) => t.id === taskId);
    if (task) logAudit({ employee_id: employee.id, action: task.active ? "Desactivó tarea" : "Activó tarea", new_value: task.name });
    try {
      await toggleRecurringTask(taskId, task?.active ?? false);
    } catch (err: any) {
      toast.error(err.message ?? "Error al cambiar tarea");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const task = employee.recurring_tasks.find((t) => t.id === taskId);
    if (task) logAudit({ employee_id: employee.id, action: "Eliminó tarea", old_value: task.name });
    try {
      await deleteRecurringTask(taskId);
      toast.success("Tarea eliminada");
    } catch (err: any) {
      toast.error(err.message ?? "Error al eliminar tarea");
    }
  };

  const handleUpdateTask = async (taskId: string, patch: Partial<RecurringTask>) => {
    const task = employee.recurring_tasks.find((t) => t.id === taskId);
    if (task) logAudit({ employee_id: employee.id, action: "Editó tarea", old_value: task.name, new_value: patch.name ?? task.name });
    try {
      await updateRecurringTask(taskId, patch);
    } catch (err: any) {
      toast.error(err.message ?? "Error al actualizar tarea");
    }
  };

  const handleReorderTask = async (taskId: string, direction: "up" | "down") => {
    try {
      await reorderRecurringTask(employee.id, taskId, direction);
    } catch (err: any) {
      toast.error(err.message ?? "Error al reordenar");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/crew" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />Crew
      </Link>

      {/* Header */}
      <div className="kpi-card">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <Avatar className="h-20 w-20 shrink-0">
            <AvatarImage src={resolvedPhotoUrl ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-black text-xl">
              {employee.first_name[0]}{employee.last_name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black tracking-tight">{fullName}</h1>
              <span className="text-xs bg-muted rounded-full px-2 py-0.5 font-mono text-muted-foreground">{employee.internal_id}</span>
              <span className={st.className}>
                {employee.status === "graduated" && <GraduationCap className="h-3 w-3 mr-1" />}
                {st.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{employee.position}</p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              {employee.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{employee.location}</span>}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(employee.start_date).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={cancelEditing}>Cancelar</Button>
                <Button size="sm" onClick={saveEditing}>Guardar</Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={startEditing}>
                  <Pencil className="h-4 w-4 mr-1" />Editar
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Cambiar estado</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => handleChangeStatus("active")}>Activo</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleChangeStatus("inactive")}>Inactivo</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleChangeStatus("graduated")}>Egresado</DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem onClick={() => setArchiveDialog(true)}>
                      <Archive className="h-4 w-4 mr-2" />Archivar perfil
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteDialog(true)}>
                      <Trash2 className="h-4 w-4 mr-2" />Eliminar empleado
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general" className="space-y-4">
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
        <TabsList className="w-max">
          <TabsTrigger value="general" className="whitespace-nowrap">Datos generales</TabsTrigger>
          <TabsTrigger value="tasks" className="whitespace-nowrap">Tareas recurrentes</TabsTrigger>
          <TabsTrigger value="incidents" className="whitespace-nowrap">Incidencias</TabsTrigger>
          <TabsTrigger value="docs" className="whitespace-nowrap">Documentos</TabsTrigger>
          <TabsTrigger value="salary" className="whitespace-nowrap">Historial salarial</TabsTrigger>
          <TabsTrigger value="notes" className="whitespace-nowrap">Notas privadas</TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="general">
          <CrewGeneralData employee={employee} editMode={editing} onUpdate={setPendingUpdates} />
        </TabsContent>

        <TabsContent value="tasks">
          <CrewRecurringTasks
            tasks={employee.recurring_tasks}
            onAdd={handleAddTask}
            onUpdate={handleUpdateTask}
            onToggle={handleToggleTask}
            onDelete={handleDeleteTask}
            onReorder={handleReorderTask}
          />
        </TabsContent>

        <TabsContent value="incidents">
          <CrewIncidents employeeId={employee.id} employeeName={fullName} />
        </TabsContent>

        <TabsContent value="docs">
          <CrewDocuments employeeId={employee.id} />
        </TabsContent>

        <TabsContent value="salary">
          <CrewSalaryHistory employeeId={employee.id} currentSalary={employee.current_salary} />
        </TabsContent>

        <TabsContent value="notes">
          <CrewPrivateNotes employeeId={employee.id} />
        </TabsContent>
      </Tabs>

      {/* Audit trail */}
      <CrewAuditLog employeeId={employee.id} />

      {/* Archive dialog */}
      <AlertDialog open={archiveDialog} onOpenChange={setArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar a {fullName}?</AlertDialogTitle>
            <AlertDialogDescription>Su historial se conservará completo. Podrás reactivar el perfil en cualquier momento.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive}>Archivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={(v) => { setDeleteDialog(v); if (!v) setDeleteConfirmName(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">¿Eliminar permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Escribe <strong>{fullName}</strong> para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={deleteConfirmName} onChange={(e) => setDeleteConfirmName(e.target.value)} placeholder={fullName} className="mt-2" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={deleteConfirmName.trim().toLowerCase() !== fullName.toLowerCase()}
            >Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
