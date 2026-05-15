import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface FichajeIdentifyProps {
  onIdentify: (code: string) => void;
}

export function FichajeIdentify({ onIdentify }: FichajeIdentifyProps) {
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length > 0) onIdentify(code.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Identifícate</h2>
        <p className="text-sm text-muted-foreground">
          Introduce tu código de empleado para fichar
        </p>
      </div>
      <Input
        type="text"
        inputMode="numeric"
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="• • • •"
        className="h-16 text-center text-3xl font-black tracking-[0.5em] tabular-nums rounded-2xl"
      />
      <Button
        type="submit"
        disabled={code.trim().length === 0}
        className="w-full h-14 text-base font-semibold rounded-2xl"
      >
        Continuar
        <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
    </form>
  );
}
