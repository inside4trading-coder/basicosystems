import { Users2, Loader2, AlertTriangle } from "lucide-react";
import { useCrewData } from "@/hooks/useCrewData";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Activo", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  inactive: { label: "Inactivo", className: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30" },
  archived: { label: "Archivado", className: "bg-muted text-muted-foreground border-border" },
  graduated: { label: "Graduado", className: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
};

export default function Crew() {
  const { employees, loading, error } = useCrewData();

  const activeCount = employees.filter((e) => e.status === "active").length;
  const totalCount = employees.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Users2 className="h-6 w-6 text-primary" />
            Crew
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión interna del equipo
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="kpi-card p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Total equipo
          </p>
          <p className="text-3xl font-black tracking-tight mt-1">{totalCount}</p>
        </div>
        <div className="kpi-card p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Activos
          </p>
          <p className="text-3xl font-black tracking-tight mt-1 text-emerald-600">{activeCount}</p>
        </div>
        <div className="kpi-card p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Archivados
          </p>
          <p className="text-3xl font-black tracking-tight mt-1">{totalCount - activeCount}</p>
        </div>
      </div>

      {/* Crew Table */}
      <div className="kpi-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">ID</th>
                <th className="text-left p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre</th>
                <th className="text-left p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Cargo</th>
                <th className="text-left p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Ubicación</th>
                <th className="text-left p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Estado</th>
                <th className="text-left p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Inicio</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const st = statusConfig[emp.status] ?? statusConfig.active;
                return (
                  <tr key={emp.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-xs text-muted-foreground">{emp.internal_id}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={emp.photo_url ?? undefined} />
                          <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                            {emp.first_name[0]}{emp.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-semibold">{emp.first_name} {emp.last_name}</span>
                      </div>
                    </td>
                    <td className="p-3">{emp.position}</td>
                    <td className="p-3 text-muted-foreground">{emp.location}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={st.className}>{st.label}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {new Date(emp.start_date).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
