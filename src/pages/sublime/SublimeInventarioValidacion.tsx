import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { InvThumb } from "@/components/sublime/inventario/InvThumb";
import {
  useConfirmProposal,
  useDiscardProposal,
  useSublimeInventory,
  useSublimeLocations,
  useSublimeMappings,
  useSublimeWooCatalog,
} from "@/hooks/useSublimeInventory";
import { variantDisplay } from "@/lib/sublimeInventory";
import { mappingKey } from "@/lib/sublimeWooMatch";

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
  const discard = useDiscardProposal();

  const [counts, setCounts] = useState<Record<string, string>>({});
  const [onlyPending, setOnlyPending] = useState(true);

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
  const visible = onlyPending ? rows.filter((r) => r.proposals.some((p) => p.status === "pending")) : rows;

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

  const doConfirm = async (variantId: string) => {
    try {
      await confirm.mutateAsync({
        variantId,
        counts: locations.map((l) => ({
          locationId: l.id,
          qty: Number(counts[`${variantId}|${l.id}`] ?? 0) || 0,
        })),
      });
      toast.success("Conteo confirmado: este stock ya es oficial.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo confirmar el conteo.");
    }
  };

  return (
    <div className="space-y-6">
      <HubHeader
        icon={ClipboardCheck}
        title="Validación inicial de inventario"
        subtitle="Compara lo sugerido por Abastecimiento con el conteo físico antes de dar stock por oficial"
        actions={
          <Button variant="outline" onClick={() => setOnlyPending((v) => !v)}>
            {onlyPending ? "Ver también confirmadas" : "Ver solo pendientes"}
          </Button>
        }
      />

      <Card className="rounded-2xl border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead className="text-right">Sugerido</TableHead>
              <TableHead className="text-right whitespace-nowrap" title="Solo comparativo. Nunca se copia como stock oficial.">Woo</TableHead>
              {locations.map((l) => (
                <TableHead key={l.id} className="text-right whitespace-nowrap">Físico {l.name}</TableHead>
              ))}
              <TableHead className="text-right">Diferencia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => {
              const suggested = r.proposals.reduce((a, p) => a + Number(p.suggested_qty ?? 0), 0);
              const physical = locations.reduce(
                (a, l) => a + (Number(counts[`${r.variant.id}|${l.id}`] ?? 0) || 0),
                0
              );
              const diff = physical - suggested;
              const pending = r.proposals.find((p) => p.status === "pending");
              return (
                <TableRow key={r.variant.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[200px]">
                      <InvThumb url={r.product.main_image_url} alt={r.product.name} />
                      <span className="font-medium">{r.product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {variantDisplay(r.variant)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{suggested}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {wooQtyByVariant.has(r.variant.id) ? (wooQtyByVariant.get(r.variant.id) ?? "—") : "sin mapeo"}
                  </TableCell>
                  {locations.map((l) => (
                    <TableCell key={l.id} className="text-right">
                      <Input
                        inputMode="numeric"
                        value={counts[`${r.variant.id}|${l.id}`] ?? ""}
                        onChange={(e) =>
                          setCounts((p) => ({ ...p, [`${r.variant.id}|${l.id}`]: e.target.value }))
                        }
                        className="h-8 w-20 text-right ml-auto"
                      />
                    </TableCell>
                  ))}
                  <TableCell
                    className={`text-right tabular-nums font-semibold ${
                      diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-emerald-600" : "text-destructive"
                    }`}
                  >
                    {diff > 0 ? `+${diff}` : diff}
                  </TableCell>
                  <TableCell>
                    {pending ? (
                      <Badge variant="outline">Pendiente</Badge>
                    ) : (
                      <Badge className="bg-emerald-600 text-white">Confirmado</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" onClick={() => doConfirm(r.variant.id)} disabled={confirm.isPending}>
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
                  </TableCell>
                </TableRow>
              );
            })}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7 + locations.length} className="text-center text-muted-foreground py-10">
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
