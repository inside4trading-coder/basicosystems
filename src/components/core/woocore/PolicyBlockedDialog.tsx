import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  BlockedLine,
  POLICY_ACTION_LABELS,
  describePolicyAction,
  summarizeBlockedLines,
} from "@/lib/policyBlocked";

const SEVERITY: Record<string, string> = {
  manual_cost_review: "bg-yellow-300 text-black",
  external_supplier_review: "bg-amber-500 text-black",
  suggest_replacement: "bg-blue-500 text-white",
  block_no_restock: "bg-red-600 text-white",
  block_exit: "bg-red-600 text-white",
  block_ignored: "bg-muted text-foreground",
};

export function PolicyBlockedDialog({
  open,
  onClose,
  lines,
  title = "Bloqueado por política de reposición",
}: {
  open: boolean;
  onClose: () => void;
  lines: BlockedLine[];
  title?: string;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summarizeBlockedLines(lines));
      toast.success("Resumen copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {lines.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin detalle disponible.</p>
          )}
          {lines.map((l, i) => (
            <div key={i} className="border rounded-md p-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={SEVERITY[l.action] ?? "bg-muted text-foreground"}>
                  {POLICY_ACTION_LABELS[l.action] ?? l.action}
                </Badge>
                {l.sku && <span className="text-sm font-medium">{l.sku}</span>}
                {l.variant_sku && (
                  <span className="text-xs text-muted-foreground">· {l.variant_sku}</span>
                )}
                {l.quantity != null && (
                  <span className="text-xs">· cant {l.quantity}</span>
                )}
                {l.unit_cost != null && (
                  <span className="text-xs">· costo {Number(l.unit_cost).toFixed(2)}</span>
                )}
              </div>
              <div className="text-sm">
                {l.message || describePolicyAction(l.action)}
              </div>
              {l.external_supplier_name && (
                <div className="text-xs text-muted-foreground">
                  Proveedor externo: {l.external_supplier_name}
                  {l.external_supplier_unit_cost_usd != null
                    ? ` · ${Number(l.external_supplier_unit_cost_usd).toFixed(2)} USD`
                    : ""}
                </div>
              )}
              {(l.replacement_product_id || l.replacement_woo_product_id) && (
                <div className="text-xs text-muted-foreground">
                  Reemplazo sugerido:{" "}
                  {l.replacement_woo_product_id
                    ? `Woo #${l.replacement_woo_product_id}`
                    : l.replacement_product_id}
                  {" · "}
                  <span className="italic">no aplicado automáticamente</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={copy}>Copiar resumen</Button>
          <Button variant="outline" asChild>
            <Link to="/core/mapa-woo-core?tab=policy" onClick={onClose}>
              Abrir Revisión de reposición
            </Link>
          </Button>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
