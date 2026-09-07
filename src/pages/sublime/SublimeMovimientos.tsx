import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { MockNotice } from "@/components/sublime/hub/MockNotice";
import { MoveMerchandiseDialog } from "@/components/sublime/hub/MoveMerchandiseDialog";
import { MOVEMENT_LABEL, type MovementType } from "@/types/sublimeHub";
import { locationName, mockMovements } from "@/lib/sublimeMock";

export default function SublimeMovimientos() {
  const [type, setType] = useState<string>("all");
  const [q, setQ] = useState("");
  const [openMove, setOpenMove] = useState(false);

  const rows = mockMovements.filter(
    (m) =>
      (type === "all" || m.type === type) &&
      (q.trim() === "" || `${m.productTitle} ${m.sku} ${m.unitCode ?? ""} ${m.user}`.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <HubHeader
        icon={ArrowLeftRight}
        title="Movimientos"
        subtitle="Registro de todo lo que entra, sale o cambia de ubicación"
        actions={<Button onClick={() => setOpenMove(true)}>Mover mercancía</Button>}
      />
      <MockNotice />

      <Card className="p-4 rounded-2xl border-border/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input placeholder="Buscar producto, SKU, unidad o usuario…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {(Object.keys(MOVEMENT_LABEL) as MovementType[]).map((t) => (
              <SelectItem key={t} value={t}>{MOVEMENT_LABEL[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <Card className="rounded-2xl border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Movimiento</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Unit ID</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(m.at).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" })}
                </TableCell>
                <TableCell><Badge variant="secondary">{MOVEMENT_LABEL[m.type]}</Badge></TableCell>
                <TableCell className="font-medium">{m.productTitle}</TableCell>
                <TableCell className="font-mono text-xs">{m.sku}</TableCell>
                <TableCell className="font-mono text-xs">{m.unitCode ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{m.fromLocationId ? locationName(m.fromLocationId) : "—"}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{m.toLocationId ? locationName(m.toLocationId) : "—"}</TableCell>
                <TableCell className="text-xs">{m.user}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{m.reason ?? "—"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No hay movimientos que coincidan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <MoveMerchandiseDialog open={openMove} onOpenChange={setOpenMove} />
    </div>
  );
}
