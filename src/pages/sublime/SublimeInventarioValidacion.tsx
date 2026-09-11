import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { InvThumb } from "@/components/sublime/inventario/InvThumb";
import {
  useConfirmProposal,
  useConfirmProposalsBulk,
  useDiscardProposal,
  useSublimeInventory,
  useSublimeLocations,
  useSublimeMappings,
  useSublimeWooCatalog,
} from "@/hooks/useSublimeInventory";
import { variantDisplay } from "@/lib/sublimeInventory";
import { mappingKey } from "@/lib/sublimeWooMatch";

type StatusFilter = "pending" | "confirmed" | "all";

/**
 * Validación inicial: hasta que un conteo físico se confirma aquí,
 * NADA de Abastecimiento ni de Woo se convierte en stock oficial.
 * El stock Woo es solo comparativo.
 */
export default function SublimeInventarioValidacion() {
  const { data, isLoading } = useSublimeInventory();
  const { data: locations = [] } = useSublimeLocations();
  const { data: woo = [] } = useSublimeWooCatalog();
  const { data: mappings = [] } = useSublimeMappings();
  const confirm = useConfirmProposal();
  const bulkConfirm = useConfirmProposalsBulk();
  const discard = useDiscardProposal();

  const [counts, setCounts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<StatusFilter>("pending");

  /** Stock Woo por variante del Hub, vía mapping (solo lectura/comparación). */
  const wooQtyByVariant = useMemo(() => {
    const wooByKey = new Map(woo.map((w) => [mappingKey(w.woo_product_id, w.woo_variation_id), w]));
    const out = new Map<string, number | null>();
    for (const m of mappings) {
      if (m.status !== "mapped" || !m.variant_id) continue;
      const w = wooByKey.get(mappingKey(m.external_product_id, m.external_variation_id));
      if (w) out.set(m.variant_id, w.stock_quantity);
    }
    return out;
  }, [woo, mappings]);

  const rows = useMemo(
    () => (data?.rows ?? []).filter((r) => r.proposals.length > 0),
    [data]
  );

  const isConfirmed = (r: (typeof rows)[number]) => r.proposals.some((p) => p.status === "confirmed");

  const visible = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "confirmed") return rows.filter(isConfirmed);
    return rows.filter((r) => !isConfirmed(r) && r.proposals.some((p) => p.status === "pending"));
  }, [rows, filter]);

  useEffect(() => {
    setCounts((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        for (const l of locations) {
          const key = `${r.variant.id}|${l.id}`;
          if (next[key] != null) continue;
          const prop = r.proposals.find((p) => p.location_id === l.id);
          const stock = r.stocks.find((s) => s.location_id === l.id);
          const suggested =
            prop?.counted_qty ?? (prop ? Number(prop.suggested_qty ?? 0) : Number(stock?.quantity_on_hand ?? 0));
          next[key] = String(suggested ?? 0);
        }
      }
      return next;
    });
  }, [rows, locations]);

  const countsFor = (variantId: string) =>
    locations.map((l) => ({ locationId: l.id, qty: Number(counts[`${variantId}|${l.id}`] ?? 0) || 0 }));

  const invalidCounts = (variantId: string) =>
    locations.some((l) => {
      const raw = String(counts[`${variantId}|${l.id}`] ?? "").trim();
      if (raw === "") return true;
      const n = Number(raw);
      return !Number.isInteger(n) || n < 0;
    });

  const doConfirm = async (variantId: string) => {
    if (invalidCounts(variantId)) {
      toast.error("Introduce cantidades enteras iguales o mayores que cero en todas las ubicaciones.");
      return;
    }
    try {
      await confirm.mutateAsync({ variantId, counts: countsFor(variantId) });
      toast.success("Conteo confirmado: este stock ya es oficial.");
      setSelected((p) => ({ ...p, [variantId]: false }));
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo confirmar el conteo.");
    }
  };

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  const doBulkConfirm = async () => {
    const pendingIds = selectedIds.filter((id) => {
      const row = rows.find((r) => r.variant.id === id);
      return row && !isConfirmed(row);
    });
    if (!pendingIds.length) {
      toast.error("Selecciona al menos una variante pendiente.");
      return;
    }
    const bad = pendingIds.filter(invalidCounts);
    const good = pendingIds.filter((id) => !invalidCounts(id));
    if (bad.length) {
      const names = bad
        .map((id) => rows.find((r) => r.variant.id === id)?.product.name ?? id)
        .join(", ");
      toast.error(`Corrige las cantidades de: ${names}`);
    }
    if (!good.length) return;
    try {
      const res = await bulkConfirm.mutateAsync(
        good.map((id) => ({ variantId: id, counts: countsFor(id) }))
      );
      if (res.ok.length) toast.success(`${res.ok.length} variantes confirmadas.`);
      for (const f of res.failed) {
        const name = rows.find((r) => r.variant.id === f.variantId)?.product.name ?? f.variantId;
        toast.error(`${name}: ${f.message}`);
      }
      setSelected({});
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo confirmar la selección.");
    }
  };

  return (
    <div className="space-y-6">
      <HubHeader
        icon={ClipboardCheck}
        title="Validación inicial de inventario"
        subtitle="Compara lo sugerido por Abastecimiento con el conteo físico antes de dar stock por oficial"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="confirmed">Confirmadas</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={doBulkConfirm}
              disabled={bulkConfirm.isPending || selectedIds.length === 0}
            >
              {bulkConfirm.isPending ? "Confirmando…" : `Confirmar seleccionadas (${selectedIds.length})`}
            </Button>
          </div>
        }
      />

      <Card className="rounded-2xl border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Sugerido</TableHead>
              <TableHead className="text-right whitespace-nowrap" title="Solo comparativo. Nunca se copia como stock oficial.">Woo</TableHead>
              {locations.map((l) => (
                <TableHead key={l.id} className="text-right whitespace-nowrap">Físico {l.name}</TableHead>
              ))}
              <TableHead className="text-right">Total físico</TableHead>
              <TableHead className="text-right">Diferencia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => {
              const suggestedRaw = r.proposals.reduce((a, p) => a + Number(p.suggested_qty ?? 0), 0);
              const hasReference = r.proposals.some((p) => p.source_merch_item_id != null);
              const confirmedRow = isConfirmed(r);
              const physical = confirmedRow
                ? r.proposals.reduce((a, p) => a + Number(p.counted_qty ?? 0), 0)
                : locations.reduce((a, l) => a + (Number(counts[`${r.variant.id}|${l.id}`] ?? 0) || 0), 0);
              const diff = physical - suggestedRaw;
              const pending = r.proposals.find((p) => p.status === "pending");
              const confirmedAt = r.proposals.find((p) => p.confirmed_at)?.confirmed_at ?? null;
              return (
                <TableRow key={r.variant.id}>
                  <TableCell>
                    {!confirmedRow && (
                      <Checkbox
                        checked={!!selected[r.variant.id]}
                        onCheckedChange={(v) =>
                          setSelected((p) => ({ ...p, [r.variant.id]: v === true }))
                        }
                        aria-label="Seleccionar variante"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[200px]">
                      <InvThumb url={r.product.main_image_url} alt={r.product.name} />
                      <span className="font-medium">{r.product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {variantDisplay(r.variant)}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {r.variant.sku || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {hasReference || suggestedRaw > 0 ? (
                      suggestedRaw
                    ) : (
                      <span className="text-muted-foreground text-xs">Sin referencia</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {wooQtyByVariant.has(r.variant.id) ? (wooQtyByVariant.get(r.variant.id) ?? "—") : "—"}
                  </TableCell>
                  {locations.map((l) => {
                    const prop = r.proposals.find((p) => p.location_id === l.id);
                    return (
                      <TableCell key={l.id} className="text-right">
                        {confirmedRow ? (
                          <span className="tabular-nums">{Number(prop?.counted_qty ?? 0)}</span>
                        ) : (
                          <Input
                            inputMode="numeric"
                            min={0}
                            step={1}
                            value={counts[`${r.variant.id}|${l.id}`] ?? ""}
                            onChange={(e) =>
                              setCounts((p) => ({
                                ...p,
                                [`${r.variant.id}|${l.id}`]: e.target.value.replace(/[^\d]/g, ""),
                              }))
                            }
                            className="h-8 w-20 text-right ml-auto"
                          />
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right tabular-nums font-medium">{physical}</TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-semibold ${
                      diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-emerald-600" : "text-destructive"
                    }`}
                  >
                    {diff > 0 ? `+${diff}` : diff}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {confirmedRow ? (
                      <div className="space-y-1">
                        <Badge className="bg-emerald-600 text-white">Confirmado</Badge>
                        {confirmedAt && (
                          <div className="text-[11px] text-muted-foreground">
                            {new Date(confirmedAt).toLocaleString("es-VE")}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline">Pendiente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {confirmedRow ? (
                      <span className="text-xs text-muted-foreground">Histórico</span>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          onClick={() => doConfirm(r.variant.id)}
                          disabled={confirm.isPending || bulkConfirm.isPending}
                        >
                          Confirmar
                        </Button>
                        {pending && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-1"
                            onClick={() =>
                              discard.mutate(
                                { id: pending.id, note: "Descartada en validación inicial" },
                                { onSuccess: () => toast.success("Propuesta descartada.") }
                              )
                            }
                          >
                            Descartar
                          </Button>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={10 + locations.length} className="text-center text-muted-foreground py-10">
                  {isLoading
                    ? "Cargando propuestas…"
                    : "No hay conteos por validar. Genera propuestas desde Inventario Maestro."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
