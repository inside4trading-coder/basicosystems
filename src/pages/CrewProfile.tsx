import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, MapPin, Calendar, Pencil, MoreVertical, Users2,
  Loader2, AlertTriangle, ClipboardList, FileText, DollarSign,
  Lock, AlertCircle, GraduationCap, Archive, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useCrewData } from "@/hooks/useCrewData";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { EmployeeStatus } from "@/types/crew";

const statusConfig: Record<EmployeeStatus, { label: string; className: string }> = {
  active: { label: "Activo", className: "status-badge-success" },
  inactive: { label: "Inactivo", className: "status-badge-warning" },
  archived: { label: "Archivado", className: "status-badge-inactive" },
  graduated: { label: "Egresado", className: "status-badge-inactive" },
};

export default function CrewProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { employees, updateEmployee, deleteEmployee, changeStatus } = useCrewData();

  const employee = employees.find((e) => e.id === id);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    first_name: "", last_name: "", cedula: "", phone: "",
    position: "", location: "", observations: "",
  });

  const [archiveDialog, setArchiveDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

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

  const startEditing = () => {
    setDraft({
      first_name: employee.first_name,
      last_name: employee.last_name,
      cedula: employee.cedula,
      phone: employee.phone,
      position: employee.position,
      location: employee.location,
      observations: employee.observations,
    });
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const saveEditing = () => {
    if (!draft.first_name.trim() || !draft.last_name.trim() || !draft.position.trim()) {
      toast.error("Nombre, apellido y cargo son requeridos");
      return;
    }
    updateEmployee(employee.id, draft);
    setEditing(false);
    toast.success("Cambios guardados");
  };

  const handleChangeStatus = (newStatus: EmployeeStatus) => {
    if (newStatus === "archived") {
      setArchiveDialog(true);
      return;
    }
    changeStatus(employee.id, newStatus);
    toast.success(`Estado cambiado a ${statusConfig[newStatus].label}`);
  };

  const confirmArchive = () => {
    changeStatus(employee.id, "archived");
    setArchiveDialog(false);
    toast.success("Empleado archivado");
  };

  const confirmDelete = () => {
    if (deleteConfirmName.trim().toLowerCase() !== fullName.toLowerCase()) {
      toast.error("El nombre no coincide");
      return;
    }
    deleteEmployee(employee.id);
    toast.success("Empleado eliminado permanentemente");
    navigate("/crew");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back nav */}
      <Link to="/crew" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Crew
      </Link>

      {/* Header card */}
      <div className="kpi-card">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <Avatar className="h-20 w-20 shrink-0">
            <AvatarImage src={employee.photo_url ?? undefined} />
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
              {employee.location && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{employee.location}</span>
              )}
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
                    <Button variant="outline" size="icon" className="h-9 w-9">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
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
        <TabsList>
          <TabsTrigger value="general">Datos generales</TabsTrigger>
          <TabsTrigger value="tasks">Tareas recurrentes</TabsTrigger>
          <TabsTrigger value="incidents">Incidencias</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
          <TabsTrigger value="salary">Historial salarial</TabsTrigger>
          <TabsTrigger value="notes">Notas privadas</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general">
          <div className="kpi-card space-y-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Información personal</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre" value={employee.first_name} editing={editing} draft={draft.first_name} onChange={(v) => setDraft((d) => ({ ...d, first_name: v }))} />
              <Field label="Apellido" value={employee.last_name} editing={editing} draft={draft.last_name} onChange={(v) => setDraft((d) => ({ ...d, last_name: v }))} />
              <Field label="Cédula" value={employee.cedula} editing={editing} draft={draft.cedula} onChange={(v) => setDraft((d) => ({ ...d, cedula: v }))} />
              <Field label="Teléfono" value={employee.phone} editing={editing} draft={draft.phone} onChange={(v) => setDraft((d) => ({ ...d, phone: v }))} />
              <Field label="Cargo" value={employee.position} editing={editing} draft={draft.position} onChange={(v) => setDraft((d) => ({ ...d, position: v }))} />
              <Field label="Sede o Área" value={employee.location} editing={editing} draft={draft.location} onChange={(v) => setDraft((d) => ({ ...d, location: v }))} />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Observaciones</Label>
              {editing ? (
                <textarea
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                  value={draft.observations}
                  onChange={(e) => setDraft((d) => ({ ...d, observations: e.target.value }))}
                />
              ) : (
                <p className="mt-1 text-sm">{employee.observations || <span className="text-muted-foreground italic">Sin observaciones</span>}</p>
              )}
            </div>
            {employee.skills.length > 0 && (
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Skills</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {employee.skills.map((s) => (
                    <span key={s} className="text-xs bg-muted rounded-full px-2.5 py-0.5 font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks">
          <div className="kpi-card">
            {employee.recurring_tasks.length === 0 ? (
              <EmptyTab icon={ClipboardList} message="No hay tareas recurrentes asignadas" detail="Las tareas recurrentes se gestionarán desde aquí" />
            ) : (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tareas recurrentes</h2>
                {employee.recurring_tasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.frequency} · {t.day} · {t.time}</p>
                    </div>
                    <span className={`status-badge ${t.priority === "high" ? "status-badge-error" : t.priority === "medium" ? "status-badge-warning" : "status-badge-inactive"}`}>
                      {t.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Incidents */}
        <TabsContent value="incidents">
          <div className="kpi-card">
            <EmptyTab icon={AlertCircle} message="No hay incidencias registradas" detail="Las incidencias del empleado aparecerán aquí" />
          </div>
        </TabsContent>

        {/* Docs */}
        <TabsContent value="docs">
          <div className="kpi-card">
            <EmptyTab icon={FileText} message="No hay documentos adjuntos" detail="Los documentos del empleado se almacenarán aquí" />
          </div>
        </TabsContent>

        {/* Salary */}
        <TabsContent value="salary">
          <div className="kpi-card">
            {employee.current_salary ? (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Salario actual</h2>
                <p className="text-2xl font-black tracking-tight mt-2">${employee.current_salary.toLocaleString("es-VE")}</p>
              </div>
            ) : (
              <EmptyTab icon={DollarSign} message="Sin historial salarial" detail="El historial de salarios se registrará aquí" />
            )}
          </div>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes">
          <div className="kpi-card">
            <EmptyTab icon={Lock} message="Sin notas privadas" detail="Las notas privadas solo serán visibles para administradores" />
          </div>
        </TabsContent>
      </Tabs>

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
          <Input
            value={deleteConfirmName}
            onChange={(e) => setDeleteConfirmName(e.target.value)}
            placeholder={fullName}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={deleteConfirmName.trim().toLowerCase() !== fullName.toLowerCase()}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, value, editing, draft, onChange }: {
  label: string; value: string; editing: boolean; draft: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      {editing ? (
        <Input value={draft} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <p className="text-sm">{value || <span className="text-muted-foreground italic">—</span>}</p>
      )}
    </div>
  );
}

function EmptyTab({ icon: Icon, message, detail }: { icon: React.ElementType; message: string; detail: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2">
      <Icon className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm font-semibold text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground/70">{detail}</p>
    </div>
  );
}
