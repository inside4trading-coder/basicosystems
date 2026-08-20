import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Delete, Loader2, ShieldCheck } from "lucide-react";
import type { PortalOperator } from "@/lib/operatorPortal";

interface Props {
  operator: PortalOperator;
  loading: boolean;
  error: string | null;
  /** true cuando el operario nunca ha definido su PIN */
  isNew: boolean;
  onBack: () => void;
  /** En modo nuevo se llama con el PIN ya confirmado */
  onSubmit: (pin: string) => void;
  onClearError: () => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

export function OperatorPinPad({ operator, loading, error, isNew, onBack, onSubmit, onClearError }: Props) {
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Si el servidor devuelve error en modo nuevo, reiniciamos el flujo.
  useEffect(() => {
    if (error) {
      setPin("");
      if (isNew) setFirstPin(null);
    }
  }, [error, isNew]);

  const confirming = isNew && firstPin !== null;

  function handleComplete(value: string) {
    if (!isNew) {
      onSubmit(value);
      return;
    }
    if (firstPin === null) {
      setFirstPin(value);
      setPin("");
      return;
    }
    if (value !== firstPin) {
      setLocalError("Los PIN no coinciden. Vuelve a empezar.");
      setFirstPin(null);
      setPin("");
      return;
    }
    onSubmit(value);
  }

  function press(k: string) {
    if (loading) return;
    setLocalError(null);
    if (error) onClearError();
    if (k === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (!k) return;
    setPin((p) => {
      const next = (p + k).slice(0, 6);
      if (next.length === 6) setTimeout(() => handleComplete(next), 80);
      return next;
    });
  }

  const shownError = localError ?? error;

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (confirming) {
            setFirstPin(null);
            setPin("");
            setLocalError(null);
            return;
          }
          onBack();
        }}
        disabled={loading}
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> {confirming ? "Volver" : "Cambiar trabajador"}
      </Button>

      <div className="text-center">
        <div className="text-2xl font-bold uppercase">{operator.name}</div>
        <div className="mt-1 text-base font-semibold">
          {isNew ? (confirming ? "Confirma tu nuevo PIN" : "Crea tu nuevo PIN") : "Ingresa tu PIN"}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {isNew
            ? confirming
              ? "Escríbelo otra vez para confirmar que quedó bien."
              : "Elige 6 números que solo tú sepas."
            : "6 números."}
        </div>
      </div>

      {isNew && !confirming && (
        <div className="mx-auto flex max-w-xs items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-left">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Es tu <strong className="text-foreground">PIN secreto</strong>: con él entrarás siempre a este portal para
            escanear tus prendas y ver tu producción. <strong className="text-foreground">Memorízalo y no se lo des a
            nadie.</strong> Si lo olvidas, tu supervisor tendrá que asignarte uno nuevo.
          </p>
        </div>
      )}

      <div className="flex justify-center gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full border-2 ${i < pin.length ? "border-primary bg-primary" : "border-muted-foreground/40"}`}
          />
        ))}
      </div>

      {shownError && <p className="text-center text-sm font-medium text-destructive">{shownError}</p>}
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
