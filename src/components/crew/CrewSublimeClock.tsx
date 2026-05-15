import { useMemo, useState } from "react";
import { useSublimeClockSettings, useSublimeStores } from "@/hooks/useSublimeClock";
import { computeCurrentStatus, generatePin, hashPin, canEmployeeClockIn } from "@/lib/sublimeClock";
import { EMPTY_SCHEDULE, EVENT_LABEL, STATUS_LABEL, type ClockStatus, type WeeklySchedule } from "@/types/sublime";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertCircle, KeyRound, Lock, Plus, Shield, ShieldOff, Store as StoreIcon } from "lucide-react";
import type { Employee } from "@/types/crew";

interface Props {
  employee: Employee;
  canEdit: boolean;
}

const DAY_LABELS: Array<{ key: keyof WeeklySchedule; label: string }> = [
  { key: "mon", label: "L" }, { key: "tue", label: "M" }, { key: "wed", label: "X" },
  { key: "thu", label: "J" }, { key: "fri", label: "V" }, { key: "sat", label: "S" }, { key: "sun", label: "D" },
];

const STATUS_VARIANT: Record<ClockStatus, string> = {
  fuera_de_jornada: "bg-muted text-muted-foreground",
  trabajando: "bg-[hsl(142_72%_29%)] text-white",
  en_descanso: "bg-[hsl(38_92%_50%)] text-white",
  jornada_completada: "bg-foreground text-background",
  pendiente_revision: "bg-[hsl(45_93%_47%)] text-white",
  fichaje_bloqueado: "bg-primary text-primary-foreground",
};

function timeOnly(value: string | null) {
  return value ? value.slice(0, 5) : "";
}

