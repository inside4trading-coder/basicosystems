import { useState } from "react";
import { PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MockNotice } from "@/components/sublime/hub/MockNotice";
import { ReceiveMerchandiseDialog } from "@/components/sublime/hub/ReceiveMerchandiseDialog";

const PENDING = [
  {
    id: "rec-1",
    product: "Franela de rayas blanca",
    shipment: "ENV-014",
    expected: [
      { size: "S", expected: 4 },
      { size: "M", expected: 6 },
      { size: "L", expected: 4 },
    ],
  },
  {
    id: "rec-2",
    product: "Cargo South",
    shipment: "ENV-015",
    expected: [
      { size: "32", expected: 5 },
      { size: "34", expected: 3 },
    ],
  },
];

export default function AbastecimientoRecepcion() {
  const [active, setActive] = useState<(typeof PENDING)[number] | null>(null);

  return (
    <div className="space-y-4">
      <MockNotice text="Prototipo visual de recepción: todavía no escribe unidades en inventario." />

      {PENDING.map((p) => {
        const total = p.expected.reduce((a, e) => a + e.expected, 0);
        return (
          <Card
            key={p.id}
            className="p-5 rounded-2xl border-border/60 flex items-center justify-between gap-4 flex-wrap"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <PackageCheck className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{p.product}</p>
                <p className="text-sm text-muted-foreground">
                  Envío {p.shipment} · {total} unidades esperadas
                </p>
              </div>
            </div>
            <Button onClick={() => setActive(p)}>Recibir</Button>
          </Card>
        );
      })}

      <ReceiveMerchandiseDialog
        open={active !== null}
        onOpenChange={(v) => !v && setActive(null)}
        productTitle={active?.product ?? ""}
        expected={active?.expected ?? []}
      />
    </div>
  );
}
