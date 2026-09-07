import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { MockNotice } from "@/components/sublime/hub/MockNotice";
import { mockCustomers, mockSales, usdFormat } from "@/lib/sublimeMock";

export default function SublimeClientes() {
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      mockCustomers.filter((c) =>
        q.trim() === "" ? true : `${c.name} ${c.idCard ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(q.toLowerCase())
      ),
    [q]
  );

  const customer = mockCustomers.find((c) => c.id === openId) ?? null;
  const history = mockSales.filter((s) => s.customerId === openId);

  return (
    <div className="space-y-6">
      <HubHeader icon={Users} title="Clientes" subtitle="Ficha de cliente e historial de compras" />
      <MockNotice />

      <Card className="p-4 rounded-2xl border-border/60">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nombre, cédula o teléfono…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>

      <Card className="rounded-2xl border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="text-right">Compras</TableHead>
              <TableHead className="text-right">Ticket promedio</TableHead>
              <TableHead>Última compra</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-sm">{c.idCard ?? "—"}</TableCell>
                <TableCell className="text-sm">{c.phone ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{c.purchases}</TableCell>
                <TableCell className="text-right tabular-nums">{usdFormat(c.avgTicketUsd)}</TableCell>
                <TableCell className="text-sm">{c.lastPurchaseAt ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setOpenId(c.id)}>Ver ficha</Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Sin clientes.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={customer !== null} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{customer?.name}</DialogTitle></DialogHeader>
          {customer && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Item label="Cédula" value={customer.idCard ?? "—"} />
                <Item label="Teléfono" value={customer.phone ?? "—"} />
                <Item label="Correo" value={customer.email ?? "—"} />
                <Item label="Nacimiento" value={customer.birthDate ?? "—"} />
                <Item label="Dirección" value={customer.address ?? "—"} />
                <Item label="Ticket promedio" value={usdFormat(customer.avgTicketUsd)} />
              </div>
              {customer.notes && (
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Notas</p>
                  <p>{customer.notes}</p>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Historial de compras</p>
                {history.length === 0 && <p className="text-muted-foreground">Sin compras registradas en el prototipo.</p>}
                {history.map((s) => (
                  <div key={s.id} className="rounded-xl border border-border/60 p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs">{s.code}</p>
                      <p className="text-xs text-muted-foreground">{new Date(s.at).toLocaleString("es-VE")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{s.channel === "pos" ? "Tienda" : "Web"}</Badge>
                      <span className="tabular-nums font-semibold">{usdFormat(s.totalUsd)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
