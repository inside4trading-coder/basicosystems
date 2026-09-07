import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { QrCode, Radio } from "lucide-react";
import { locationName, unitsOfVariant } from "@/lib/sublimeMock";
import { STOCK_STATUS_LABEL } from "@/types/sublimeHub";
import { MockNotice } from "./MockNotice";

export function UnitsDialog({
  open,
  onOpenChange,
  variantId,
  productTitle,
  variantLabel,
  sku,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  variantId: string;
  productTitle: string;
  variantLabel: string;
  sku: string;
}) {
  const units = unitsOfVariant(variantId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Unidades físicas</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{productTitle}</p>
          <p className="text-xs text-muted-foreground">
            {variantLabel} · SKU <span className="font-mono">{sku}</span> · {units.length} unidades
          </p>
        </div>
        <MockNotice text="Unidades de ejemplo. El SKU identifica la variante; cada UNIT identifica una prenda física distinta." />
        <div className="space-y-2">
          {units.map((u) => (
            <div key={u.id} className="rounded-xl border border-border/60 p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold">{u.unitCode}</span>
                <Badge variant="secondary">{STOCK_STATUS_LABEL[u.status]}</Badge>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Ubicación: {locationName(u.locationId)}</span>
                <span>Recepción: {u.receivedAt ?? "—"}</span>
                <span className="inline-flex items-center gap-1">
                  <QrCode className="h-3 w-3" /> Etiqueta generada
                </span>
                <span className="inline-flex items-center gap-1">
                  <Radio className="h-3 w-3" /> RFID: {u.rfidEpc ?? "No asignado"}
                </span>
              </div>
            </div>
          ))}
          {units.length === 0 && (
            <p className="text-sm text-muted-foreground">Esta variante todavía no tiene unidades físicas.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
