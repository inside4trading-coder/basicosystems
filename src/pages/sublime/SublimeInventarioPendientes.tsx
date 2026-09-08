import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { InvThumb } from "@/components/sublime/inventario/InvThumb";
import { useSublimeInventory, useUnimportedMerchItems } from "@/hooks/useSublimeInventory";
import { missingFields, variantDisplay } from "@/lib/sublimeInventory";

/** Variantes que aún no pueden venderse porque les falta información. */
export default function SublimeInventarioPendientes() {
  const { data, isLoading } = useSublimeInventory();
  const { data: unimported = [] } = useUnimportedMerchItems();

  const rows = useMemo(
    () =>
      (data?.rows ?? [])
        .map((r) => ({ ...r, missing: missingFields({ product: r.product, variant: r.variant }) }))
        .filter((r) => r.missing.length > 0),
    [data]
  );

  return (
    <div className="space-y-6">
      <HubHeader
        icon={AlertTriangle}
        title="Variantes pendientes de completar"
        subtitle="Nada se inventa: SKU, color, categoría, precio e imagen se completan a mano"
      />

      <Card className="rounded-2xl border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead>Falta por completar</TableHead>
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
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {variantDisplay(r.variant)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {r.missing.map((m) => (
                      <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                  {isLoading ? "Cargando…" : "Todas las variantes tienen su información completa."}
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
