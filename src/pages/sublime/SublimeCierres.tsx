import { useState } from "react";
import { Banknote, Landmark, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { MockNotice } from "@/components/sublime/hub/MockNotice";
import { mockAccounts, mockClosures, mockReconciliation } from "@/lib/sublimeMock";

const RECON_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pendiente", variant: "outline" },
  confirmed: { label: "Confirmado", variant: "secondary" },
  reconciled: { label: "Conciliado", variant: "default" },
  difference: { label: "Con diferencia", variant: "destructive" },
};

export default function SublimeCierres() {
  const [closeOpen, setCloseOpen] = useState(false);
  const [counted, setCounted] = useState("");

  return (
    <div className="space-y-6">
      <HubHeader
        icon={Scale}
        title="Cierres y conciliación"
        subtitle="Cuadre diario de caja, punto de venta y cuentas bancarias"
        actions={<Button onClick={() => setCloseOpen(true)}>Nuevo cierre</Button>}
      />
      <MockNotice />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {mockAccounts.map((a) => (
          <Card key={a.id} className="p-4 rounded-2xl border-border/60">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Landmark className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wider">{a.bank}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{a.account}</p>
            <p className="num text-2xl font-black tabular-nums mt-2">
              {a.currency} {a.balance.toLocaleString("es-VE")}
            </p>
            <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
              <p>Entradas: {a.inflow.toLocaleString("es-VE")}</p>
              <p>Salidas: {a.outflow.toLocaleString("es-VE")}</p>
              <p>Último cuadre: {a.lastReconciled}</p>
            </div>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="recon">
        <TabsList>
          <TabsTrigger value="recon">Conciliación de pagos</TabsTrigger>
          <TabsTrigger value="closures">Cierres diarios</TabsTrigger>
        </TabsList>

        <TabsContent value="recon" className="mt-4">
          <Card className="rounded-2xl border-border/60 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venta</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockReconciliation.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.sale}</TableCell>
                    <TableCell className="text-sm">{r.method}</TableCell>
                    <TableCell className="tabular-nums text-sm">{r.amount}</TableCell>
                    <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                    <TableCell className="text-sm">{r.account}</TableCell>
                    <TableCell>
                      <Badge variant={RECON_LABEL[r.status].variant}>{RECON_LABEL[r.status].label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => toast.success("Pago marcado como conciliado (simulado).")}>
                        Conciliar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="closures" className="mt-4">
          <Card className="rounded-2xl border-border/60 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Esperado</TableHead>
                  <TableHead>Contado</TableHead>
                  <TableHead>Diferencia</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockClosures.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{c.date}</TableCell>
                    <TableCell className="text-sm">{c.type}</TableCell>
                    <TableCell className="tabular-nums text-sm">{c.expected}</TableCell>
                    <TableCell className="tabular-nums text-sm">{c.counted}</TableCell>
                    <TableCell className="tabular-nums text-sm">{c.diff}</TableCell>
                    <TableCell className="text-sm">{c.user}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "Confirmado" ? "secondary" : "destructive"}>{c.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nuevo cierre</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border border-border/60 p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Banknote className="h-4 w-4" /> Esperado hoy
              </span>
              <span className="num text-xl font-black tabular-nums">USD 310</span>
            </div>
            <div className="space-y-1.5">
              <Label>Monto contado</Label>
              <Input value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0.00" />
            </div>
            {counted.trim() !== "" && (
              <p className="text-sm text-muted-foreground">
                Diferencia: <span className="font-semibold tabular-nums">{(Number(counted) - 310).toFixed(2)}</span>
              </p>
            )}
            <Button
              className="w-full h-11"
              onClick={() => {
                setCloseOpen(false);
                setCounted("");
                toast.success("Cierre registrado (simulado).");
              }}
            >
              Confirmar cierre
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
