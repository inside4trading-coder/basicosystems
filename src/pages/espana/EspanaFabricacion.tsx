import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Hammer, Play, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDMY } from "@/lib/dateUtils";

interface FabRow {
  id: string;
  woo_order_id: number | null;
  product_name: string | null;
  variant_label: string | null;
  sku: string | null;
  quantity: number;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  source_order_id: string | null;
  esp_woo_orders?: { order_number: string | null; customer_name: string | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "Fabricando",
  ready: "Listo",
  delivered_to_shipping: "Entregado a envío",
  cancelled: "Cancelado",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-600",
  in_progress: "bg-blue-600",
  ready: "bg-emerald-600",
  delivered_to_shipping: "bg-emerald-700",
  cancelled: "bg-zinc-500",
};

export default function EspanaFabricacion() {
  const [rows, setRows] = useState<FabRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("active");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("esp_fabrication_requests")
      .select("id,woo_order_id,product_name,variant_label,sku,quantity,status,priority,due_date,created_at,source_order_id,esp_woo_orders:source_order_id(order_number,customer_name)")
      .order("created_at", { ascending: false }).limit(300);
    if (statusFilter === "active") q = q.in("status", ["pending", "in_progress", "ready"]);
    else if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter]);

  const setStatus = async (id: string, status: string) => {
    setBusyId(id);
    const patch: any = { status };
    if (status === "cancelled") {
      const reason = window.prompt("Motivo de cancelación:");
      if (!reason) { setBusyId(null); return; }
      patch.cancel_reason = reason;
    }
    const { error } = await supabase.from("esp_fabrication_requests").update(patch).eq("id", id);
    setBusyId(null);
    if (error) toast.error(error.message);
    else { toast.success("Actualizado"); load(); }
  };

  const counts = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Hammer className="h-6 w-6 text-primary" /> Listado de fabricación ES
          </h2>
          <p className="text-sm text-muted-foreground">Cola generada desde pedidos WooCommerce España cuando el producto requiere fabricación.</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Activos (pendiente, fabricando, listo)</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="in_progress">Fabricando</SelectItem>
            <SelectItem value="ready">Listo</SelectItem>
            <SelectItem value="delivered_to_shipping">Entregado a envío</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {["pending","in_progress","ready","delivered_to_shipping","cancelled"].map(s => (
          <Card key={s} className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground">{STATUS_LABEL[s]}</p>
            <p className="text-2xl font-black">{counts[s] || 0}</p>
          </Card>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Cargando…</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Sin items en este estado.</TableCell></TableRow>}
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{formatDMY(r.created_at)}</TableCell>
                <TableCell className="text-xs font-mono">#{r.esp_woo_orders?.order_number || r.woo_order_id || "—"}</TableCell>
                <TableCell className="text-sm font-medium">{r.product_name || "—"} {r.sku && <span className="text-muted-foreground text-xs font-mono">· {r.sku}</span>}</TableCell>
                <TableCell className="text-xs">{r.variant_label || "—"}</TableCell>
                <TableCell className="text-xs">{r.esp_woo_orders?.customer_name || "—"}</TableCell>
                <TableCell className="text-right font-semibold">{r.quantity}</TableCell>
                <TableCell><Badge className={STATUS_COLORS[r.status]}>{STATUS_LABEL[r.status] || r.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {busyId === r.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    {r.status === "pending" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "in_progress")}><Play className="h-3 w-3 mr-1" />Fabricar</Button>}
                    {r.status === "in_progress" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "ready")}><Check className="h-3 w-3 mr-1" />Listo</Button>}
                    {r.status === "ready" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "delivered_to_shipping")}><Check className="h-3 w-3 mr-1" />Entregar</Button>}
                    {!["cancelled","delivered_to_shipping"].includes(r.status) && <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "cancelled")}><X className="h-3 w-3" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
