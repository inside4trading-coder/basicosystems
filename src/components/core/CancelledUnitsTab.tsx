// Historial de prendas/unidades canceladas dentro de OP.
// Solo lectura: no toca Woo, inventario ni nómina.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Eye, Loader2, Search } from "lucide-react";

type Row = {
  id: string;
  unit_code: string;
  production_order_id: string;
  order_code: string | null;
  order_status: string | null;
  product_name: string | null;
  sku: string | null;
  variant_sku: string | null;
  size: string | null;
  variant_label: string | null;
  color: string | null;
  reason: string | null;
  notes: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  user_name: string | null;
  cost_moved: number;
};

export function CancelledUnitsTab({ onOpenOrder }: { onOpenOrder?: (orderId: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [reason, setReason] = useState("all");
  const [user, setUser] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: units } = await supabase
      .from("core_production_units")
      .select(
        "id, unit_code, production_order_id, core_product_id, core_variant_id, sku, variant_sku, variant_label, size, status, cancelled_reason, cancelled_at, cancelled_by, notes",
      )
      .in("status", ["cancelled", "discarded"])
      .order("cancelled_at", { ascending: false });

    const us = ((units as any[]) ?? []);
    if (!us.length) { setRows([]); setLoading(false); return; }

    const orderIds = Array.from(new Set(us.map((u) => u.production_order_id).filter(Boolean)));
    const productIds = Array.from(new Set(us.map((u) => u.core_product_id).filter(Boolean)));
    const variantIds = Array.from(new Set(us.map((u) => u.core_variant_id).filter(Boolean)));
    const userIds = Array.from(new Set(us.map((u) => u.cancelled_by).filter(Boolean)));

    const [{ data: orders }, { data: prods }, { data: variants }, { data: movs }, { data: profiles }] =
      await Promise.all([
        orderIds.length
          ? supabase.from("core_production_orders").select("id, order_code, status, product_name").in("id", orderIds)
          : Promise.resolve({ data: [] as any[] } as any),
        productIds.length
          ? supabase.from("core_products").select("id, name, core_sku").in("id", productIds)
          : Promise.resolve({ data: [] as any[] } as any),
        variantIds.length
          ? supabase.from("core_product_variants").select("id, size, color, variant_label").in("id", variantIds)
          : Promise.resolve({ data: [] as any[] } as any),
        orderIds.length
          ? supabase
              .from("core_fabrication_fund_movements")
              .select("amount, metadata")
              .eq("movement_type", "production_cancelled_to_no_restock")
              .in("production_order_id", orderIds)
          : Promise.resolve({ data: [] as any[] } as any),
        userIds.length
          ? supabase.from("profiles").select("id, email, full_name").in("id", userIds)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);

    const orderMap: Record<string, any> = {};
    for (const o of ((orders as any[]) ?? [])) orderMap[o.id] = o;
    const prodMap: Record<string, any> = {};
    for (const p of ((prods as any[]) ?? [])) prodMap[p.id] = p;
    const varMap: Record<string, any> = {};
    for (const v of ((variants as any[]) ?? [])) varMap[v.id] = v;
    const costMap: Record<string, number> = {};
    for (const m of ((movs as any[]) ?? [])) {
      const uid = (m.metadata as any)?.unit_id;
      if (uid) costMap[uid] = (costMap[uid] ?? 0) + Number(m.amount || 0);
    }
    const userMap: Record<string, string> = {};
    for (const p of ((profiles as any[]) ?? [])) userMap[p.id] = p.full_name || p.email || p.id;

    setRows(
      us.map((u) => {
        const o = orderMap[u.production_order_id];
        const p = u.core_product_id ? prodMap[u.core_product_id] : null;
        const v = u.core_variant_id ? varMap[u.core_variant_id] : null;
        return {
          id: u.id,
          unit_code: u.unit_code,
          production_order_id: u.production_order_id,
          order_code: o?.order_code ?? null,
          order_status: o?.status ?? null,
          product_name: p?.name ?? o?.product_name ?? null,
          sku: p?.core_sku ?? u.sku ?? null,
          variant_sku: u.variant_sku ?? null,
          size: u.size ?? v?.size ?? null,
          variant_label: u.variant_label ?? v?.variant_label ?? null,
          color: v?.color ?? null,
          reason: u.cancelled_reason ?? null,
          notes: u.notes ?? null,
          cancelled_at: u.cancelled_at ?? null,
          cancelled_by: u.cancelled_by ?? null,
          user_name: u.cancelled_by ? userMap[u.cancelled_by] ?? null : null,
          cost_moved: costMap[u.id] ?? 0,
        } as Row;
      }),
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const reasons = useMemo(
    () => Array.from(new Set(rows.map((r) => r.reason).filter(Boolean) as string[])),
    [rows],
  );
  const users = useMemo(
    () => Array.from(new Set(rows.map((r) => r.user_name).filter(Boolean) as string[])),
    [rows],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (term) {
        const hay = [r.order_code, r.unit_code, r.product_name, r.sku, r.variant_sku, r.size, r.color]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (reason !== "all" && r.reason !== reason) return false;
      if (user !== "all" && r.user_name !== user) return false;
      if (from && (!r.cancelled_at || r.cancelled_at.slice(0, 10) < from)) return false;
      if (to && (!r.cancelled_at || r.cancelled_at.slice(0, 10) > to)) return false;
      return true;
    });
  }, [rows, q, reason, user, from, to]);

  const totalMoved = filtered.reduce((a, r) => a + r.cost_moved, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="OP, producto, SKU, unidad…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger><SelectValue placeholder="Motivo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los motivos</SelectItem>
            {reasons.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={user} onValueChange={setUser}>
          <SelectTrigger><SelectValue placeholder="Usuario" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los usuarios</SelectItem>
            {users.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span><b className="text-foreground">{filtered.length}</b> prendas canceladas</span>
        <span>Movido a No Restock: <b className="text-foreground">${totalMoved.toFixed(2)}</b></span>
        <Button size="sm" variant="ghost" onClick={load}>Actualizar</Button>
      </div>

      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No hay prendas canceladas.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>OP</TableHead>
                <TableHead>Unidad / QR</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Variante</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Observaciones</TableHead>
                <TableHead className="text-right">A No Restock</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Estado OP</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {r.cancelled_at ? new Date(r.cancelled_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.order_code ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.unit_code}</TableCell>
                  <TableCell className="text-xs">{r.product_name ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {[r.color, r.size ?? r.variant_label].filter(Boolean).join(" / ") || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-[11px]">{r.variant_sku ?? r.sku ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.reason ?? "—"}</TableCell>
                  <TableCell className="text-xs max-w-[220px] truncate" title={r.notes ?? ""}>
                    {r.notes ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs font-semibold">
                    ${r.cost_moved.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-xs">{r.user_name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{r.order_status ?? "—"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpenOrder?.(r.production_order_id)}
                    >
                      <Eye className="h-3 w-3 mr-1" /> Ver OP
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
