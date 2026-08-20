import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Delete, Loader2 } from "lucide-react";
import type { PortalOperator } from "@/lib/operatorPortal";

interface Props {
  operator: PortalOperator;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: (pin: string) => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

export function OperatorPinPad({ operator, loading, error, onBack, onSubmit }: Props) {
  const [pin, setPin] = useState("");

  function press(k: string) {
    if (loading) return;
    if (k === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (!k) return;
    setPin((p) => {
      const next = (p + k).slice(0, 6);
      if (next.length === 6) setTimeout(() => onSubmit(next), 50);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} disabled={loading}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Cambiar trabajador
      </Button>

      <div className="text-center">
        <div className="text-sm text-muted-foreground">Ingresa tu PIN</div>
        <div className="text-2xl font-bold uppercase">{operator.name}</div>
      </div>

      <div className="flex justify-center gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full border-2 ${i < pin.length ? "border-primary bg-primary" : "border-muted-foreground/40"}`}
          />
        ))}
      </div>

      {error && <p className="text-center text-sm font-medium text-destructive">{error}</p>}
      {loading && (
        <div className="flex justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      <div className="mx-auto grid max-w-xs grid-cols-3 gap-3">
        {KEYS.map((k, i) => (
          <button
            key={i}
            type="button"
            disabled={!k || loading}
            onClick={() => press(k)}
            className={`h-16 rounded-lg border text-2xl font-semibold transition-colors ${
              k ? "bg-card active:bg-accent hover:bg-accent" : "invisible"
            }`}
            aria-label={k === "del" ? "Borrar" : k}
          >
            {k === "del" ? <Delete className="mx-auto h-6 w-6" /> : k}
          </button>
        ))}
      </div>
    </div>
  );
}
