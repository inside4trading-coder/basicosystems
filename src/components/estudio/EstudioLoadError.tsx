import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function EstudioLoadError({
  message,
  hint,
  onRetry,
}: {
  message: string;
  hint?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="p-6 rounded-2xl border-destructive/40 bg-destructive/5 space-y-3">
      <p className="text-sm text-destructive font-medium">{message}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reintentar
        </Button>
      )}
    </Card>
  );
}
