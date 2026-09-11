import { useMemo, useState } from "react";
import { ArrowLeftRight, Boxes, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HubHeader } from "./HubHeader";
import { MoveMerchandiseDialog } from "./MoveMerchandiseDialog";
import { InvThumb } from "@/components/sublime/inventario/InvThumb";
import { useSublimeInventory, useSublimeLocations } from "@/hooks/useSublimeInventory";
import { POS_BLOCK_LABEL, posBlockers, variantDisplay } from "@/lib/sublimeInventory";
/** Precios y costos de Sublime se expresan en REF. */
const refFormat = (n: number) => `REF ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Vista de existencias oficiales de una ubicación real de Sublime. */
export function InventoryLocationView({
  locationCode,
  title,
  subtitle,
  showPosStatus = false,
}: {
  locationCode: string;
  title: string;
  subtitle: string;
  showPosStatus?: boolean;
}) {
  const { data, isLoading } = useSublimeInventory();
  const { data: locations = [] } = useSublimeLocations();
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("all");
  const [size, setSize] = useState("all");
  const [openMove, setOpenMove] = useState(false);

  const location = locations.find((l) => l.code === locationCode) ?? null;
  const posLocIds = useMemo(
    () => new Set(locations.filter((l) => l.sells_in_pos && l.is_active).map((l) => l.id)),
    [locations]
  );

  const rows = useMemo(() => {
    if (!location) return [];
    return (data?.rows ?? [])
      .map((r) => {
        const stock = r.stocks.find((s) => s.location_id === location.id) ?? null;
        const onHand = Number(stock?.quantity_on_hand ?? 0);
        const reserved = Number(stock?.quantity_reserved ?? 0);
        const available = Number(stock?.quantity_available ?? 0);
        const posStock = r.stocks
          .filter((s) => posLocIds.has(s.location_id))
          .reduce((a, s) => a + Number(s.quantity_available ?? 0), 0);
        const cost = r.variant.cost_ref == null ? null : Number(r.variant.cost_ref);
        return {
          key: r.variant.id,
          product: r.product,
          variant: r.variant,
          onHand,
          reserved,
          available,
          cost,
          value: cost == null ? null : cost * onHand,
          lastMovement: stock?.last_counted_at ?? null,
          blockers: posBlockers({ product: r.product, variant: r.variant, posStock }),
        };
      })
      .filter((r) => r.onHand > 0 || r.reserved > 0);
  }, [data, location, posLocIds]);

  const brands = Array.from(new Set(rows.map((r) => r.product.brand).filter(Boolean))) as string[];
  const sizes = Array.from(new Set(rows.map((r) => r.variant.size).filter(Boolean))) as string[];

  const filtered = rows.filter(
    (r) =>
      (brand === "all" || r.product.brand === brand) &&
      (size === "all" || r.variant.size === size) &&
      (q.trim() === "" ||
        `${r.product.name} ${r.variant.sku ?? ""} ${r.variant.color ?? ""} ${r.variant.size ?? ""}`
          .toLowerCase()
          .includes(q.toLowerCase()))
  );

  const totalUnits = filtered.reduce((a, r) => a + r.onHand, 0);
  const totalValue = filtered.reduce((a, r) => a + (r.value ?? 0), 0);

  return (
    <div className="space-y-6">
      <HubHeader
        icon={Boxes}
        title={title}
        subtitle={subtitle}
        actions={
          <Button onClick={() => setOpenMove(true)} disabled={!location}>
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            Mover mercancía
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 rounded-2xl border-border/60">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Variantes con stock</p>
          <p className="num text-2xl font-black tabular-nums">{filtered.length}</p>
        </Card>
        <Card className="p-4 rounded-2xl border-border/60">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Unidades físicas</p>
          <p className="num text-2xl font-black tabular-nums">{totalUnits}</p>
        </Card>
        <Card className="p-4 rounded-2xl border-border/60">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Valor inventario</p>
          <p className="num text-2xl font-black tabular-nums">{refFormat(totalValue)}</p>
        </Card>
      </div>

      <Card className="p-4 rounded-2xl border-border/60 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input placeholder="Buscar producto, SKU, color…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={brand} onValueChange={setBrand}>
            <SelectTrigger><SelectValue placeholder="Marca" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las marcas</SelectItem>
              {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger><SelectValue placeholder="Talla" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las tallas</SelectItem>
              {sizes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="rounded-2xl border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">En mano</TableHead>
              <TableHead className="text-right">Reservado</TableHead>
              <TableHead className="text-right">Disponible</TableHead>
              <TableHead className="text-right">Costo unit.</TableHead>
              <TableHead className="text-right">Precio full</TableHead>
              <TableHead className="text-right">Precio vigente</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Últ. movimiento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <InvThumb url={r.product.main_image_url} alt={r.product.name} />
                    <span>{r.product.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{variantDisplay(r.variant)}</TableCell>
                <TableCell className="font-mono text-xs">{r.variant.sku ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.onHand}</TableCell>
                <TableCell className="text-right tabular-nums">{r.reserved}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{r.available}</TableCell>
                <TableCell className="text-right tabular-nums">{r.cost == null ? "—" : refFormat(r.cost)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.variant.full_price_ref == null ? "—" : refFormat(Number(r.variant.full_price_ref))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.variant.current_price_ref == null ? "—" : refFormat(Number(r.variant.current_price_ref))}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.value == null ? "—" : refFormat(r.value)}</TableCell>
                <TableCell>
                  {showPosStatus ? (
                    r.blockers.length === 0 ? (
                      <Badge className="bg-emerald-600 text-white whitespace-nowrap">Lista para POS</Badge>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {r.blockers.map((b) => (
                          <Badge key={b} variant="outline" className="text-[10px] whitespace-nowrap">
                            {POS_BLOCK_LABEL[b]}
                          </Badge>
                        ))}
                      </div>
                    )
                  ) : (
                    <Badge variant="secondary">{r.available > 0 ? "Disponible" : "Sin disponible"}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {r.lastMovement
                    ? new Date(r.lastMovement).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" })
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                  {isLoading
                    ? "Cargando existencias…"
                    : !location
                      ? "No se encontró esta ubicación en el sistema."
                      : "No hay existencias oficiales en esta ubicación con estos filtros."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <MoveMerchandiseDialog open={openMove} onOpenChange={setOpenMove} defaultFromId={location?.id} />
    </div>
  );
}
