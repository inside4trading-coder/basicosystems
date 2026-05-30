import { Card } from "@/components/ui/card";
import { Hourglass } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  bullets?: string[];
}

export default function EspanaPlaceholder({ title, description, bullets }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>}
      </div>
      <Card className="p-10 rounded-2xl border-dashed flex flex-col items-center text-center">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
          <Hourglass className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-bold">Próximamente</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Esta sección se habilitará en un próximo bloque de Basico España.
        </p>
        {bullets && bullets.length > 0 && (
          <ul className="mt-4 text-left text-xs text-muted-foreground space-y-1 max-w-md">
            {bullets.map((b) => (
              <li key={b}>• {b}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
