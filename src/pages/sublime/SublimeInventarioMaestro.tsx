import { useMemo, useState } from "react";
import { Boxes, Download, RefreshCcw, ShoppingCart, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { InvThumb } from "@/components/sublime/inventario/InvThumb";
import {
  useImportSublimeCatalog,
  useProposeInitialStock,
  useRecalcPosReadiness,
  useSublimeInventory,
  useSublimeLocations,
  useUpdateSublimeProduct,
  useUpdateSublimeVariant,
} from "@/hooks/useSublimeInventory";
import { COMPLETENESS_LABEL, completeness, POS_BLOCK_LABEL, posBlockers } from "@/lib/sublimeInventory";

export default function SublimeInventarioMaestro() {
  const { data, isLoading } = useSublimeInventory();
  const { data: locations = [] } = useSublimeLocations();
  const importCatalog = useImportSublimeCatalog();
  const proposeStock = useProposeInitialStock();
  const recalc = useRecalcPosReadiness();
  const updVariant = useUpdateSublimeVariant();
  const updProduct = useUpdateSublimeProduct();

  const [q, setQ] = useState("");
  const [locationId, setLocationId] = useState("all");
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [size, setSize] = useState("all");
  const [color, setColor] = useState("all");
  const [status, setStatus] = useState("all");

  const rows = data?.rows ?? [];
  const posLocationIds = new Set(locations.filter((l) => l.sells_in_pos && l.is_active).map((l) => l.id));

  const enriched = useMemo(
    () =>
      rows.map((r) => {
        const stockAt = (id: string) => r.stocks.find((s) => s.location_id === id) ?? null;
        const posStock = r.stocks
          .filter((s) => posLocationIds.has(s.location_id))
          .reduce((a, s) => a + Number(s.quantity_available ?? 0), 0);
        const blockers = posBlockers({ product: r.product, variant: r.variant, posStock });
        const totalOnHand = r.stocks.reduce((a, s) => a + Number(s.quantity_on_hand ?? 0), 0);
        const totalReserved = r.stocks.reduce((a, s) => a + Number(s.quantity_reserved ?? 0), 0);
        const totalAvailable = r.stocks.reduce((a, s) => a + Number(s.quantity_available ?? 0), 0);
        const hasValidatedStock = r.proposals.some((p) => p.status === "confirmed") || r.stocks.some((s) => s.last_counted_at);
        const level = completeness({ variant: r.variant, hasValidatedStock });
        return { ...r, stockAt, posStock, blockers, totalOnHand, totalReserved, totalAvailable, level };
      }),
    [rows, locations]
  );

  const categories = Array.from(new Set(rows.map((r) => r.product.category).filter(Boolean))) as string[];
  const brands = Array.from(new Set(rows.map((r) => r.product.brand).filter(Boolean)));
  const sizes = Array.from(new Set(rows.map((r) => r.variant.size).filter(Boolean))) as string[];
  const colors = Array.from(new Set(rows.map((r) => r.variant.color).filter(Boolean))) as string[];

  const filtered = enriched.filter((r) => {
    if (category !== "all" && r.product.category !== category) return false;
    if (brand !== "all" && r.product.brand !== brand) return false;
    if (size !== "all" && r.variant.size !== size) return false;
    if (color !== "all" && r.variant.color !== color) return false;
    if (status === "pos" && r.blockers.length > 0) return false;
    if (status === "pending" && r.blockers.length === 0) return false;
    if (status === "inactive" && r.variant.is_active) return false;
    if (locationId !== "all" && !r.stocks.some((s) => s.location_id === locationId && s.quantity_on_hand > 0))
      return false;
    if (q.trim()) {
      const text = `${r.product.name} ${r.variant.sku ?? ""} ${r.variant.size ?? ""} ${r.variant.color ?? ""}`.toLowerCase();
      if (!text.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const readyCount = enriched.filter((r) => r.blockers.length === 0).length;

  const runImport = async () => {
    try {
      const res = await importCatalog.mutateAsync();
      toast.success(
        `Catálogo: ${res.productsCreated} productos nuevos · ${res.productsLinked} vinculados a existentes · ${res.variantsCreated} variantes · ${res.lotsCreated + res.lotsUpdated} lotes registrados.`
      );
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo importar el catálogo.");
    }
  };

  const runPropose = async () => {
    if (!locations.length) return toast.error("No hay ubicaciones activas configuradas.");
    try {
      const res = await proposeStock.mutateAsync();
      toast.success(
        `Propuestas de conteo: ${res.proposalsCreated} nuevas, ${res.proposalsUpdated} actualizadas en ${locations.length} ubicaciones.`
      );
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudieron proponer cantidades.");
    }
  };


  const runRecalc = async () => {
    try {
      const res = await recalc.mutateAsync();
      toast.success(`Listas para POS: ${res.enabled} habilitadas, ${res.disabled} deshabilitadas.`);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo recalcular.");
    }
  };

  return (
    <div className="space-y-6">
      <HubHeader
        icon={Boxes}
        title="Inventario Maestro"
        subtitle="Productos, variantes, precios y existencias reales por ubicación"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={runImport} disabled={importCatalog.isPending}>
              <Download className="h-4 w-4 mr-2" />
              Importar catálogo
            </Button>
            <Button variant="outline" onClick={runPropose} disabled={proposeStock.isPending}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Proponer stock inicial
            </Button>
            <Button onClick={runRecalc} disabled={recalc.isPending}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Recalcular listas para POS
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Stat label="Productos" value={data?.products.length ?? 0} />
        <Stat label="Variantes" value={rows.length} />
        <Stat label="Listas para POS" value={readyCount} hint="Variantes vendibles hoy en tienda" />
        <Stat
          label="Unidades disponibles"
          value={enriched.reduce((a, r) => a + r.totalAvailable, 0)}
          hint="Total oficial de todas las ubicaciones"
        />
      </div>

      <Card className="p-4 rounded-2xl border-border/60 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <Input placeholder="Buscar producto, SKU, color…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Picker value={locationId} onChange={setLocationId} allLabel="Todas las ubicaciones"
            options={locations.map((l) => ({ value: l.id, label: l.name }))} />
          <Picker value={category} onChange={setCategory} allLabel="Todas las categorías"
            options={categories.map((c) => ({ value: c, label: c }))} />
          <Picker value={brand} onChange={setBrand} allLabel="Todas las marcas"
            options={brands.map((b) => ({ value: b, label: b }))} />
          <Picker value={size} onChange={setSize} allLabel="Todas las tallas"
            options={sizes.map((s) => ({ value: s, label: s }))} />
          <Picker value={color} onChange={setColor} allLabel="Todos los colores"
            options={colors.map((c) => ({ value: c, label: c }))} />
          <Picker value={status} onChange={setStatus} allLabel="Todos los estados"
            options={[
              { value: "pos", label: "Listas para POS" },
              { value: "pending", label: "Pendientes" },
              { value: "inactive", label: "Inactivas" },
            ]} />
        </div>
      </Card>

      <Card className="rounded-2xl border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Precio full</TableHead>
              <TableHead className="text-right">Precio vigente</TableHead>
              <TableHead className="text-right">Desc.</TableHead>
              {locations.map((l) => (
                <TableHead key={l.id} className="text-right whitespace-nowrap">{l.name}</TableHead>
              ))}
              <TableHead className="text-right">Reservado</TableHead>
              <TableHead className="text-right">Disponible</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.variant.id}>
                <TableCell>
                  <div className="flex items-center gap-2 min-w-[200px]">
                    <InvThumb url={r.product.main_image_url} alt={r.product.name} />
                    <span className="font-medium">{r.product.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  <div>{r.variant.size ?? "Talla pendiente"}</div>
                  <InlineText
                    value={r.variant.color ?? ""}
                    placeholder="Color pendiente"
                    onSave={(v) => updVariant.mutate({ id: r.variant.id, patch: { color: v || null } })}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  <InlineText
                    value={r.variant.sku ?? ""}
                    placeholder="SKU pendiente"
                    onSave={(v) => updVariant.mutate({ id: r.variant.id, patch: { sku: v || null } })}
                  />
                </TableCell>
                <TableCell className="text-xs">
                  <InlineText
                    value={r.product.category ?? ""}
                    placeholder="Categoría pendiente"
                    onSave={(v) => updProduct.mutate({ id: r.product.id, patch: { category: v || null } })}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <InlineNumber
                    value={r.variant.full_price_ref}
                    onSave={(n) => updVariant.mutate({ id: r.variant.id, patch: { full_price_ref: n } })}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <InlineNumber
                    value={r.variant.current_price_ref}
                    onSave={(n) => updVariant.mutate({ id: r.variant.id, patch: { current_price_ref: n } })}
                  />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(r.variant.discount_pct ?? 0) > 0 ? `-${Number(r.variant.discount_pct)}%` : "—"}
                </TableCell>
                {locations.map((l) => (
                  <TableCell key={l.id} className="text-right tabular-nums">
                    {r.stockAt(l.id)?.quantity_on_hand ?? 0}
                  </TableCell>
                ))}
                <TableCell className="text-right tabular-nums">{r.totalReserved}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{r.totalAvailable}</TableCell>
                <TableCell>
                  <Badge
                    variant={r.level === "incomplete" ? "outline" : "default"}
                    className={`mb-1 text-[10px] whitespace-nowrap ${r.level === "financial" ? "bg-emerald-700 text-white" : ""}`}
                    title="Operativa: SKU + precio + stock validado. Financiera: además costo con origen."
                  >
                    {COMPLETENESS_LABEL[r.level]}
                  </Badge>
                  {r.blockers.length === 0 ? (
                    <Badge className="bg-emerald-600 text-white whitespace-nowrap">Lista para POS</Badge>
                  ) : (
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {r.blockers.map((b) => (
                        <Badge key={b} variant="outline" className="text-[10px] whitespace-nowrap">
                          {POS_BLOCK_LABEL[b]}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={11 + locations.length} className="text-center text-muted-foreground py-10">
                  {isLoading
                    ? "Cargando inventario…"
                    : rows.length === 0
                      ? "Todavía no hay catálogo. Usa «Importar catálogo» para traerlo desde Abastecimiento."
                      : "No hay resultados con estos filtros."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card className="p-4 rounded-2xl border-border/60">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="num text-2xl font-black tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </Card>
  );
}

function Picker({
  value,
  onChange,
  allLabel,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={allLabel} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function InlineText({
  value,
  placeholder,
  onSave,
}: {
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <Input
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() !== value && onSave(draft.trim())}
      className="h-8 text-xs min-w-[110px]"
    />
  );
}

function InlineNumber({ value, onSave }: { value: number | null; onSave: (n: number | null) => void }) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  return (
    <Input
      value={draft}
      inputMode="decimal"
      placeholder="—"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = draft.trim() === "" ? null : Number(draft);
        if (n != null && Number.isNaN(n)) return;
        if (n !== value) onSave(n);
      }}
      className="h-8 text-xs text-right w-24 ml-auto"
    />
  );
}
