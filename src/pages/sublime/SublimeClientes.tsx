import { useMemo, useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { PosCustomerForm } from "@/components/sublime/pos/PosCustomerDialog";
import { SaleDetailDialog } from "./SublimeVentas";
import { refFormat } from "@/lib/posMoney";
import { posChannelLabel } from "@/lib/posSalesChannels";
import { posMethod } from "@/lib/posPaymentMethods";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateSublimeCustomer,
  useSublimeCustomersWithStats,
  type SaleRow,
} from "@/hooks/useSublimeSalesHistory";

const dt = (iso: string) => new Date(iso).toLocaleString("es-VE");

export default function SublimeClientes() {
  const { rows: customers, sales, isLoading } = useSublimeCustomersWithStats();
  const createCustomer = useCreateSublimeCustomer();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [openSale, setOpenSale] = useState<SaleRow | null>(null);

  const rows = useMemo(
    () =>
      customers.filter((c) =>
        q.trim() === ""
          ? true
          : `${c.name} ${c.id_card ?? ""} ${c.phone ?? ""} ${c.email ?? ""}`
              .toLowerCase()
              .includes(q.toLowerCase())
      ),
    [customers, q]
  );

  const customer = customers.find((c) => c.id === openId) ?? null;
  const history = sales.filter((s) => s.customer_id === openId);
  const counterSales = sales.filter((s) => !s.customer_id).length;

  return (
    <div className="space-y-6">
      <HubHeader icon={Users} title="Clientes" subtitle="Fichas reales de Sublime e historial de compras" />

      <Card className="p-4 rounded-2xl border-border/60 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nombre, documento, teléfono o correo…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button onClick={() => setNewOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" /> Nuevo cliente
        </Button>
      </Card>

      <p className="text-xs text-muted-foreground">
        {counterSales} venta(s) de mostrador sin cliente identificado — no cuentan como clientes individuales.
      </p>

      <Card className="rounded-2xl border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Alta</TableHead>
              <TableHead className="text-right">Compras</TableHead>
              <TableHead className="text-right">Total comprado</TableHead>
              <TableHead>Última compra</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-sm">{c.id_card ?? "—"}</TableCell>
                <TableCell className="text-sm">{c.phone ?? "—"}</TableCell>
                <TableCell className="text-sm">{c.email ?? "—"}</TableCell>
                <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString("es-VE")}</TableCell>
                <TableCell className="text-right tabular-nums">{c.purchases}</TableCell>
                <TableCell className="text-right tabular-nums">{refFormat(c.totalRef)}</TableCell>
                <TableCell className="text-sm">{c.lastPurchaseAt ? dt(c.lastPurchaseAt) : "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setOpenId(c.id)}>Ver ficha</Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                  {isLoading ? "Cargando clientes…" : "Sin clientes registrados."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle></DialogHeader>
          <PosCustomerForm
            submitLabel="Guardar cliente"
            onSave={async (c) => {
              try {
                await createCustomer.mutateAsync({
                  name: c.name,
                  idCard: c.idCard,
                  phone: c.phone,
                  email: c.email,
                  birthDate: c.birthDate,
                  address: c.address,
                });
                toast({ title: "Cliente creado" });
                setNewOpen(false);
              } catch (e: any) {
                toast({ title: "No se pudo crear el cliente", description: e.message, variant: "destructive" });
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={customer !== null} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{customer?.name}</DialogTitle></DialogHeader>
          {customer && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Item label="Documento" value={customer.id_card ?? "—"} />
                <Item label="Teléfono" value={customer.phone ?? "—"} />
                <Item label="Correo" value={customer.email ?? "—"} />
                <Item label="Dirección" value={customer.address ?? "—"} />
                <Item label="Alta" value={new Date(customer.created_at).toLocaleDateString("es-VE")} />
                <Item label="Ticket promedio" value={refFormat(customer.avgTicketRef)} />
                <Item label="Compras" value={String(customer.purchases)} />
                <Item label="Total comprado" value={refFormat(customer.totalRef)} />
              </div>
              {customer.notes && (
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Notas</p>
                  <p>{customer.notes}</p>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Historial de compras</p>
                {history.length === 0 && <p className="text-muted-foreground">Sin compras registradas.</p>}
                {history.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setOpenSale(s)}
                    className="w-full rounded-xl border border-border/60 p-3 flex items-center justify-between gap-3 text-left hover:border-primary/50 transition-colors"
                  >
                    <div>
                      <p className="font-mono text-xs">{s.sale_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {dt(s.sold_at)} · {s.payments.map((p) => posMethod(p.method).label).join(" + ") || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{posChannelLabel(s.sale_origin, s.origin_detail ?? undefined)}</Badge>
                      <span className="tabular-nums font-semibold">{refFormat(s.total_ref)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SaleDetailDialog sale={openSale} onClose={() => setOpenSale(null)} />
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
