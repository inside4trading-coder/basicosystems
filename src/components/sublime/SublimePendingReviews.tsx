import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, MapPin, RefreshCw, AlertCircle } from "lucide-react";

type PendingEvent = {
  id: string;
  employee_id: string;
  event_type: string;
  event_at: string;
  latitude: number | null;
  longitude: number | null;
  distance_meters: number | null;
  allowed_radius_meters: number | null;
  location_state: string;
  observations: string | null;
  device_user_agent: string | null;
};

type EmpMap = Record<string, string>;

export default function SublimePendingReviews() {
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [emps, setEmps] = useState<EmpMap>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("sublime_clock_events")
      .select("*")
      .eq("clock_state", "pendiente_revision")
      .order("event_at", { ascending: false })
      .limit(100);
    const ev = (data ?? []) as PendingEvent[];
    setEvents(ev);
    const ids = Array.from(new Set(ev.map((e) => e.employee_id)));
    if (ids.length) {
      const { data: e } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .in("id", ids);
      const map: EmpMap = {};
      (e ?? []).forEach((row: any) => {
        map[row.id] = `${row.first_name} ${row.last_name}`.trim();
      });
      setEmps(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const decide = async (id: string, approve: boolean) => {
    const { data: u } = await supabase.auth.getUser();
    const who = u.user?.email ?? u.user?.id ?? "admin";
    const { error } = await supabase
      .from("sublime_clock_events")
      .update({
        clock_state: approve ? "aprobado_manual" : "rechazado",
        approved_by: who,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: approve ? "Aprobado" : "Rechazado" });
    refresh();
  };

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground text-center">Cargando…</div>;
  }

  if (!events.length) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-6">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <AlertCircle className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold">Sin solicitudes pendientes</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Aquí aparecerán fichajes fuera de rango o sin GPS para revisión.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={refresh} className="rounded-xl">
          <RefreshCw className="h-3 w-3 mr-1" /> Refrescar
        </Button>
      </div>
      {events.map((e) => (
        <Card key={e.id} className="p-4 rounded-2xl border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-foreground">{emps[e.employee_id] ?? "Empleado"}</p>
                <Badge variant="outline" className="capitalize">{e.event_type.replace("_", " ")}</Badge>
                <Badge variant="destructive">{e.location_state.replace("_", " ")}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(e.event_at).toLocaleString("es-ES")}
              </p>
              {e.distance_meters != null && (
                <p className="text-sm">
                  <MapPin className="inline h-3 w-3 mr-1" />
                  {e.distance_meters} m de la tienda · radio {e.allowed_radius_meters} m
                </p>
              )}
              {e.observations && (
                <p className="text-sm text-muted-foreground italic">"{e.observations}"</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => decide(e.id, false)} className="rounded-xl">
                <XCircle className="h-4 w-4 mr-1" /> Rechazar
              </Button>
              <Button size="sm" onClick={() => decide(e.id, true)} className="rounded-xl">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Aprobar
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
