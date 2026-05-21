import { useState, useEffect, KeyboardEvent } from "react";
import { format } from "date-fns";
import { CalendarIcon, Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
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
  canViewSalary?: boolean;
}

/** Resolve a storage path to a signed URL for display */
async function resolvePhotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  // If it's already a full URL (legacy), return as-is
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  const { data, error } = await supabase.storage.from("crew-documents").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export function CrewGeneralData({ employee, editMode, onUpdate, canViewSalary = true }: CrewGeneralDataProps) {
  const [draft, setDraft] = useState<Partial<Employee>>({});
  const [skillInput, setSkillInput] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Resolve employee photo on mount / when photo_url changes
  useEffect(() => {
    resolvePhotoUrl(employee.photo_url).then(setPhotoPreview);
  }, [employee.photo_url]);

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

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const storagePath = `${employee.id}/photo_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("crew-documents").upload(storagePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      // Show preview immediately
      const signedUrl = await resolvePhotoUrl(storagePath);
      setPhotoPreview(signedUrl);
      set("photo_url", storagePath);
    } catch (err: any) {
      console.error("Photo upload failed:", err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const startDate = val("start_date");
  const parsedDate = startDate ? new Date(startDate) : undefined;
  const birthDate = val("birth_date") as string | null | undefined;
  const parsedBirth = birthDate ? new Date(birthDate) : undefined;

  return (
    <div className="kpi-card space-y-6">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Información personal</h2>

      {/* Photo row */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 shrink-0">
          <AvatarImage src={photoPreview ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary font-black text-lg">
            {employee.first_name[0]}{employee.last_name[0]}
          </AvatarFallback>
        </Avatar>
        {editMode && (
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" asChild disabled={uploadingPhoto}>
              <span>
                {uploadingPhoto ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                {uploadingPhoto ? "Subiendo…" : "Cambiar foto"}
              </span>
            </Button>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={uploadingPhoto} />
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* ID interno - always read-only */}
        <ReadField label="ID interno" value={employee.internal_id} />

        {/* Nombre */}
        <FieldCell label="Nombre" editing={editMode}>
          {editMode ? (
            <Input value={val("first_name") as string} onChange={(e) => set("first_name", e.target.value)} />
          ) : (
            <p className="text-sm font-semibold">{employee.first_name}</p>
          )}
        </FieldCell>

        {/* Apellido */}
        <FieldCell label="Apellido" editing={editMode}>
          {editMode ? (
            <Input value={val("last_name") as string} onChange={(e) => set("last_name", e.target.value)} />
          ) : (
            <p className="text-sm font-semibold">{employee.last_name}</p>
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

        {/* Fecha de nacimiento */}
        <FieldCell label="Fecha de nacimiento" editing={editMode}>
          {editMode ? (
            <BirthDateInput
              value={birthDate ?? null}
              onChange={(iso) => set("birth_date", iso as any)}
            />
          ) : (
            <p className="text-sm font-semibold">
              {parsedBirth ? parsedBirth.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" }) : <Placeholder />}
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

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function BirthDateInput({ value, onChange }: { value: string | null; onChange: (iso: string | null) => void }) {
  const parsed = value ? new Date(value) : undefined;
  const currentYear = new Date().getFullYear();

  const [day, setDay] = useState<string>(parsed ? String(parsed.getDate()) : "");
  const [month, setMonth] = useState<string>(parsed ? String(parsed.getMonth() + 1) : "");
  const [year, setYear] = useState<string>(parsed ? String(parsed.getFullYear()) : "");

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      setDay(String(d.getDate()));
      setMonth(String(d.getMonth() + 1));
      setYear(String(d.getFullYear()));
    } else {
      setDay("");
      setMonth("");
      setYear("");
    }
  }, [value]);

  const commit = (d: string, m: string, y: string) => {
    if (!d || !m || !y) return;
    const dd = parseInt(d, 10);
    const mm = parseInt(m, 10) - 1;
    const yy = parseInt(y, 10);
    const date = new Date(yy, mm, dd);
    if (date.getFullYear() === yy && date.getMonth() === mm && date.getDate() === dd) {
      onChange(format(date, "yyyy-MM-dd"));
    }
  };

  const handleDay = (v: string) => { setDay(v); commit(v, month, year); };
  const handleMonth = (v: string) => { setMonth(v); commit(day, v, year); };
  const handleYear = (v: string) => { setYear(v); commit(day, month, v); };

  const daysInMonth = (() => {
    if (!month || !year) return 31;
    return new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
  })();

  return (
    <div className="flex gap-1.5">
      <Select value={day} onValueChange={handleDay}>
        <SelectTrigger className="flex-1"><SelectValue placeholder="Día" /></SelectTrigger>
        <SelectContent>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
            <SelectItem key={d} value={String(d)}>{d}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={month} onValueChange={handleMonth}>
        <SelectTrigger className="flex-[2]"><SelectValue placeholder="Mes" /></SelectTrigger>
        <SelectContent>
          {MONTHS.map((name, i) => (
            <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={year} onValueChange={handleYear}>
        <SelectTrigger className="flex-[1.5]"><SelectValue placeholder="Año" /></SelectTrigger>
        <SelectContent>
          {Array.from({ length: currentYear - 1920 + 1 }, (_, i) => currentYear - i).map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
