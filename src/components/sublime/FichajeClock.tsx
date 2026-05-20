import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LogIn, LogOut, X, Coffee, CoffeeIcon, MapPin, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentPosition } from "@/lib/sublimeGeo";

interface FichajeClockProps {
  employeeName: string;
  sessionToken: string;
  onDone: () => void;
  onCancel: () => void;
}

type Action = "entrada" | "salida" | "inicio_descanso" | "fin_descanso";

const ACTION_LABEL: Record<Action, string> = {
  entrada: "Entrada",
  salida: "Salida",
  inicio_descanso: "Inicio descanso",
  fin_descanso: "Fin descanso",
};

type ErrCode = "denied" | "unavailable" | "timeout" | "other";

type Phase =
  | { kind: "idle" }
  | { kind: "locating"; action: Action }
  | { kind: "submitting"; action: Action; accuracy: number | null }
  | { kind: "success"; action: Action; distance: number | null; radius: number; locationState: string }
  | { kind: "out_of_range"; action: Action; distance: number; radius: number; coords: { lat: number; lng: number; acc: number | null } }
  | { kind: "error"; message: string; errorCode?: ErrCode };

const isIOS = () =>
  typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

function tryGetPosition(opts: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocalización no disponible en este dispositivo"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, opts);
  });
}

export function FichajeClock({ employeeName, sessionToken, onDone, onCancel }: FichajeClockProps) {
  const [now, setNow] = useState(new Date());
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  const submit = async (action: Action, params: {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    forceReview?: boolean;
    observations?: string | null;
  }) => {
    setPhase({ kind: "submitting", action, accuracy: params.accuracy });
    const { data, error } = await supabase.functions.invoke("sublime-clock-event", {
      body: {
        session_token: sessionToken,
        event_type: action,
        latitude: params.latitude,
        longitude: params.longitude,
        accuracy: params.accuracy,
        device_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        observations: params.observations ?? null,
        force_review: params.forceReview ?? false,
      },
    });
    if (error || !(data as any)?.ok) {
      setPhase({ kind: "error", message: (data as any)?.error ?? error?.message ?? "Error al fichar" });
      return;
    }
    const res = data as any;
    if (res.clock_state === "pendiente_revision" && !params.forceReview) {
      setPhase({
        kind: "out_of_range",
        action,
        distance: res.distance ?? 0,
        radius: res.radius ?? 0,
        coords: { lat: params.latitude!, lng: params.longitude!, acc: params.accuracy },
      });
      return;
    }
    setPhase({
      kind: "success",
      action,
      distance: res.distance ?? null,
      radius: res.radius,
      locationState: res.location_state,
    });
    setTimeout(() => onDone(), 2200);
  };

  const handleAction = async (action: Action) => {
    setPhase({ kind: "locating", action });
    setReviewNote("");
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          reject(new Error("Geolocalización no disponible en este dispositivo"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 0,
        });
      });
      await submit(action, {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
      });
    } catch (e: any) {
      const msg = e?.code === 1
        ? "Permiso de ubicación denegado. No es posible fichar sin GPS."
        : e?.code === 3
          ? "No se pudo obtener tu ubicación a tiempo. Inténtalo de nuevo."
          : (e?.message ?? "Error al obtener ubicación");
      setPhase({ kind: "error", message: msg });
    }
  };

  if (phase.kind === "locating" || phase.kind === "submitting") {
    return (
      <div className="space-y-4 text-center py-10">
        <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
        <div>
          <p className="font-semibold">{phase.kind === "locating" ? "Obteniendo ubicación…" : "Registrando fichaje…"}</p>
          <p className="text-sm text-muted-foreground mt-1">{ACTION_LABEL[phase.action]}</p>
        </div>
      </div>
    );
  }

  if (phase.kind === "success") {
    return (
      <div className="space-y-4 text-center py-8">
        <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <div>
          <p className="text-xl font-bold">{ACTION_LABEL[phase.action]} registrada</p>
          {phase.distance != null && (
            <p className="text-sm text-muted-foreground mt-1">
              <MapPin className="inline h-3 w-3 mr-1" />
              A {phase.distance} m de la tienda (radio {phase.radius} m)
              {phase.locationState === "ubicacion_imprecisa" && " · precisión baja"}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (phase.kind === "out_of_range") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-destructive/10 border border-destructive/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-destructive">Estás fuera del rango permitido</p>
              <p className="text-sm text-foreground/80 mt-1">
                Estás a <strong>{phase.distance} m</strong> de la tienda. El radio permitido es de <strong>{phase.radius} m</strong>.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                El fichaje automático fue bloqueado. Puedes solicitar revisión manual al supervisor.
              </p>
            </div>
          </div>
        </div>
        <Textarea
          placeholder="Motivo de la solicitud (opcional)"
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          className="rounded-xl"
        />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onCancel} className="rounded-xl">Cancelar</Button>
          <Button
            onClick={() => submit(phase.action, {
              latitude: phase.coords.lat,
              longitude: phase.coords.lng,
              accuracy: phase.coords.acc,
              forceReview: true,
              observations: reviewNote || `Fichaje fuera de rango (${phase.distance} m)`,
            })}
            className="rounded-xl"
          >
            Solicitar revisión
          </Button>
        </div>
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className="space-y-4 text-center py-6">
        <div className="h-14 w-14 mx-auto rounded-full bg-destructive/15 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <p className="text-sm text-foreground">{phase.message}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onCancel} className="rounded-xl">Salir</Button>
          <Button onClick={() => setPhase({ kind: "idle" })} className="rounded-xl">Reintentar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Empleado</p>
          <p className="text-xl font-bold text-foreground">{employeeName}</p>
        </div>
        <button
          onClick={onCancel}
          className="h-10 w-10 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors"
          aria-label="Cancelar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="text-center py-4">
        <div className="text-6xl font-black tabular-nums text-foreground">{time}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => handleAction("entrada")}
          className="h-20 text-base font-bold rounded-2xl bg-[hsl(142_72%_29%)] hover:bg-[hsl(142_72%_24%)] text-white flex-col gap-1"
        >
          <LogIn className="h-6 w-6" />
          Entrada
        </Button>
        <Button
          onClick={() => handleAction("salida")}
          className="h-20 text-base font-bold rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground flex-col gap-1"
        >
          <LogOut className="h-6 w-6" />
          Salida
        </Button>
        <Button
          onClick={() => handleAction("inicio_descanso")}
          variant="outline"
          className="h-16 text-sm font-semibold rounded-2xl flex-col gap-1"
        >
          <Coffee className="h-5 w-5" />
          Inicio descanso
        </Button>
        <Button
          onClick={() => handleAction("fin_descanso")}
          variant="outline"
          className="h-16 text-sm font-semibold rounded-2xl flex-col gap-1"
        >
          <CoffeeIcon className="h-5 w-5" />
          Fin descanso
        </Button>
      </div>
    </div>
  );
}
