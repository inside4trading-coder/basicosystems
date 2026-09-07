import { ClipboardList, Radio } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { MockNotice } from "@/components/sublime/hub/MockNotice";

export default function SublimeInventarioConteos() {
  return (
    <div className="space-y-6">
      <HubHeader
        icon={ClipboardList}
        title="Conteos"
        subtitle="Conteos ciegos por ubicación, preparados para RFID"
      />
      <MockNotice text="Módulo en diseño: aquí vivirán los conteos por ubicación y la lectura masiva RFID." />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 rounded-2xl border-border/60">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Conteo por ubicación
            </p>
            <Badge variant="secondary">Próximamente</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Conteo ciego de almacén y tienda con diferencias por variante y ajuste auditado.
          </p>
        </Card>
        <Card className="p-5 rounded-2xl border-border/60">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Lectura RFID
            </p>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Radio className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Cada unidad ya contempla su etiqueta EPC, de modo que el conteo masivo no requiere
            rehacer el modelo de inventario.
          </p>
        </Card>
      </div>
    </div>
  );
}
