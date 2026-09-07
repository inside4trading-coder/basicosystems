import { useMemo, useState } from "react";
import { Receipt, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { MockNotice } from "@/components/sublime/hub/MockNotice";
import { locationName, mockSales, usdFormat } from "@/lib/sublimeMock";
import { PAYMENT_METHOD_LABEL } from "@/types/sublimeHub";

export default function SublimeVentas() {
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      mockSales.filter((s) => {
        const okChannel = channel === "all" || s.channel === channel;
        const okQ = q.trim() === "" || `${s.code} ${s.customerName ?? ""}`.toLowerCase().includes(q.toLowerCase());
        return okChannel && okQ;
      }),
    [q, channel]
  );

  const sale = mockSales.find((s) => s.id === openId) ?? null;

  return (
    <div className="space-y-6">
      <HubHeader icon={Receipt} title="Historial de ventas" subtitle="Ventas de tienda y web con su detalle de cobro" />
      <MockNotice />

      <Card className="p-4 rounded-2xl border-border/60">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por código o cliente…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los canales</SelectItem>
              <SelectItem value="pos">Tienda</SelectItem>
              <SelectItem value="web">Web</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="rounded-2xl border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.code}</TableCell>
                <TableCell className="text-sm">{new Date(s.at).toLocaleString("es-VE")}</TableCell>
                <TableCell><Badge variant="secondary">{s.channel === "pos" ? "Tienda" : "Web"}</Badge></TableCell>
                <TableCell className="text-sm">{s.customerName ?? "Sin cliente"}</TableCell>
                <TableCell className="text-sm">{locationName(s.locationId)}</TableCell>
                <TableCell className="text-right tabular-nums">{s.units}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{usdFormat(s.totalUsd)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setOpenId(s.id)}>Ver detalle</Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Sin ventas.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={sale !== null} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Venta {sale?.code}</DialogTitle></DialogHeader>
          {sale && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Item label="Fecha" value={new Date(sale.at).toLocaleString("es-VE")} />
                <Item label="Canal" value={sale.channel === "pos" ? "Tienda" : "Web"} />
                <Item label="Cliente" value={sale.customerName ?? "Sin cliente"} />
                <Item label="Ubicación" value={locationName(sale.locationId)} />
                <Item label="Unidades" value={String(sale.units)} />
                <Item label="Descuento" value={usdFormat(sale.discountUsd)} />
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Pagos</p>
                {sale.payments.map((p) => (
                  <div key={p.id} className="rounded-xl border border-border/60 p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{PAYMENT_METHOD_LABEL[p.method]}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.currency} {p.amount.toLocaleString("es-VE")}
                        {p.reference ? ` · Ref ${p.reference}` : ""}
                        {p.bank ? ` · ${p.bank}` : ""}
                      </p>
                    </div>
                    <span className="tabular-nums font-semibold">{usdFormat(p.amountUsd)}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-border/60 p-3 flex items-center justify-between">
                <span className="font-bold">Total</span>
                <span className="num text-2xl font-black tabular-nums">{usdFormat(sale.totalUsd)}</span>
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
