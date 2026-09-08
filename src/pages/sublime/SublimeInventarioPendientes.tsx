import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { InvThumb } from "@/components/sublime/inventario/InvThumb";
import {
  useSublimeInventory,
  useSublimeMappings,
  useUnimportedMerchItems,
  useUpdateSublimeProduct,
  useUpdateSublimeVariant,
  useUpdateVariantCost,
} from "@/hooks/useSublimeInventory";
import {
  completeness,
  COMPLETENESS_LABEL,
  COST_SOURCE_LABEL,
  missingFields,
  type CostSource,
  type MissingField,
} from "@/lib/sublimeInventory";

const ALL_FIELDS: MissingField[] = ["SKU", "Talla", "Color", "Categoría", "Precio", "Costo", "Imagen", "Ubicación", "Stock validado", "Mapeo Woo"];

function InlineText({ value, onSave, placeholder, className }: { value: string | null; onSave: (v: string | null) => void; placeholder?: string; className?: string }) {
  const [v, setV] = useState(value ?? "");
  return (
    <Input
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { const t = v.trim() || null; if (t !== (value ?? null)) onSave(t); }}
      className={`h-8 ${className ?? "w-28"}`}
    />
  );
}

function InlineNumber({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const [v, setV] = useState(value == null ? "" : String(value));
  return (
    <Input
      inputMode="decimal"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const n = v.trim() === "" ? null : Number(v.replace(",", "."));
        if (n !== null && !Number.isFinite(n)) return;
        if (n !== (value ?? null)) onSave(n);
      }}
      className="h-8 w-24 text-right"
    />
  );
}

/** Variantes que aún no pueden venderse porque les falta información. Todo se completa a mano. */
export default function SublimeInventarioPendientes() {
  const { data, isLoading } = useSublimeInventory();
  const { data: mappings = [] } = useSublimeMappings();
  const { data: unimported = [] } = useUnimportedMerchItems();
  const updVariant = useUpdateSublimeVariant();
  const updProduct = useUpdateSublimeProduct();
  const updCost = useUpdateVariantCost();
  const [filter, setFilter] = useState<"all" | MissingField>("all");

  const mappedVariants = useMemo(
    () => new Set(mappings.filter((m) => m.status === "mapped" && m.variant_id).map((m) => m.variant_id!)),
    [mappings]
  );

  const rows = useMemo(
    () =>
      (data?.rows ?? [])
        .map((r) => {
          const hasValidatedStock = r.proposals.some((p) => p.status === "confirmed") || r.stocks.some((s) => s.last_counted_at);
          const missing = missingFields({
            product: r.product,
            variant: r.variant,
            hasLocation: r.stocks.length > 0,
            hasValidatedStock,
            hasWooMapping: mappedVariants.has(r.variant.id),
          });
          return { ...r, missing, level: completeness({ variant: r.variant, hasValidatedStock }) };
        })
        .filter((r) => r.missing.length > 0)
        .filter((r) => filter === "all" || r.missing.includes(filter)),
    [data, mappedVariants, filter]
  );

  const save = (p: Promise<unknown>) =>
    p.then(() => toast.success("Guardado.")).catch((e: any) => toast.error(e?.message ?? "No se pudo guardar."));

  return (
    <div className="space-y-6">
      <HubHeader
        icon={AlertTriangle}
        title="Variantes pendientes de completar"
        subtitle="Nada se inventa: SKU, talla, color, categoría, precio, costo, ubicación, stock validado y mapeo Woo se completan a mano"
        actions={
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo lo pendiente</SelectItem>
              {ALL_FIELDS.map((f) => <SelectItem key={f} value={f}>Falta: {f}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      <Card className="rounded-2xl border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Talla</TableHead>
              <TableHead>Color</TableHead>
              <TableHead className="text-right">Precio REF</TableHead>
              <TableHead className="text-right">Costo REF</TableHead>
              <TableHead>Origen costo</TableHead>
              <TableHead>Completitud</TableHead>
              <TableHead>Falta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.variant.id}>
                <TableCell>
                  <div className="flex items-center gap-2 min-w-[200px]">
                    <InvThumb url={r.product.main_image_url} alt={r.product.name} />
                    <span className="font-medium">{r.product.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <InlineText key={`c${r.product.id}${r.product.category}`} value={r.product.category} placeholder="Categoría"
                    onSave={(v) => save(updProduct.mutateAsync({ id: r.product.id, patch: { category: v } }))} />
                </TableCell>
                <TableCell>
                  <InlineText key={`s${r.variant.id}${r.variant.sku}`} value={r.variant.sku} placeholder="SKU" className="w-32 font-mono text-xs"
                    onSave={(v) => save(updVariant.mutateAsync({ id: r.variant.id, patch: { sku: v } }))} />
                </TableCell>
                <TableCell>
                  <InlineText key={`t${r.variant.id}${r.variant.size}`} value={r.variant.size} placeholder="Talla" className="w-20"
                    onSave={(v) => save(updVariant.mutateAsync({ id: r.variant.id, patch: { size: v } }))} />
                </TableCell>
                <TableCell>
                  <InlineText key={`k${r.variant.id}${r.variant.color}`} value={r.variant.color} placeholder="Color" className="w-24"
                    onSave={(v) => save(updVariant.mutateAsync({ id: r.variant.id, patch: { color: v } }))} />
                </TableCell>
                <TableCell className="text-right">
                  <InlineNumber key={`p${r.variant.id}${r.variant.current_price_ref}`} value={r.variant.current_price_ref}
                    onSave={(n) => save(updVariant.mutateAsync({ id: r.variant.id, patch: { current_price_ref: n, full_price_ref: r.variant.full_price_ref ?? n } }))} />
                </TableCell>
                <TableCell className="text-right">
                  <InlineNumber key={`$${r.variant.id}${r.variant.cost_ref}`} value={r.variant.cost_ref}
                    onSave={(n) => save(updCost.mutateAsync({ id: r.variant.id, cost_ref: n, cost_source: r.variant.cost_source ?? (n != null ? "historico_manual" : null), cost_note: r.variant.cost_note }))} />
                </TableCell>
                <TableCell>
                  <Select
                    value={r.variant.cost_source ?? "none"}
                    onValueChange={(v) => save(updCost.mutateAsync({ id: r.variant.id, cost_ref: r.variant.cost_ref, cost_source: v === "none" ? null : (v as CostSource), cost_note: r.variant.cost_note }))}
                  >
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin origen</SelectItem>
                      {(Object.keys(COST_SOURCE_LABEL) as CostSource[]).map((k) => (
                        <SelectItem key={k} value={k}>{COST_SOURCE_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Badge variant={r.level === "incomplete" ? "outline" : "default"} className={r.level === "financial" ? "bg-emerald-600 text-white" : ""}>
                    {COMPLETENESS_LABEL[r.level]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[220px]">
                    {r.missing.map((m) => (
                      <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                  {isLoading ? "Cargando…" : "Nada pendiente con este filtro."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="rounded-2xl border-border/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Compras de Abastecimiento sin producto en el catálogo ({unimported.length})
        </p>
        {unimported.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todas las compras están vinculadas a un producto.</p>
        ) : (
          <ul className="text-sm space-y-1 max-h-72 overflow-y-auto">
            {unimported.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 border-b border-border/40 py-1">
                <span>{i.name}</span>
                <Badge variant="outline" className="text-[10px]">{i.estado ?? "sin estado"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
