import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { MoveMerchandiseDialog } from "@/components/sublime/hub/MoveMerchandiseDialog";
import {
  MOVEMENT_TYPE_LABEL,
  useSublimeInventory,
  useSublimeLocations,
  useSublimeMovements,
  useSublimeUserNames,
} from "@/hooks/useSublimeInventory";
import { variantDisplay } from "@/lib/sublimeInventory";

export default function SublimeMovimientos() {
  const { data: movements = [], isLoading } = useSublimeMovements();
  const { data } = useSublimeInventory();
  const { data: locations = [] } = useSublimeLocations();
  const { data: userNames = {} } = useSublimeUserNames();

  const [type, setType] = useState("all");
  const [locationId, setLocationId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [openMove, setOpenMove] = useState(false);

  const variantInfo = useMemo(() => {
    const map = new Map<string, { product: string; variant: string; sku: string }>();
    for (const r of data?.rows ?? []) {
      map.set(r.variant.id, {
        product: r.product.name,
        variant: variantDisplay(r.variant),
        sku: r.variant.sku ?? "—",
      });
    }
    return map;
  }, [data]);

  const locName = (id: string) => locations.find((l) => l.id === id)?.name ?? "—";
  const types = Array.from(new Set(movements.map((m) => m.movement_type)));

  const rows = movements.filter((m) => {
    if (type !== "all" && m.movement_type !== type) return false;
    if (locationId !== "all" && m.location_id !== locationId) return false;
    if (from && new Date(m.created_at) < new Date(`${from}T00:00:00`)) return false;
    if (to && new Date(m.created_at) > new Date(`${to}T23:59:59`)) return false;
    if (q.trim()) {
      const info = variantInfo.get(m.variant_id);
      const text = `${info?.product ?? ""} ${info?.variant ?? ""} ${info?.sku ?? ""}`.toLowerCase();
      if (!text.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <HubHeader
        icon={ArrowLeftRight}
        title="Movimientos"
        subtitle="Registro real de todo lo que entra, sale o cambia de ubicación"
        actions={<Button onClick={() => setOpenMove(true)}>Mover mercancía</Button>}
      />

      <Card className="p-4 rounded-2xl border-border/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Input placeholder="Buscar producto o SKU…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>{MOVEMENT_TYPE_LABEL[t] ?? t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger><SelectValue placeholder="Ubicación" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las ubicaciones</SelectItem>
            {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </Card>

      <Card className="rounded-2xl border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Movimiento</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead className="text-right">Resultado</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Nota</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => {
              const info = variantInfo.get(m.variant_id);
              const delta = Number(m.qty_delta ?? 0);
              return (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{MOVEMENT_TYPE_LABEL[m.movement_type] ?? m.movement_type}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{info?.product ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{info?.variant ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{info?.sku ?? "—"}</TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-semibold ${delta < 0 ? "text-destructive" : ""}`}
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </TableCell>
                  <TableCell className="text-xs">{locName(m.location_id)}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.qty_result}</TableCell>
                  <TableCell className="text-xs">{userNames[m.performed_by ?? ""] || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.note ?? "—"}</TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  {isLoading ? "Cargando movimientos…" : "No hay movimientos que coincidan."}
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
