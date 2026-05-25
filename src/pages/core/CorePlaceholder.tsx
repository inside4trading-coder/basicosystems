import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface Props {
  title: string;
  description?: string;
}

export default function CorePlaceholder({ title, description }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <Card className="p-12 rounded-2xl border-dashed border-border flex flex-col items-center justify-center text-center">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Construction className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold">Próximamente</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Esta sección se habilitará en un bloque futuro de BASICO CORE.
        </p>
      </Card>
    </div>
  );
}
