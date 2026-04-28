import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { EmployeeStatus } from "@/types/crew";

interface AddEmployeeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    first_name: string;
    last_name: string;
    cedula: string;
    phone: string;
    position: string;
    location: string;
    start_date: string;
    birth_date: string | null;
    status: EmployeeStatus;
    photo_url: string | null;
  }) => void;
}

export function AddEmployeeSheet({ open, onOpenChange, onSave }: AddEmployeeSheetProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [cedula, setCedula] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [birthDate, setBirthDate] = useState<Date | undefined>();
  const [status, setStatus] = useState<EmployeeStatus>("active");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const reset = () => {
    setFirstName("");
    setLastName("");
    setCedula("");
    setPhone("");
    setPosition("");
    setLocation("");
    setStartDate(undefined);
    setBirthDate(undefined);
    setStatus("active");
    setPhotoPreview(null);
    setErrors({});
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    }
  };

  const handleSave = () => {
    const newErrors: Record<string, boolean> = {};
    if (!firstName.trim()) newErrors.firstName = true;
    if (!lastName.trim()) newErrors.lastName = true;
    if (!position.trim()) newErrors.position = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      cedula: cedula.trim(),
      phone: phone.trim(),
      position: position.trim(),
      location: location.trim(),
      start_date: startDate ? format(startDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      birth_date: birthDate ? format(birthDate, "yyyy-MM-dd") : null,
      status,
      photo_url: photoPreview,
    });
    reset();
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg font-black tracking-tight">Agregar empleado</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          {/* Photo */}
          <div className="flex flex-col items-center gap-2">
            <label htmlFor="photo-upload" className="cursor-pointer group">
              <Avatar className="h-16 w-16 border-2 border-dashed border-border group-hover:border-primary transition-colors">
                <AvatarImage src={photoPreview ?? undefined} />
                <AvatarFallback className="bg-muted">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
            </label>
            <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <span className="text-xs text-muted-foreground">Foto (opcional)</span>
          </div>

          {/* Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre *</Label>
              <Input value={firstName} onChange={(e) => { setFirstName(e.target.value); setErrors((p) => ({ ...p, firstName: false })); }} className={errors.firstName ? "border-destructive" : ""} />
              {errors.firstName && <p className="text-xs text-destructive">Requerido</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Apellido *</Label>
              <Input value={lastName} onChange={(e) => { setLastName(e.target.value); setErrors((p) => ({ ...p, lastName: false })); }} className={errors.lastName ? "border-destructive" : ""} />
              {errors.lastName && <p className="text-xs text-destructive">Requerido</p>}
            </div>
          </div>

          {/* Cedula + Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cédula</Label>
              <Input value={cedula} onChange={(e) => setCedula(e.target.value)} placeholder="V-00.000.000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+58 4XX-XXXXXXX" />
            </div>
          </div>

          {/* Position */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cargo *</Label>
            <Input value={position} onChange={(e) => { setPosition(e.target.value); setErrors((p) => ({ ...p, position: false })); }} className={errors.position ? "border-destructive" : ""} />
            {errors.position && <p className="text-xs text-destructive">Requerido</p>}
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sede o Área</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ej: Caracas, Almacén, Remoto…" />
          </div>

          {/* Start date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fecha de inicio</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd/MM/yyyy") : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Birth date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fecha de nacimiento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !birthDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {birthDate ? format(birthDate, "dd/MM/yyyy") : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={birthDate} onSelect={setBirthDate} initialFocus captionLayout="dropdown-buttons" fromYear={1940} toYear={new Date().getFullYear()} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estado</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as EmployeeStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => handleOpenChange(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave}>Guardar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
