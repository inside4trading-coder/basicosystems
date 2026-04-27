import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Pencil } from "lucide-react";
import type { ObligationInstance } from "@/types/admin";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/lib/dateUtils";

interface Props {
  instance: ObligationInstance | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit?: (inst: ObligationInstance) => void;
}

const fmtMoney = (n: number, c = "USD") =>
  new Intl.NumberFormat("es-VE", { style: "currency", currency: c }).format(n);

export function AdminInstanceSheet({ instance, open, onOpenChange, onEdit }: Props) {
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setProofUrl(null);
    const path = instance?.payment_proof_url;
    if (!open || !path) return;
    supabase.storage
      .from("admin-payments")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled) setProofUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, instance?.payment_proof_url]);

  if (!instance) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-xl font-black">{instance.obligation_name ?? "Instancia"}</SheetTitle>
          <SheetDescription>{instance.period_label}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs uppercase font-bold text-muted-foreground">Vencimiento</div>
              <div>{parseLocalDate(instance.due_date).toLocaleDateString("es-VE")}</div>
            </div>
            <div>
              <div className="text-xs uppercase font-bold text-muted-foreground">Monto</div>
              <div className="font-black">{fmtMoney(instance.amount, instance.currency)}</div>
            </div>
            <div>
              <div className="text-xs uppercase font-bold text-muted-foreground">Estado</div>
              <Badge variant="outline" className="capitalize">{instance.status.replace("_", " ")}</Badge>
            </div>
            <div>
              <div className="text-xs uppercase font-bold text-muted-foreground">Importancia</div>
              <Badge variant="outline" className="capitalize">{instance.importance ?? "—"}</Badge>
            </div>
            {instance.category && (
              <div>
                <div className="text-xs uppercase font-bold text-muted-foreground">Categoría</div>
                <div>{instance.category}</div>
              </div>
            )}
            {instance.responsible && (
              <div>
                <div className="text-xs uppercase font-bold text-muted-foreground">Responsable</div>
                <div>{instance.responsible}</div>
              </div>
            )}
          </div>

          {instance.notes && (
            <div>
              <div className="text-xs uppercase font-bold text-muted-foreground mb-1">Notas</div>
              <div className="text-sm">{instance.notes}</div>
            </div>
          )}

          {instance.payment_proof_url && (
            <div>
              <div className="text-xs uppercase font-bold text-muted-foreground mb-1">Comprobante de pago</div>
              {proofUrl ? (
                <Button asChild variant="outline" className="w-full justify-start">
                  <a href={proofUrl} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4" />
                    Ver comprobante
                  </a>
                </Button>
              ) : (
                <div className="text-xs text-muted-foreground">Cargando…</div>
              )}
            </div>
          )}

          {instance.obligation_id && (
            <Button asChild className="w-full" variant="outline">
              <Link to={`/administracion/${instance.obligation_id}`}>Ver obligación completa</Link>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
