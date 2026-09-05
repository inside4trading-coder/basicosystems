import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { FichajeIdentify } from "@/components/sublime/FichajeIdentify";
import { FichajePersonalPinSetup } from "@/components/sublime/FichajePersonalPinSetup";
import { FichajeClock } from "@/components/sublime/FichajeClock";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDMY } from "@/lib/dateUtils";

type Stage = "identify" | "setup" | "clock";

interface ActiveSession {
  token: string;
  employee: { id: string; name: string; internal_id: string };
}

export default function SublimeFichajePublico() {
  const [now, setNow] = useState(new Date());
  const [stage, setStage] = useState<Stage>("identify");
  const [setupToken, setSetupToken] = useState<string | null>(null);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fechaLarga = formatDMY(now);
  const horaLarga = now.toLocaleTimeString("es-ES", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const reset = () => {
    setStage("identify");
    setSetupToken(null);
    setSession(null);
    setError(null);
  };

  const handlePinSubmit = async (pin: string) => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("sublime-pin-public", {
        body: { action: "verify", pin },
      });
      if (invokeErr) throw invokeErr;
      const res = data as any;
      if (!res?.ok) {
        setError(res?.error ?? "PIN incorrecto");
        return;
      }
      if (res.requires_personal_setup) {
        setSetupToken(res.session_token);
        setStage("setup");
      } else {
        setSession({ token: res.session_token, employee: res.employee });
        setStage("clock");
      }
    } catch (e: any) {
      setError(e.message ?? "Error al verificar PIN");
    } finally {
      setLoading(false);
    }
  };

  const handlePersonalSetup = async (newPin: string, confirmPin: string) => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("sublime-pin-public", {
        body: { action: "set_personal_pin", session_token: setupToken, new_pin: newPin, confirm_pin: confirmPin },
      });
      if (invokeErr) throw invokeErr;
      const res = data as any;
      if (!res?.ok) {
        setError(res?.error ?? "No se pudo crear el PIN");
        return;
      }
      toast({ title: "PIN personal creado", description: "Ya puedes fichar con tu nuevo PIN." });
      setSetupToken(null);
      setSession({ token: res.session_token, employee: res.employee });
      setStage("clock");
    } catch (e: any) {
      setError(e.message ?? "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-background via-background to-card flex flex-col">
      <header className="px-6 pt-8 pb-4 flex flex-col items-center text-center">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold">
            Sublime
          </span>
        </div>
        <h1 className="text-5xl sm:text-7xl font-black tabular-nums text-foreground mt-2">
          {horaLarga}
        </h1>
        <p className="text-sm text-muted-foreground capitalize mt-1">{fechaLarga}</p>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-8">
        <Card className="glass-panel w-full max-w-md p-6 sm:p-8 rounded-3xl shadow-2xl">
          {stage === "identify" && (
            <FichajeIdentify onSubmit={handlePinSubmit} loading={loading} error={error} />
          )}
          {stage === "setup" && (
            <FichajePersonalPinSetup onSubmit={handlePersonalSetup} loading={loading} error={error} />
          )}
          {stage === "clock" && session && (
            <FichajeClock
              employeeName={session.employee.name}
              sessionToken={session.token}
              onDone={reset}
              onCancel={reset}
            />
          )}
        </Card>
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground/70">
        Sublime · Control de presencia
      </footer>
    </div>
  );
}
