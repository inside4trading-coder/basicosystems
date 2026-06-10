import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateContact } from "@/hooks/useRRPPData";
import type { Contact, RelationshipStatus } from "@/types/rrpp";
import { RELATIONSHIP_LABELS } from "./rrppConstants";

const FLOW: RelationshipStatus[] = [
  "nuevo", "contactado", "envio_requerido", "producto_listo_envio", "producto_enviado", "colaboracion_en_curso",
];

const TERMINAL: RelationshipStatus[] = [
  "colaboracion_exitosa", "no_colaboro", "descartado",
];

const DESCRIPTIONS: Record<RelationshipStatus, string> = {
  nuevo: "Contacto recién agregado. Aún no se ha realizado ninguna acción.",
  contactado: "Se inició el primer contacto vía mensaje, llamada o reunión.",
  envio_requerido: "Pedido registrado: se requiere preparar y empaquetar el producto.",
  producto_listo_envio: "Producto empaquetado y listo para envío o entrega personal.",
  producto_enviado: "Producto enviado con guía o entregado al contacto.",
  colaboracion_en_curso: "Hay una colaboración activa en ejecución.",
  colaboracion_exitosa: "La colaboración finalizó con éxito y generó valor.",
  no_colaboro: "El contacto no aceptó la propuesta o no respondió.",
  descartado: "El contacto fue descartado y no se hará seguimiento.",
};

interface Props {
  contact: Contact;
  onChanged: () => void;
}

export function RRPPPipeline({ contact, onChanged }: Props) {
  const [updating, setUpdating] = useState(false);
  const current = contact.relationship_status;
  const currentIdx = FLOW.indexOf(current);
  const isTerminal = TERMINAL.includes(current);

  const changeStatus = async (s: RelationshipStatus) => {
    if (s === current) return;
    setUpdating(true);
    try {
      await updateContact(contact.id, { relationship_status: s });
      toast.success(`Estado: ${RELATIONSHIP_LABELS[s]}`);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="kpi-card">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div>
            <h3 className="font-bold">Pipeline de relación</h3>
            <p className="text-xs text-muted-foreground">Etapa actual: {RELATIONSHIP_LABELS[current]}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={updating}>
                Cambiar estado <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(RELATIONSHIP_LABELS) as RelationshipStatus[]).map((s) => (
                <DropdownMenuItem key={s} onClick={() => changeStatus(s)}>
                  {RELATIONSHIP_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Linear stepper */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {FLOW.map((s, i) => {
            const isCurrent = s === current && !isTerminal;
            const isPast = !isTerminal && i < currentIdx;
            const dotClass = isCurrent
              ? "bg-primary text-primary-foreground border-primary"
              : isPast
                ? "bg-primary/20 text-primary border-primary/40"
                : "bg-muted text-muted-foreground border-border";
            const lineClass = isPast ? "bg-primary/40" : "bg-border";
            return (
              <div key={s} className="flex items-center gap-2 shrink-0">
                <div className={`flex flex-col items-center gap-1 min-w-[110px]`}>
                  <div className={`h-9 w-9 rounded-full border-2 flex items-center justify-center text-xs font-bold ${dotClass}`}>
                    {isPast ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={`text-[11px] text-center font-medium ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                    {RELATIONSHIP_LABELS[s]}
                  </span>
                </div>
                {i < FLOW.length - 1 && <div className={`h-0.5 w-6 ${lineClass}`} />}
              </div>
            );
          })}
        </div>

        {/* Terminal branches */}
        <div className="mt-6 pt-6 border-t">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Estados finales</p>
          <div className="flex gap-2 flex-wrap">
            {TERMINAL.map((s) => {
              const active = current === s;
              return (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  disabled={updating}
                  className={`px-3 py-1.5 rounded-md border text-xs font-medium transition ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  }`}
                >
                  {RELATIONSHIP_LABELS[s]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div className="mt-6 p-4 rounded-md bg-muted/50">
          <p className="text-sm">{DESCRIPTIONS[current]}</p>
        </div>
      </div>

      {current === "nuevo" && (
        <div className="kpi-card text-center py-10">
          <p className="font-semibold">Registra el primer movimiento</p>
          <p className="text-sm text-muted-foreground mt-1">
            Agrega una interacción, registra una colaboración o cambia manualmente el estado cuando inicies el contacto. Al guardar una colaboración el pipeline avanzará automáticamente.
          </p>
        </div>
      )}
    </div>
  );
}
