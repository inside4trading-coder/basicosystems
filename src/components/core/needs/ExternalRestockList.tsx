import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, ExternalLink, ShoppingCart } from "lucide-react";
import { formatCurrencySafe } from "@/lib/formatCurrency";

const BASELINE_DATE = "2026-07-27";

type Mov = {
  id: string;
  created_at: string;
  amount: number;
  quantity: number | null;
  unit_cost_snapshot: number | null;
  sku: string | null;
  product_name: string | null;
  core_product_id: string | null;
  core_variant_id: string | null;
  woo_product_id: number | null;
  woo_variation_id: number | null;
  source_order_id: number | null;
  source_order_item_id: number | null;
};

type Row = Mov & {
  productName: string;
  sku: string;
  variantLabel: string;
  status: "pending_purchase" | "in_order" | "closed";
};

const STATUS_META: Record<Row["status"], { label: string; cls: string }> = {
  pending_purchase: { label: "Pendiente de compra", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  in_order: { label: "En orden de compra", cls: "bg-blue-100 text-blue-800 border-blue-300" },
  closed: { label: "Recibido / cerrado", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
};

const usd = (n: number) => formatCurrencySafe(n, "USD", { minimumFractionDigits: 2 });
const normSku = (s?: string | null) => (s ?? "").toString().trim().toUpperCase();

export default function ExternalRestockList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [from, setFrom] = useState(BASELINE_DATE);

  async function load() {
    setLoading(true);
    try {
      const { data: movsRaw } = await supabase
        .from("core_fabrication_fund_movements")
        .select("id, created_at, amount, quantity, unit_cost_snapshot, sku, product_name, core_product_id, core_variant_id, woo_product_id, woo_variation_id, source_order_id, source_order_item_id")
        .eq("fund_bucket", "external_supplier")
        .eq("movement_type", "sale_generated")
        .eq("status", "posted")
        .gte("created_at", `${from}T00:00:00Z`)
        .order("created_at", { ascending: false })
        .limit(1000);

      const movs = (movsRaw ?? []) as Mov[];
      if (movs.length === 0) { setRows([]); return; }

      const productIds = Array.from(new Set(movs.map(m => m.core_product_id).filter(Boolean))) as string[];
      const variantIds = Array.from(new Set(movs.map(m => m.core_variant_id).filter(Boolean))) as string[];

      const [{ data: prods }, { data: vars }, { data: poLines }] = await Promise.all([
        productIds.length
          ? supabase.from("core_products").select("id, name, core_sku").in("id", productIds)
          : Promise.resolve({ data: [] as any[] } as any),
        variantIds.length
          ? supabase.from("core_product_variants").select("id, size, color, variant_label, variant_sku, woo_sku").in("id", variantIds)
          : Promise.resolve({ data: [] as any[] } as any),
        supabase
          .from("core_external_purchase_order_lines")
          .select("id, order_id, core_product_id, core_variant_id, sku_snapshot, status")
          .limit(2000),
      ]);

      const prodById = new Map((prods ?? []).map((p: any) => [p.id, p]));
      const varById = new Map((vars ?? []).map((v: any) => [v.id, v]));

      const orderIds = Array.from(new Set((poLines ?? []).map((l: any) => l.order_id).filter(Boolean)));
      let orderStatusById = new Map<string, string>();
      if (orderIds.length) {
        const { data: orders } = await supabase
          .from("core_external_purchase_orders")
          .select("id, status")
          .in("id", orderIds as string[]);
        orderStatusById = new Map((orders ?? []).map((o: any) => [o.id, o.status]));
      }

      // Índice de líneas de compra por clave producto/variante/sku
      const lineKeys = new Map<string, string>(); // key -> derived status
      const rank = (s: Row["status"]) => (s === "closed" ? 2 : s === "in_order" ? 1 : 0);
      for (const l of (poLines ?? []) as any[]) {
        const orderStatus = orderStatusById.get(l.order_id) ?? "draft";
        let st: Row["status"];
        if (["received", "closed"].includes(orderStatus) || ["received", "cancelled"].includes(l.status)) st = "closed";
        else if (["cancelled"].includes(orderStatus)) st = "pending_purchase";
        else st = "in_order";
        const keys = [
          l.core_variant_id ? `v:${l.core_variant_id}` : null,
          l.core_product_id ? `p:${l.core_product_id}` : null,
          l.sku_snapshot ? `s:${normSku(l.sku_snapshot)}` : null,
        ].filter(Boolean) as string[];
        for (const k of keys) {
          const prev = lineKeys.get(k) as Row["status"] | undefined;
          if (!prev || rank(st) > rank(prev)) lineKeys.set(k, st);
        }
      }

      const out: Row[] = movs.map(m => {
        const p: any = m.core_product_id ? prodById.get(m.core_product_id) : null;
        const v: any = m.core_variant_id ? varById.get(m.core_variant_id) : null;
        const variantLabel = v
          ? [v.size, v.color].filter(Boolean).join(" · ") || v.variant_label || "—"
          : "—";
        const sku = normSku(v?.variant_sku ?? v?.woo_sku ?? m.sku ?? p?.core_sku ?? "") || "—";
        const st =
          (m.core_variant_id ? lineKeys.get(`v:${m.core_variant_id}`) : undefined) ??
          (m.core_product_id ? lineKeys.get(`p:${m.core_product_id}`) : undefined) ??
          (sku !== "—" ? lineKeys.get(`s:${sku}`) : undefined) ??
          "pending_purchase";
        return {
          ...m,
          productName: p?.name ?? m.product_name ?? "—",
          sku,
          variantLabel,
          status: st as Row["status"],
        };
      });
      setRows(out);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [from]);

  const grouped = useMemo(() => {
    const map = new Map<string, {
      key: string; productName: string; sku: string; variantLabel: string;
      qty: number; total: number; orders: Set<number>; pending: number; items: Row[];
    }>();
    for (const r of rows) {
      const key = `${r.core_product_id ?? "np"}|${r.core_variant_id ?? "nv"}|${r.sku}`;
      const g = map.get(key) ?? {
        key, productName: r.productName, sku: r.sku, variantLabel: r.variantLabel,
        qty: 0, total: 0, orders: new Set<number>(), pending: 0, items: [] as Row[],
      };
      g.qty += Number(r.quantity ?? 1) || 1;
      g.total += Number(r.amount ?? 0);
      if (r.source_order_id) g.orders.add(r.source_order_id);
      if (r.status === "pending_purchase") g.pending += Number(r.quantity ?? 1) || 1;
      g.items.push(r);
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const totals = useMemo(() => ({
    qty: rows.reduce((s, r) => s + (Number(r.quantity ?? 1) || 1), 0),
    amount: rows.reduce((s, r) => s + Number(r.amount ?? 0), 0),
    movements: rows.length,
  }), [rows]);

  const goMovements = () => navigate("/core/partidas-fabricacion?mov=external");
  const goPurchase = () => navigate("/core/mapa-woo-core?tab=external");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[160px]" />
          </div>
          <Button size="sm" variant="outline" onClick={() => load()} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />Actualizar
          </Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={goMovements}>
            <ExternalLink className="h-4 w-4 mr-2" />Ver partida externa
          </Button>
          <Button size="sm" onClick={goPurchase}>
            <ShoppingCart className="h-4 w-4 mr-2" />Preparar compra
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Card className="p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Prendas a reponer</p>
          <p className="num text-2xl font-black">{totals.qty}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Costo reservado</p>
          <p className="num text-2xl font-black font-mono">{usd(totals.amount)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Movimientos externos</p>
          <p className="num text-2xl font-black">{totals.movements}</p>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground italic">
        Estas prendas se compran a proveedor externo: no generan órdenes de producción, ni unidades/QR, ni consumen inventario interno.
      </p>

      <Tabs defaultValue="grouped">
        <TabsList>
          <TabsTrigger value="grouped">Agrupado ({grouped.length})</TabsTrigger>
          <TabsTrigger value="detail">Detalle ({rows.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="grouped" className="mt-3">
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Variante / talla</TableHead>
                  <TableHead className="text-right">Cantidad a reponer</TableHead>
                  <TableHead className="text-right">Pendiente de compra</TableHead>
                  <TableHead className="text-right">Costo reservado</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Cargando…</TableCell></TableRow>
                ) : grouped.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Sin prendas pendientes de proveedor externo.</TableCell></TableRow>
                ) : grouped.map(g => (
                  <TableRow key={g.key}>
                    <TableCell className="text-sm">{g.productName}</TableCell>
                    <TableCell className="font-mono text-xs">{g.sku}</TableCell>
                    <TableCell className="text-xs">{g.variantLabel}</TableCell>
                    <TableCell className="text-right font-semibold">{g.qty}</TableCell>
                    <TableCell className="text-right">{g.pending}</TableCell>
                    <TableCell className="text-right font-mono">{usd(g.total)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{g.orders.size}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="detail" className="mt-3">
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha venta</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Variante / talla</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Costo reservado</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Cargando…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Sin movimientos externos.</TableCell></TableRow>
                ) : rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm">{r.productName}</TableCell>
                    <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                    <TableCell className="text-xs">{r.variantLabel}</TableCell>
                    <TableCell className="text-right">{r.quantity ?? 1}</TableCell>
                    <TableCell className="text-right font-mono">{usd(Number(r.amount ?? 0))}</TableCell>
                    <TableCell className="font-mono text-xs">{r.source_order_id ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.source_order_item_id ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_META[r.status].cls}>{STATUS_META[r.status].label}</Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={goMovements}>Ver movimiento</Button>
                      {r.status === "pending_purchase" && (
                        <Button size="sm" variant="ghost" onClick={goPurchase}>Preparar compra</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
