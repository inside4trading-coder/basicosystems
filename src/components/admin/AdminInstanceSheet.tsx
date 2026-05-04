import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileText, Pencil } from "lucide-react";
import type { ObligationInstance } from "@/types/admin";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/lib/dateUtils";
import { MarkPaidDialog } from "./MarkPaidDialog";

interface Props {
  instance: ObligationInstance | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit?: (inst: ObligationInstance) => void;
  onPaid?: () => void;
}

const fmtMoney = (n: number, c = "USD") =>
  new Intl.NumberFormat("es-VE", { style: "currency", currency: c }).format(n);

export function AdminInstanceSheet({ instance, open, onOpenChange, onEdit, onPaid }: Props) {
  const [proofUrls, setProofUrls] = useState<{ path: string; url: string }[]>([]);
  const [paying, setPaying] = useState(false);

  const proofs = instance?.payment_proof_urls ?? [];

  useEffect(() => {
    let cancelled = false;
    setProofUrls([]);
    if (!open || !proofs || proofs.length === 0) return;
    Promise.all(
      proofs.map(async (path) => {
        const { data } = await supabase.storage.from("admin-payments").createSignedUrl(path, 3600);
        return { path, url: data?.signedUrl ?? "" };
      }),
    ).then((res) => {
      if (!cancelled) setProofUrls(res.filter((r) => r.url));
    });
    return () => {
      cancelled = true;
    };
  }, [open, JSON.stringify(proofs)]);

  if (!instance) return null;

  const isPaid = instance.status === "pagado";
  const canMarkPaid = instance.status !== "pagado" && instance.status !== "anulado";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
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
                <div className="font-black">{!instance.amount || instance.amount <= 0 ? "Variable" : fmtMoney(instance.amount, instance.currency)}</div>
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

            {isPaid && (
              <div className="rounded-md border bg-status-success/5 p-3 space-y-2">
                <div className="text-xs uppercase font-bold text-status-success">Información de pago</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {instance.paid_at && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-muted-foreground">Pagado el</div>
                      <div>{parseLocalDate(instance.paid_at).toLocaleDateString("es-VE")}</div>
                    </div>
                  )}
                  {instance.paid_by && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-muted-foreground">Pagado por</div>
                      <div className="truncate">{instance.paid_by}</div>
                    </div>
                  )}
                  {instance.payment_reference && (
                    <div className="col-span-2">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground">Referencia</div>
                      <div className="truncate">{instance.payment_reference}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {proofs && proofs.length > 0 && (
              <div>
                <div className="text-xs uppercase font-bold text-muted-foreground mb-1">
                  Comprobante{proofs.length === 1 ? "" : "s"} ({proofs.length})
                </div>
                <div className="space-y-1.5">
                  {proofUrls.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Cargando…</div>
                  ) : (
                    proofUrls.map((p, idx) => (
                      <Button key={p.path} asChild variant="outline" className="w-full justify-start">
                        <a href={p.url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-4 w-4" />
                          Ver comprobante {idx + 1}
                        </a>
                      </Button>
                    ))
                  )}
                </div>
              </div>
            )}

            {canMarkPaid && (
              <Button variant="brand" className="w-full gap-1.5" onClick={() => setPaying(true)}>
                <CheckCircle className="h-4 w-4" /> Marcar como pagada
              </Button>
            )}

            {isPaid && (
              <Button variant="outline" className="w-full gap-1.5" onClick={() => setPaying(true)}>
                <Pencil className="h-4 w-4" /> Editar info de pago / agregar comprobante
              </Button>
            )}

            {onEdit && (
              <Button variant="outline" className="w-full gap-1.5" onClick={() => onEdit(instance)}>
                <Pencil className="h-4 w-4" /> Editar obligación
              </Button>
            )}

            {instance.obligation_id && (
              <Button asChild className="w-full" variant="outline">
                <Link to={`/administracion/${instance.obligation_id}`}>Ver obligación completa</Link>
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <MarkPaidDialog
        instance={instance}
        open={paying}
        onOpenChange={setPaying}
        onSaved={() => {
          setPaying(false);
          onPaid?.();
        }}
      />
    </>
  );
}
