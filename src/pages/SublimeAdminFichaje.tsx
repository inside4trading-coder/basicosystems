import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminMetricCard } from "@/components/sublime/AdminMetricCard";
import {
  ExternalLink,
  Store,
  Clock,
  CalendarDays,
  AlertCircle,
  BarChart3,
  Timer,
  CheckCircle2,
  UserX,
  Hourglass,
} from "lucide-react";

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Clock;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}

export default function SublimeAdminFichaje() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Sublime · Fichaje
            </h1>
            <p className="text-sm text-muted-foreground">
              Control de asistencia del equipo de tienda
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/sublime/fichaje" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Vista pública
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="asistencia" className="space-y-6">
        <TabsList className="bg-muted rounded-xl p-1 h-auto flex-wrap">
          <TabsTrigger value="asistencia" className="rounded-lg data-[state=active]:bg-background">
            Asistencia hoy
          </TabsTrigger>
          <TabsTrigger value="horarios" className="rounded-lg data-[state=active]:bg-background">
            Horarios
          </TabsTrigger>
          <TabsTrigger value="incidencias" className="rounded-lg data-[state=active]:bg-background">
            Incidencias
          </TabsTrigger>
          <TabsTrigger value="metricas" className="rounded-lg data-[state=active]:bg-background">
            Métricas
          </TabsTrigger>
        </TabsList>

        {/* Asistencia hoy */}
        <TabsContent value="asistencia">
          <Card className="rounded-2xl border-border/60 overflow-hidden">
            <div className="grid grid-cols-5 px-6 py-3 bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
              <div>Empleado</div>
              <div>Entrada</div>
              <div>Salida</div>
              <div>Horas</div>
              <div>Estado</div>
            </div>
            <EmptyState
              icon={Clock}
              title="Aún no hay fichajes registrados hoy"
              description="Los fichajes del equipo aparecerán aquí en tiempo real cuando empiecen a registrarse."
            />
          </Card>
        </TabsContent>

        {/* Horarios */}
        <TabsContent value="horarios">
          <Card className="rounded-2xl border-border/60">
            <EmptyState
              icon={CalendarDays}
              title="Configura los horarios del equipo"
              description="Define los turnos semanales de cada empleado para empezar a comparar fichajes con horarios planificados."
            />
          </Card>
        </TabsContent>

        {/* Incidencias */}
        <TabsContent value="incidencias">
          <Card className="rounded-2xl border-border/60">
            <EmptyState
              icon={AlertCircle}
              title="Sin incidencias pendientes"
              description="Aquí aparecerán retrasos, ausencias y solicitudes que requieran tu revisión."
            />
          </Card>
        </TabsContent>

        {/* Métricas */}
        <TabsContent value="metricas" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <AdminMetricCard label="Horas semana" value="—" hint="Total del equipo" icon={Timer} />
            <AdminMetricCard label="Puntualidad" value="—" hint="Últimos 7 días" icon={CheckCircle2} />
            <AdminMetricCard label="Ausencias" value="—" hint="Mes en curso" icon={UserX} />
            <AdminMetricCard label="Horas extra" value="—" hint="Mes en curso" icon={Hourglass} />
          </div>
          <Card className="rounded-2xl border-border/60">
            <EmptyState
              icon={BarChart3}
              title="Las métricas aparecerán cuando haya datos"
              description="En cuanto el equipo empiece a fichar, verás aquí KPIs de puntualidad, asistencia y horas trabajadas."
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
