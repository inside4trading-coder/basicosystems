import { useMemo, useState } from "react";
import { ArrowLeftRight, Boxes, History, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { HubHeader } from "./HubHeader";
import { MockNotice } from "./MockNotice";
import { UnitsDialog } from "./UnitsDialog";
import { MoveMerchandiseDialog } from "./MoveMerchandiseDialog";
import { LifecycleDialog } from "./LifecycleTimeline";
import { STOCK_STATUS_LABEL } from "@/types/sublimeHub";
import { mockProducts, mockUnits, mockVariants, usdFormat } from "@/lib/sublimeMock";

type Row = {
  variantId: string;
  productId: string;
  product: string;
  brand: string | null;
  category: string | null;
  size: string;
  color: string;
  sku: string;
  units: number;
  unitCost: number;
  pvp: number;
  receivedAt: string | null;
};

export function InventoryLocationView({
  locationId,
  title,
  subtitle,
}: {
  locationId: string;
  title: string;
  subtitle: string;
}) {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("all");
  const [size, setSize] = useState("all");
  const [openMove, setOpenMove] = useState(false);
  const [unitsFor, setUnitsFor] = useState<Row | null>(null);
  const [historyFor, setHistoryFor] = useState<Row | null>(null);

  const rows = useMemo<Row[]>(() => {
    return mockVariants
      .map((v) => {
        const p = mockProducts.find((x) => x.id === v.productId)!;
        const units = mockUnits.filter((u) => u.variantId === v.id && u.locationId === locationId);
        return {
          variantId: v.id,
          productId: p.id,
          product: p.title,
          brand: p.brand,
          category: p.category,
          size: v.size,
          color: v.color,
          sku: v.sku,
          units: units.length,
          unitCost: v.unitCost,
          pvp: v.pvp,
          receivedAt: units[0]?.receivedAt ?? null,
        };
      })
      .filter((r) => r.units > 0);
  }, [locationId]);

  const brands = Array.from(new Set(rows.map((r) => r.brand).filter(Boolean))) as string[];
  const sizes = Array.from(new Set(rows.map((r) => r.size)));

  const filtered = rows.filter(
    (r) =>
      (brand === "all" || r.brand === brand) &&
      (size === "all" || r.size === size) &&
      (q.trim() === "" ||
        `${r.product} ${r.sku} ${r.color} ${r.size}`.toLowerCase().includes(q.toLowerCase()))
  );

  const totalUnits = filtered.reduce((a, r) => a + r.units, 0);
  const totalValue = filtered.reduce((a, r) => a + r.units * r.unitCost, 0);

  return (
    <div className="space-y-6">
      <HubHeader
        icon={Boxes}
        title={title}
        subtitle={subtitle}
        actions={
          <Button onClick={() => setOpenMove(true)}>
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            Mover mercancía
          </Button>
        }
      />
      <MockNotice />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 rounded-2xl border-border/60">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Variantes</p>
          <p className="num text-2xl font-black tabular-nums">{filtered.length}</p>
        </Card>
        <Card className="p-4 rounded-2xl border-border/60">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Unidades físicas</p>
          <p className="num text-2xl font-black tabular-nums">{totalUnits}</p>
        </Card>
        <Card className="p-4 rounded-2xl border-border/60">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Valor inventario</p>
          <p className="num text-2xl font-black tabular-nums">{usdFormat(totalValue)}</p>
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
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead className="text-right">Costo unit.</TableHead>
              <TableHead className="text-right">PVP</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Recepción</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.variantId}>
                <TableCell className="font-medium">{r.product}</TableCell>
                <TableCell className="text-muted-foreground">{r.size} · {r.color}</TableCell>
                <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                <TableCell className="text-right tabular-nums">{r.units}</TableCell>
                <TableCell className="text-right tabular-nums">{usdFormat(r.unitCost)}</TableCell>
                <TableCell className="text-right tabular-nums">{usdFormat(r.pvp)}</TableCell>
                <TableCell className="text-right tabular-nums">{usdFormat(r.units * r.unitCost)}</TableCell>
                <TableCell><Badge variant="secondary">{STOCK_STATUS_LABEL.available}</Badge></TableCell>
                <TableCell className="text-muted-foreground text-xs">{r.receivedAt ?? "—"}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setUnitsFor(r)}>Ver unidades</Button>
                  <Button size="sm" variant="ghost" onClick={() => setOpenMove(true)}>Mover</Button>
                  <Button size="sm" variant="ghost" onClick={() => toast.info("Ajuste de inventario disponible en la fase funcional.")}>Ajustar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setHistoryFor(r)}>
                    <History className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  No hay inventario que coincida con los filtros.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <MoveMerchandiseDialog open={openMove} onOpenChange={setOpenMove} defaultFrom={locationId} defaultTo={locationId === "loc-wh" ? "loc-bq" : "loc-wh"} />
      {unitsFor && (
        <UnitsDialog
          open
          onOpenChange={(v) => !v && setUnitsFor(null)}
          variantId={unitsFor.variantId}
          productTitle={unitsFor.product}
          variantLabel={`${unitsFor.size} · ${unitsFor.color}`}
          sku={unitsFor.sku}
        />
      )}
      {historyFor && (
        <LifecycleDialog
          open
          onOpenChange={(v) => !v && setHistoryFor(null)}
          productTitle={historyFor.product}
          productId={historyFor.productId}
        />
      )}
    </div>
  );
}
