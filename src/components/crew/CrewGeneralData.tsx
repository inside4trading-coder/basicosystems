import { useState, KeyboardEvent } from "react";
import { format } from "date-fns";
import { CalendarIcon, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { Employee, EmployeeStatus } from "@/types/crew";

interface CrewGeneralDataProps {
  employee: Employee;
  editMode: boolean;
  onUpdate: (updates: Partial<Employee>) => void;
}

export function CrewGeneralData({ employee, editMode, onUpdate }: CrewGeneralDataProps) {
  const [draft, setDraft] = useState<Partial<Employee>>({});
  const [skillInput, setSkillInput] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Sync draft when entering edit mode
  const val = <K extends keyof Employee>(key: K): Employee[K] =>
    editMode && key in draft ? (draft[key] as Employee[K]) : employee[key];

  const set = <K extends keyof Employee>(key: K, value: Employee[K]) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onUpdate(next);
  };

  const skills: string[] = (val("skills") as string[]) ?? [];

  const handleAddSkill = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && skillInput.trim()) {
      e.preventDefault();
      const newSkills = [...skills, skillInput.trim()];
      set("skills", newSkills);
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (idx: number) => {
    set("skills", skills.filter((_, i) => i !== idx));
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
      set("photo_url", url);
    }
  };

  const startDate = val("start_date");
  const parsedDate = startDate ? new Date(startDate) : undefined;

  return (
    <div className="kpi-card space-y-6">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Información personal</h2>

      {/* Photo row */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 shrink-0">
          <AvatarImage src={photoPreview ?? employee.photo_url ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary font-black text-lg">
            {employee.first_name[0]}{employee.last_name[0]}
          </AvatarFallback>
        </Avatar>
        {editMode && (
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" asChild>
              <span><Upload className="h-4 w-4 mr-1" />Cambiar foto</span>
            </Button>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* ID interno - always read-only */}
        <ReadField label="ID interno" value={employee.internal_id} />

        {/* Nombre completo */}
        <FieldCell label="Nombre completo" editing={editMode}>
          {editMode ? (
            <Input value={`${val("first_name")} ${val("last_name")}`} onChange={(e) => {
              const parts = e.target.value.split(" ");
              set("first_name", parts[0] || "");
              set("last_name", parts.slice(1).join(" ") || "");
            }} />
          ) : (
            <p className="text-sm font-semibold">{employee.first_name} {employee.last_name}</p>
          )}
        </FieldCell>

        {/* Cédula */}
        <FieldCell label="Cédula" editing={editMode}>
          {editMode ? (
            <Input value={val("cedula") as string} onChange={(e) => set("cedula", e.target.value)} />
          ) : (
            <p className="text-sm font-semibold">{employee.cedula || <Placeholder />}</p>
          )}
        </FieldCell>

        {/* Teléfono */}
        <FieldCell label="Teléfono" editing={editMode}>
          {editMode ? (
            <Input value={val("phone") as string} onChange={(e) => set("phone", e.target.value)} />
          ) : (
            <p className="text-sm font-semibold">{employee.phone || <Placeholder />}</p>
          )}
        </FieldCell>

        {/* Cargo */}
        <FieldCell label="Cargo" editing={editMode}>
          {editMode ? (
            <Input value={val("position") as string} onChange={(e) => set("position", e.target.value)} />
          ) : (
            <p className="text-sm font-semibold">{employee.position || <Placeholder />}</p>
          )}
        </FieldCell>

        {/* Sede o Área */}
        <FieldCell label="Sede o Área" editing={editMode}>
          {editMode ? (
            <Input value={val("location") as string} onChange={(e) => set("location", e.target.value)} />
          ) : (
            <p className="text-sm font-semibold">{employee.location || <Placeholder />}</p>
          )}
        </FieldCell>

        {/* Fecha de inicio */}
        <FieldCell label="Fecha de inicio" editing={editMode}>
          {editMode ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !parsedDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {parsedDate ? format(parsedDate, "dd/MM/yyyy") : "Seleccionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={parsedDate} onSelect={(d) => d && set("start_date", format(d, "yyyy-MM-dd"))} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          ) : (
            <p className="text-sm font-semibold">
              {parsedDate ? parsedDate.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" }) : <Placeholder />}
            </p>
          )}
        </FieldCell>

        {/* Sueldo actual */}
        <FieldCell label="Sueldo actual" editing={editMode}>
          {editMode ? (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                className="pl-7"
                value={val("current_salary") ?? ""}
                onChange={(e) => set("current_salary", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          ) : (
            <p className="text-sm font-semibold">
              {employee.current_salary != null ? `$${employee.current_salary.toLocaleString("es-VE")}` : <Placeholder />}
            </p>
          )}
        </FieldCell>

        {/* Estado */}
        <FieldCell label="Estado" editing={editMode}>
          {editMode ? (
            <Select value={val("status") as string} onValueChange={(v) => set("status", v as EmployeeStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
                <SelectItem value="graduated">Egresado</SelectItem>
                <SelectItem value="archived">Archivado</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm font-semibold capitalize">{employee.status}</p>
          )}
        </FieldCell>
      </div>

      {/* Skills */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Skills</Label>
        <div className="flex flex-wrap gap-1.5">
          {skills.map((s, i) => (
            <span key={i} className="inline-flex items-center text-xs bg-muted rounded-full px-2.5 py-0.5 font-medium gap-1">
              {s}
              {editMode && (
                <button onClick={() => handleRemoveSkill(i)} className="hover:text-destructive transition-colors">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {skills.length === 0 && !editMode && <Placeholder />}
        </div>
        {editMode && (
          <Input
            placeholder="Escribe un skill y presiona Enter"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={handleAddSkill}
            className="mt-1.5 max-w-xs"
          />
        )}
      </div>

      {/* Observaciones */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Observaciones generales</Label>
        {editMode ? (
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
            value={(val("observations") as string) ?? ""}
            onChange={(e) => set("observations", e.target.value)}
          />
        ) : (
          <p className="text-sm">{employee.observations || <Placeholder />}</p>
        )}
      </div>
    </div>
  );
}

function FieldCell({ label, editing, children }: { label: string; editing: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <p className="text-sm font-semibold font-mono">{value}</p>
    </div>
  );
}

function Placeholder() {
  return <span className="text-muted-foreground italic">—</span>;
}