export function CrewSublimeClock({ employee, canEdit }: Props) {
  const { settings, recentEvents, loading, upsert } = useSublimeClockSettings(employee.id);
  const { stores, createStore } = useSublimeStores();
  const [pinDialog, setPinDialog] = useState<string | null>(null);
  const [newStoreOpen, setNewStoreOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreAddress, setNewStoreAddress] = useState("");

  const status = useMemo(
    () => computeCurrentStatus(settings, recentEvents),
    [settings, recentEvents],
  );
  const eligible = canEmployeeClockIn(employee.status, settings);
  const lastEvent = recentEvents[0] ?? null;

  const ws = settings?.weekly_schedule ?? EMPTY_SCHEDULE;

  const handleField = async (patch: Record<string, any>) => {
    if (!canEdit) return;
    try {
      await upsert(patch);
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    }
  };

  const handleToggleDay = (key: keyof WeeklySchedule) => {
    if (!canEdit) return;
    handleField({ weekly_schedule: { ...ws, [key]: !ws[key] } });
  };

  const handleGeneratePin = async () => {
    if (!canEdit) return;
    const pin = generatePin();
    const hash = await hashPin(pin);
    await handleField({ pin_hash: hash, pin_set_at: new Date().toISOString() });
    setPinDialog(pin);
    toast.success("PIN generado");
  };

  const handleCreateStore = async () => {
    if (!newStoreName.trim()) return;
    try {
      const store = await createStore({ name: newStoreName.trim(), address: newStoreAddress.trim() || undefined });
      await handleField({ store_id: store.id });
      setNewStoreOpen(false);
      setNewStoreName("");
      setNewStoreAddress("");
      toast.success("Tienda creada");
    } catch (e: any) {
      toast.error(e.message ?? "Error al crear tienda");
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Cargando…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Estado actual */}
      <Card className="p-5 rounded-2xl border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 rounded-xl font-bold text-sm ${STATUS_VARIANT[status]}`}>
              {STATUS_LABEL[status]}
            </div>
            {!eligible && (
              <Badge variant="outline" className="gap-1.5">
                <AlertCircle className="h-3 w-3" /> No elegible para fichar
              </Badge>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Último fichaje
            </p>
            {lastEvent ? (
              <p className="text-sm font-semibold text-foreground">
                {EVENT_LABEL[lastEvent.event_type]} ·{" "}
                {new Date(lastEvent.event_at).toLocaleString("es-ES", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Sin registros</p>
            )}
          </div>
        </div>
      </Card>

      {/* Configuración */}
      <Card className="p-5 sm:p-6 rounded-2xl border-border/60 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">Configuración de fichaje</h3>
            <p className="text-xs text-muted-foreground">
              Define los parámetros para que este empleado pueda fichar en Sublime.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="enabled" className="text-sm">Habilitado</Label>
            <Switch
              id="enabled"
              checked={settings?.enabled ?? false}
              disabled={!canEdit}
              onCheckedChange={(v) => handleField({ enabled: v })}
            />
          </div>
        </div>

        {/* Tienda */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Tienda asignada
          </Label>
          <div className="flex gap-2">
            <Select
              value={settings?.store_id ?? ""}
              disabled={!canEdit}
              onValueChange={(v) => handleField({ store_id: v })}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Selecciona una tienda" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="inline-flex items-center gap-2">
                      <StoreIcon className="h-3.5 w-3.5" /> {s.name}
                    </span>
                  </SelectItem>
                ))}
                {stores.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Sin tiendas</div>
                )}
              </SelectContent>
            </Select>
            {canEdit && (
              <Button variant="outline" size="icon" className="rounded-xl shrink-0" onClick={() => setNewStoreOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Horario semanal */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Horario semanal
          </Label>
          <div className="flex gap-2 flex-wrap">
            {DAY_LABELS.map(({ key, label }) => {
              const on = ws[key];
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => handleToggleDay(key)}
                  className={`h-10 w-10 rounded-xl text-sm font-semibold transition-colors ${
                    on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                  } ${!canEdit ? "opacity-60 cursor-not-allowed" : ""}`}
                  aria-pressed={on}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Horarios */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Hora entrada</Label>
            <Input
              type="time"
              disabled={!canEdit}
              value={timeOnly(settings?.entry_time ?? null)}
              onChange={(e) => handleField({ entry_time: e.target.value || null })}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hora salida</Label>
            <Input
              type="time"
              disabled={!canEdit}
              value={timeOnly(settings?.exit_time ?? null)}
              onChange={(e) => handleField({ exit_time: e.target.value || null })}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Inicio descanso</Label>
            <Input
              type="time"
              disabled={!canEdit}
              value={timeOnly(settings?.break_start ?? null)}
              onChange={(e) => handleField({ break_start: e.target.value || null })}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fin descanso</Label>
            <Input
              type="time"
              disabled={!canEdit}
              value={timeOnly(settings?.break_end ?? null)}
              onChange={(e) => handleField({ break_end: e.target.value || null })}
              className="rounded-xl"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Duración descanso (min)</Label>
            <Input
              type="number"
              min={0}
              max={240}
              disabled={!canEdit}
              value={settings?.break_minutes ?? 60}
              onChange={(e) => handleField({ break_minutes: Number(e.target.value) || 0 })}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tolerancia retraso (min)</Label>
            <Input
              type="number"
              min={0}
              max={120}
              disabled={!canEdit}
              value={settings?.late_tolerance_minutes ?? 10}
              onChange={(e) => handleField({ late_tolerance_minutes: Number(e.target.value) || 0 })}
              className="rounded-xl"
            />
          </div>
        </div>

        {/* PIN + bloqueo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold text-foreground">PIN de fichaje</p>
                <p className="text-xs text-muted-foreground">
                  {settings?.pin_hash ? "Configurado" : "Sin PIN"}
                </p>
              </div>
            </div>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={handleGeneratePin} className="rounded-lg">
                Generar
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40">
            <div className="flex items-center gap-2">
              {settings?.blocked ? (
                <Lock className="h-4 w-4 text-primary" />
              ) : (
                <Shield className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {settings?.blocked ? "Fichaje bloqueado" : "Fichaje activo"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {settings?.blocked ? "El empleado no puede fichar" : "Sin restricciones"}
                </p>
              </div>
            </div>
            {canEdit && (
              <Button
                size="sm"
                variant={settings?.blocked ? "default" : "outline"}
                onClick={() => handleField({ blocked: !(settings?.blocked ?? false) })}
                className="rounded-lg"
              >
                {settings?.blocked ? <ShieldOff className="h-3.5 w-3.5 mr-1" /> : <Lock className="h-3.5 w-3.5 mr-1" />}
                {settings?.blocked ? "Desbloquear" : "Bloquear"}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* PIN dialog */}
      <Dialog open={!!pinDialog} onOpenChange={(o) => !o && setPinDialog(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo PIN generado</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Comparte este PIN con el empleado. No se volverá a mostrar.
            </p>
            <div className="text-6xl font-black tracking-[0.4em] tabular-nums text-foreground">
              {pinDialog}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setPinDialog(null)} className="rounded-xl">Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nueva tienda dialog */}
      <Dialog open={newStoreOpen} onOpenChange={setNewStoreOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nueva tienda Sublime</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
                placeholder="Ej. Sublime Centro"
                maxLength={100}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Dirección (opcional)</Label>
              <Input
                value={newStoreAddress}
                onChange={(e) => setNewStoreAddress(e.target.value)}
                maxLength={255}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewStoreOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={handleCreateStore} disabled={!newStoreName.trim()} className="rounded-xl">
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
