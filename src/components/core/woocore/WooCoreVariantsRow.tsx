import { useWooVariantMap } from "@/hooks/useWooCoreMap";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface Props { wooProductId: number; coreProductId: string | null; }

export function WooCoreVariantsRow({ wooProductId, coreProductId }: Props) {
  const { data = [], isLoading } = useWooVariantMap(wooProductId);
  if (isLoading) return <div className="text-xs text-muted-foreground"><Loader2 className="inline animate-spin h-3 w-3 mr-1" />Cargando variantes…</div>;
  if (data.length === 0) return <div className="text-xs text-muted-foreground">Sin variantes sincronizadas. Usa <b>Sync</b> para traerlas desde Woo.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead className="bg-muted/40">
          <tr className="text-left">
            <th className="p-1">Woo Var</th>
            <th className="p-1">SKU</th>
            <th className="p-1">Talla</th>
            <th className="p-1">Color</th>
            <th className="p-1">Precio</th>
            <th className="p-1">Stock Woo</th>
            <th className="p-1">Core variant</th>
            <th className="p-1">Mapeo</th>
          </tr>
        </thead>
        <tbody>
          {data.map((v: any) => (
            <tr key={v.id} className="border-b">
              <td className="p-1 font-mono">{v.woo_variation_id}</td>
              <td className="p-1">{v.woo_variant_sku ?? "—"}</td>
              <td className="p-1">{v.size_label ?? "—"}</td>
              <td className="p-1">{v.color_label ?? "—"}</td>
              <td className="p-1">{v.woo_price ? `€${Number(v.woo_price).toFixed(2)}` : "—"}</td>
              <td className="p-1">{v.woo_stock_quantity ?? "—"}</td>
              <td className="p-1">{v.core_variant_id ? <span className="text-primary">✓</span> : <span className="text-muted-foreground">—</span>}</td>
              <td className="p-1"><Badge variant="outline" className="text-[9px]">{v.mapping_status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!coreProductId && <p className="text-[10px] text-muted-foreground mt-2">Producto Woo sin vínculo a Core. Vincula o crea el producto Core para sincronizar variantes al catálogo Core.</p>}
    </div>
  );
}
