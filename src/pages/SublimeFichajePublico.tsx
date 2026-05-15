import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { FichajeIdentify } from "@/components/sublime/FichajeIdentify";
import { FichajeClock } from "@/components/sublime/FichajeClock";
import { toast } from "@/hooks/use-toast";

export default function SublimeFichajePublico() {
  const [now, setNow] = useState(new Date());
  const [identified, setIdentified] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fechaLarga = now.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const horaLarga = now.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const handleAction = (kind: "entrada" | "salida") => {
    toast({
      title: kind === "entrada" ? "Entrada registrada" : "Salida registrada",
      description: `Fichaje a las ${horaLarga}`,
    });
    setIdentified(null);
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-background via-background to-card flex flex-col">
      {/* Header */}
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

      {/* Card central */}
      <main className="flex-1 flex items-center justify-center px-4 pb-8">
        <Card className="w-full max-w-md p-6 sm:p-8 rounded-3xl border-border/60 shadow-2xl bg-card/80 backdrop-blur">
          {identified ? (
            <FichajeClock
              employeeName={`Empleado ${identified}`}
              onEntrada={() => handleAction("entrada")}
              onSalida={() => handleAction("salida")}
              onCancel={() => setIdentified(null)}
            />
          ) : (
            <FichajeIdentify onIdentify={setIdentified} />
          )}
        </Card>
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground/70">
        Sublime · Control de presencia
      </footer>
    </div>
  );
}
