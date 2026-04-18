import { Building2, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAdminData } from "@/hooks/useAdminData";

export default function Administracion() {
  const { instances, obligations, loading, error } = useAdminData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administración</h1>
          <p className="text-muted-foreground text-sm">
            Gestión de obligaciones y pagos recurrentes
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            {obligations.length} obligaciones activas · {instances.length} instancias cargadas
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
