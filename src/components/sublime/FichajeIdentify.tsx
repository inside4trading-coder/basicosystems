import { useState } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { ArrowRight, KeyRound } from "lucide-react";

interface FichajeIdentifyProps {
  onSubmit: (pin: string) => Promise<void> | void;
  loading?: boolean;
  error?: string | null;
}

export function FichajeIdentify({ onSubmit, loading, error }: FichajeIdentifyProps) {
  const [pin, setPin] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4 || loading) return;
    await onSubmit(pin);
    setPin("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 text-primary mb-2">
          <KeyRound className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Introduce tu PIN</h2>
        <p className="text-sm text-muted-foreground">
          4 dígitos si es tu primer acceso, 6 si ya configuraste tu PIN personal.
        </p>
      </div>

      <div className="flex justify-center">
        <InputOTP
          maxLength={6}
          value={pin}
          onChange={setPin}
          inputMode="numeric"
          pattern="^[0-9]*$"
          autoFocus
        >
          <InputOTPGroup className="gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot
                key={i}
                index={i}
                className="h-14 w-12 sm:h-16 sm:w-14 text-2xl rounded-xl border-border"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error && (
        <p className="text-sm text-center text-destructive font-medium">{error}</p>
      )}

      <Button
        type="submit"
        disabled={pin.length < 4 || loading}
        className="w-full h-14 text-base font-semibold rounded-2xl"
      >
        {loading ? "Verificando…" : "Continuar"}
        {!loading && <ArrowRight className="ml-2 h-5 w-5" />}
      </Button>
    </form>
  );
}
