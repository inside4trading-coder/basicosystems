import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserRound } from "lucide-react";
import type { PortalOperator } from "@/lib/operatorPortal";


interface Props {
  operators: PortalOperator[];
  loading: boolean;
  onSelect: (op: PortalOperator) => void;
}

export function OperatorPicker({ operators, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (operators.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        No hay perfiles con el portal habilitado. Pídelo a tu supervisor.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold">Selecciona tu perfil</h2>
      <div className="grid gap-3">
        {operators.map((op) => (
          <button
            key={op.id}
            type="button"
            onClick={() => onSelect(op)}
            className="flex w-full items-center gap-4 rounded-lg border bg-card p-4 text-left transition-colors active:bg-accent hover:bg-accent"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
              {op.photo_url ? (
                <img src={op.photo_url} alt={op.name} className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold uppercase">{op.name}</div>
              {op.alias && <div className="truncate text-sm text-muted-foreground">{op.alias}</div>}
              {!op.pin_set && (
                <Badge variant="outline" className="mt-1 text-xs">
                  Crear PIN
                </Badge>
              )}
            </div>

          </button>
        ))}
      </div>
    </div>
  );
}
