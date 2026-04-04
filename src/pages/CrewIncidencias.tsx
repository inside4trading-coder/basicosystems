import { useState } from "react";
import { ShieldAlert, Search, Calendar, User, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCrewData } from "@/hooks/useCrewData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import basicoLogo from "@/assets/basico-logo.png";

const categories = ["Puntualidad", "Rendimiento", "Actitud", "Logro", "Comunicación", "Otro"];

export default function CrewIncidencias() {
  const [authenticated, setAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);
  const [validating, setValidating] = useState(false);

  const handleValidate = async () => {
    if (passcode.length < 4) return;
    setValidating(true);
    setError("");
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/crew-passcode`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}`, apikey: anonKey },
          body: JSON.stringify({ action: "validate", passcode }),
        }
      );
      const data = await res.json();
      if (data.valid) {
        setAuthenticated(true);
      } else {
        setError("Código incorrecto");
        setShaking(true);
        setTimeout(() => setShaking(false), 500);
        setPasscode("");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setValidating(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className={`kpi-card max-w-sm w-full p-8 space-y-6 text-center ${shaking ? "animate-shake" : ""}`}>
          <img src={basicoLogo} alt="Basico" className="h-10 mx-auto" />
          <div>
            <h1 className="text-xl font-black tracking-tight">Registro de incidencias</h1>
            <p className="text-sm text-muted-foreground mt-1">Acceso restringido — ingresa el código para continuar</p>
          </div>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={passcode} onChange={setPasscode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          {error && <p className="text-sm text-destructive font-semibold">{error}</p>}
          <Button onClick={handleValidate} disabled={passcode.length < 4 || validating} className="w-full">
            {validating ? "Verificando…" : "Entrar"}
          </Button>
        </div>
      </div>
    );
  }

  return <IncidentRegistration />;
}

function IncidentRegistration() {
  const { employees } = useCrewData();
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; name: string; position: string } | null>(null);
  const [success, setSuccess] = useState(false);

  const activeEmployees = employees.filter((e) => e.status === "active" || e.status === "inactive");
  const filtered = search.trim()
    ? activeEmployees.filter((e) => `${e.first_name} ${e.last_name}`.toLowerCase().includes(search.toLowerCase()))
    : activeEmployees;

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="kpi-card max-w-sm w-full p-8 space-y-4 text-center animate-fade-in">
          <CheckCircle className="h-12 w-12 text-status-success mx-auto" />
          <h2 className="text-lg font-black">Incidencia registrada</h2>
          <Button onClick={() => { setSuccess(false); setSelectedEmployee(null); }} className="w-full">
            Registrar otra
          </Button>
        </div>
      </div>
    );
  }

  if (selectedEmployee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="kpi-card max-w-md w-full p-6 animate-fade-in">
          <Button variant="ghost" size="sm" onClick={() => setSelectedEmployee(null)} className="mb-4">← Volver</Button>
          <IncidentForm
            employeeId={selectedEmployee.id}
            employeeName={selectedEmployee.name}
            onSuccess={() => setSuccess(true)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8 max-w-lg mx-auto space-y-4 animate-fade-in">
      <h1 className="text-xl font-black tracking-tight">Registrar incidencia</h1>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar empleado por nombre…" className="pl-9" />
      </div>
      <div className="space-y-2">
        {filtered.map((e) => (
          <button
            key={e.id}
            onClick={() => setSelectedEmployee({ id: e.id, name: `${e.first_name} ${e.last_name}`, position: e.position })}
            className="w-full text-left kpi-card p-3 hover:bg-muted/30 transition-colors"
          >
            <p className="font-semibold text-sm">{e.first_name} {e.last_name}</p>
            <p className="text-xs text-muted-foreground">{e.position}</p>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No se encontraron empleados</p>
        )}
      </div>
    </div>
  );
}

function IncidentForm({ employeeId, employeeName, onSuccess }: { employeeId: string; employeeName: string; onSuccess: () => void }) {
  const [type, setType] = useState<"positive" | "negative">("negative");
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [registeredBy, setRegisteredBy] = useState("");
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!reason.trim()) { toast.error("El motivo es requerido"); return; }
    if (!category) { toast.error("Selecciona una categoría"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("incidents").insert({
        employee_id: employeeId,
        employee_name: employeeName,
        incident_date: date,
        type,
        category,
        reason: reason.trim().slice(0, 120),
        registered_by: registeredBy.trim() || null,
        observation: observation.trim() || null,
      });
      if (error) throw error;
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-black">{employeeName}</h2>
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
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Registrado por</label>
        <Input value={registeredBy} onChange={(e) => setRegisteredBy(e.target.value)} placeholder="Tu nombre" className="mt-1" />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Observación</label>
        <Textarea value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Opcional" className="mt-1" rows={3} />
      </div>
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "Guardando…" : "Guardar incidencia"}
      </Button>
    </div>
  );
}
