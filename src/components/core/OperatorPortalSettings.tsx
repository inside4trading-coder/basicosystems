import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Copy, KeyRound, Loader2, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { portalApi } from "@/lib/operatorPortal";

const PROCESS_OPTIONS = [
  { value: "cutter", label: "Corte" },
  { value: "sewer", label: "Costura" },
  { value: "printer", label: "Estampado" },
  { value: "embroiderer", label: "Bordado" },
  { value: "logistics", label: "Logística" },
  { value: "packing", label: "Empaque" },
  { value: "quality", label: "Calidad" },
];

interface Props {
  operatorId: string;
}

export function OperatorPortalSettings({ operatorId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [portalActive, setPortalActive] = useState(false);
  const [allowed, setAllowed] = useState<string[]>([]);
  const [pinSet, setPinSet] = useState(false);
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  const portalUrl = `${window.location.origin}/operario`;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("core_factory_operators")
        .select("portal_active, allowed_processes, pin_set_at, portal_last_login_at")
        .eq("id", operatorId)
        .maybeSingle();
      const row = data as any;
      setPortalActive(!!row?.portal_active);
      setAllowed((row?.allowed_processes as string[]) ?? []);
      setPinSet(!!row?.pin_set_at);
      setLastLogin(row?.portal_last_login_at ?? null);
      setLoading(false);
    })();
  }, [operatorId]);

  async function persist(next: { portal_active?: boolean; allowed_processes?: string[] }) {
    setSaving(true);
    const { error } = await supabase.from("core_factory_operators").update(next).eq("id", operatorId);
    setSaving(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  }

  async function savePin() {
    if (!/^\d{6}$/.test(pin)) {
      toast({ title: "El PIN debe tener 6 dígitos", variant: "destructive" });
      return;
    }
    if (pin !== pin2) {
      toast({ title: "Los PIN no coinciden", variant: "destructive" });
      return;
    }
    setSavingPin(true);
    const res = await portalApi.adminSetPin(operatorId, pin);
    setSavingPin(false);
    if (!res.ok) {
      toast({ title: "Error", description: res.error, variant: "destructive" });
      return;
    }
    setPin("");
    setPin2("");
    setPinSet(true);
    toast({ title: "PIN guardado" });
  }

  async function revokeSessions() {
    const res = await portalApi.adminRevokeSessions(operatorId);
    if (!res.ok) {
      toast({ title: "Error", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Sesiones revocadas", description: "El operario deberá ingresar su PIN de nuevo." });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando portal…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4" />
        <h4 className="font-semibold">Portal de operario</h4>
        {pinSet ? <Badge variant="secondary">PIN definido</Badge> : <Badge variant="outline">Sin PIN</Badge>}
      </div>

      <div className="flex items-center justify-between rounded border p-3">
        <div>
          <Label className="text-sm">Portal habilitado</Label>
          <p className="text-xs text-muted-foreground">Permite que este operario entre en /operario con su PIN.</p>
        </div>
        <Switch
          checked={portalActive}
          disabled={saving}
          onCheckedChange={(v) => {
            setPortalActive(v);
            void persist({ portal_active: v });
          }}
        />
      </div>

      <div>
        <Label className="text-sm">Procesos permitidos</Label>
        <p className="text-xs text-muted-foreground">Si no marcas ninguno, se usan los roles productivos del operario.</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PROCESS_OPTIONS.map((p) => (
            <label key={p.value} className="flex cursor-pointer items-center gap-2 rounded border p-2">
              <Checkbox
                checked={allowed.includes(p.value)}
                onCheckedChange={(c) => {
                  const next = c ? [...allowed, p.value] : allowed.filter((x) => x !== p.value);
                  setAllowed(next);
                  void persist({ allowed_processes: next });
                }}
              />
              <span className="text-sm">{p.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded border p-3">
        <Label className="text-sm">{pinSet ? "Cambiar PIN" : "Definir PIN"} (6 dígitos)</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          <Input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="••••••"
            className="w-32"
          />
          <Input
            value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="Repetir"
            className="w-32"
          />
          <Button onClick={savePin} disabled={savingPin}>
            {savingPin ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Guardar PIN
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          El PIN se guarda cifrado; no puede consultarse después, solo reemplazarse.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(portalUrl);
            toast({ title: "Link copiado", description: portalUrl });
          }}
        >
          <Copy className="mr-1 h-4 w-4" /> Copiar link del portal
        </Button>
        <Button variant="outline" size="sm" onClick={revokeSessions}>
          Revocar sesiones
        </Button>
        <span className="text-xs text-muted-foreground">
          Último acceso: {lastLogin ? new Date(lastLogin).toLocaleString("es-VE") : "—"}
        </span>
      </div>
    </div>
  );
}
