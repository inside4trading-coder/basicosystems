import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, X } from "lucide-react";

interface FichajeClockProps {
  employeeName: string;
  onEntrada: () => void;
  onSalida: () => void;
  onCancel: () => void;
}

export function FichajeClock({ employeeName, onEntrada, onSalida, onCancel }: FichajeClockProps) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

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
          onClick={onEntrada}
          className="h-20 text-base font-bold rounded-2xl bg-[hsl(142_72%_29%)] hover:bg-[hsl(142_72%_24%)] text-white flex-col gap-1"
        >
          <LogIn className="h-6 w-6" />
          Entrada
        </Button>
        <Button
          onClick={onSalida}
          className="h-20 text-base font-bold rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground flex-col gap-1"
        >
          <LogOut className="h-6 w-6" />
          Salida
        </Button>
      </div>
    </div>
  );
}
