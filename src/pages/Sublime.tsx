import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Store, Clock, Building2, ArrowRight, ExternalLink } from "lucide-react";

export default function Sublime() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Store className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            Sublime
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Operaciones de la tienda física Sublime
          </p>
        </div>
      </div>

      {/* Submódulos */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Submódulos
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Fichaje */}
          <Link to="/sublime/admin/fichaje" className="group">
            <Card className="p-6 rounded-2xl border-border/60 hover:border-primary/40 hover:shadow-lg transition-all h-full flex flex-col">
              <div className="flex items-start justify-between mb-5">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">Fichaje</h3>
              <p className="text-sm text-muted-foreground flex-1">
                Control de asistencia y horarios del equipo de tienda.
              </p>
              <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-2 text-xs text-muted-foreground">
                <span>Asistencia · Horarios · Incidencias · Métricas</span>
              </div>
            </Card>
          </Link>

          {/* Administración */}
          <Link to="/sublime/admin/obligaciones" className="group">
            <Card className="p-6 rounded-2xl border-border/60 hover:border-primary/40 hover:shadow-lg transition-all h-full flex flex-col">
              <div className="flex items-start justify-between mb-5">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">Administración</h3>
              <p className="text-sm text-muted-foreground flex-1">
                Obligaciones fijas y recurrentes propias de la tienda Sublime.
              </p>
              <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-2 text-xs text-muted-foreground">
                <span>Obligaciones · Pagos · Vencimientos · Histórico</span>
              </div>
            </Card>
          </Link>
        </div>
      </section>

      {/* Acceso rápido vista pública */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Accesos rápidos
        </h2>
        <Card className="p-5 rounded-2xl border-border/60 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-foreground">Pantalla pública de fichaje</p>
            <p className="text-sm text-muted-foreground">
              Vista para tablet de tienda en <code className="text-xs">/sublime/fichaje</code>
            </p>
          </div>
          <Link
            to="/sublime/fichaje"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline shrink-0"
          >
            Abrir
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Card>
      </section>
    </div>
  );
}
