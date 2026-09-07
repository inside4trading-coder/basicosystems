import { Boxes } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { MockNotice } from "@/components/sublime/hub/MockNotice";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { locationName, mockUnits, mockVariants, productOf, variantLabel } from "@/lib/sublimeMock";
import { STOCK_STATUS_LABEL } from "@/types/sublimeHub";

export default function SublimeInventarioUnidades() {
  return (
    <div className="space-y-6">
      <HubHeader
        icon={Boxes}
        title="Unidades"
        subtitle="Cada prenda física, su estado y su ubicación"
      />
      <MockNotice />

      <Card className="rounded-2xl border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidad</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>RFID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockUnits.map((u) => {
              const v = mockVariants.find((x) => x.id === u.variantId);
              const p = productOf(u.variantId);
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs">{u.unitCode}</TableCell>
                  <TableCell className="font-medium">{p?.title ?? "—"}</TableCell>
                  <TableCell>{v ? variantLabel(v) : "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{v?.sku ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{STOCK_STATUS_LABEL[u.status]}</Badge>
                  </TableCell>
                  <TableCell>{locationName(u.locationId)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {u.rfidEpc ?? "Sin etiqueta"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
