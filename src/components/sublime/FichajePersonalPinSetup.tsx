import { useState } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";

interface Props {
  onSubmit: (newPin: string, confirmPin: string) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export function FichajePersonalPinSetup({ onSubmit, loading, error }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleNext = () => {
    if (pin1.length !== 6) {
      setLocalError("El PIN debe tener 6 dígitos");
      return;
    }
    setLocalError(null);
    setStep(2);
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin2.length !== 6) {
      setLocalError("Confirma los 6 dígitos");
      return;
    }
    if (pin1 !== pin2) {
      setLocalError("Los PINs no coinciden");
      return;
    }
    setLocalError(null);
    await onSubmit(pin1, pin2);
  };

  const shownError = localError ?? error;

  return (
    <form onSubmit={handleConfirm} className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 text-primary mb-2">
          <Check className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          {step === 1 ? "Crea tu PIN personal" : "Confírmalo"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {step === 1
            ? "Elige un código de 6 dígitos. Será tuyo y nadie más podrá verlo."
            : "Vuelve a escribir tu PIN para confirmarlo."}
        </p>
      </div>

      <div className="flex justify-center">
        <InputOTP
          maxLength={6}
          value={step === 1 ? pin1 : pin2}
          onChange={step === 1 ? setPin1 : setPin2}
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

      {shownError && (
        <p className="text-sm text-center text-destructive font-medium">{shownError}</p>
      )}

      {step === 1 ? (
        <Button
          type="button"
          onClick={handleNext}
          disabled={pin1.length !== 6}
          className="w-full h-14 rounded-2xl text-base font-semibold"
        >
          Continuar
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => { setStep(1); setPin2(""); setLocalError(null); }}
            className="h-14 rounded-2xl"
            disabled={loading}
          >
            Atrás
          </Button>
          <Button
            type="submit"
            disabled={pin2.length !== 6 || loading}
            className="flex-1 h-14 rounded-2xl text-base font-semibold"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Crear mi PIN"}
          </Button>
        </div>
      )}
    </form>
  );
}
