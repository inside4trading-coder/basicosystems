import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { QrCode, Printer, FileText, Ban, RefreshCw, Eye } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

type Order = {
  id: string;
  order_code: string;
  status: string;
  sku: string | null;
  product_name: string | null;
  total_quantity: number;
  pending_quantity: number;
  completed_quantity: number;
  created_at: string;
};
type Unit = {
  id: string;
  unit_code: string;
  production_order_id: string;
  production_order_line_id: string | null;
  sku: string | null;
  variant_sku: string | null;
  variant_label: string | null;
  size: string | null;
  status: string;
  qr_token: string | null;
  qr_payload: string | null;
  qr_generated_at: string | null;
  printed_at: string | null;
  print_count: number;
  cancelled_reason: string | null;
  created_at: string;
};
type UnitProcess = {
  id: string;
  production_unit_id: string;
  process_name: string;
  process_type: string | null;
  process_order: number;
  adds_to_payroll: boolean;
  suggested_role: string | null;
  status: string;
};

const STATUS_LABEL: Record<string, string> = {
  created: "Creada", printed: "Impresa", in_production: "En producción",
  completed: "Completada", entered_inventory: "En inventario",
  cancelled: "Cancelada", lost: "Perdida", manually_closed: "Cierre manual",
};
const STATUS_BADGE: Record<string, string> = {
  created: "bg-blue-100 text-blue-800 border-blue-300",
  printed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  in_production: "bg-amber-100 text-amber-800 border-amber-300",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  entered_inventory: "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
  lost: "bg-red-100 text-red-800 border-red-300",
  manually_closed: "bg-orange-100 text-orange-800 border-orange-300",
};

const ALLOWED_GEN = ["open", "in_production", "partially_completed"];

export default function CoreQRTravelSheets() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [processes, setProcesses] = useState<UnitProcess[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [cancelOpen, setCancelOpen] = useState<Unit | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [detailUnit, setDetailUnit] = useState<Unit | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: ords }, { data: us }, { data: ps }] = await Promise.all([
      supabase.from("core_production_orders")
        .select("id, order_code, status, sku, product_name, total_quantity, pending_quantity, completed_quantity, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("core_production_units")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("core_production_unit_processes")
        .select("*")
        .order("process_order"),
    ]);
    setOrders((ords as any) ?? []);
    setUnits((us as any) ?? []);
    setProcesses((ps as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const unitsByOrder = useMemo(() => {
    const m: Record<string, Unit[]> = {};
    for (const u of units) (m[u.production_order_id] ||= []).push(u);
    return m;
  }, [units]);

  const processesByUnit = useMemo(() => {
    const m: Record<string, UnitProcess[]> = {};
    for (const p of processes) (m[p.production_unit_id] ||= []).push(p);
    return m;
  }, [processes]);

  const eligibleOrders = useMemo(
    () => orders.filter((o) => ALLOWED_GEN.includes(o.status)),
    [orders],
  );

  const generate = async (order: Order) => {
    setGenerating(order.id);
    try {
      const { data, error } = await supabase.functions.invoke(
        "core-generate-production-units",
        { body: { production_order_id: order.id } },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const created = (data as any)?.created ?? 0;
      const skipped = (data as any)?.skipped_existing ?? 0;
      if (created === 0 && skipped > 0) {
        toast.info(`Esta orden ya tiene ${skipped} unidad(es). No se duplicaron.`);
      } else {
        toast.success(`${created} unidad(es) creada(s).${skipped ? ` ${skipped} ya existían.` : ""}`);
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error generando unidades");
    } finally {
      setGenerating(null);
    }
  };

  const logPrint = async (units_: Unit[], print_type: string, order_id?: string) => {
    if (!units_.length && !order_id) return;
    const rows = units_.length
      ? units_.map((u) => ({
          production_unit_id: u.id,
          production_order_id: u.production_order_id,
          print_type,
        }))
      : [{ production_order_id: order_id!, print_type, production_unit_id: null as any }];
    await supabase.from("core_production_unit_print_logs").insert(rows);
    if (units_.length) {
      const ids = units_.map((u) => u.id);
      const nowIso = new Date().toISOString();
      // Increment print_count and set printed_at; do per-row update since we lack RPC
      for (const u of units_) {
        await supabase
          .from("core_production_units")
          .update({
            printed_at: nowIso,
            print_count: (u.print_count ?? 0) + 1,
            status: u.status === "created" ? "printed" : u.status,
          })
          .eq("id", u.id);
      }
      void ids;
      await load();
    }
  };

  const buildQrDataUrl = async (payload: string) =>
    QRCode.toDataURL(payload, { width: 256, margin: 1 });

  const printLabels = async (units_: Unit[]) => {
    if (!units_.length) { toast.error("Sin unidades para imprimir"); return; }
    const qrs = await Promise.all(units_.map((u) => buildQrDataUrl(u.qr_payload ?? u.unit_code)));
    const html = `
<!doctype html><html><head><meta charset="utf-8"/><title>Etiquetas QR</title>
<style>
@page { size: 57mm 40mm; margin: 0; }
html, body { margin: 0; padding: 0; font-family: Inter, system-ui, sans-serif; }
.label { width: 57mm; height: 40mm; padding: 2mm 2.5mm; box-sizing: border-box;
  display: flex; gap: 2mm; align-items: center; page-break-after: always; }
.label:last-child { page-break-after: auto; }
.label img { width: 32mm; height: 32mm; }
.meta { display: flex; flex-direction: column; gap: 0.5mm; font-size: 8pt; line-height: 1.1; flex: 1; min-width: 0; overflow: hidden; }
.code { font-weight: 800; font-size: 9pt; word-break: break-all; }
.sku { font-family: ui-monospace, Menlo, monospace; font-size: 7.5pt; }
.size { font-weight: 800; font-size: 14pt; }
.op { font-size: 7pt; opacity: 0.75; }
</style></head><body>
${units_.map((u, i) => `
  <div class="label">
    <img src="${qrs[i]}" alt="QR" />
    <div class="meta">
      <div class="code">${u.unit_code}</div>
      <div class="sku">${u.variant_sku ?? u.sku ?? ""}</div>
      <div class="size">Talla ${u.size ?? u.variant_label ?? "—"}</div>
      <div class="op">${orders.find((o) => o.id === u.production_order_id)?.order_code ?? ""}</div>
    </div>
  </div>`).join("")}
<script>window.onload = () => { window.print(); };</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Bloqueado por el navegador"); return; }
    w.document.write(html); w.document.close();
    await logPrint(units_, units_.length > 1 ? "batch_labels" : "qr_label");
  };

  const printTravelSheets = async (units_: Unit[]) => {
    if (!units_.length) { toast.error("Sin unidades para imprimir"); return; }
    const qrs = await Promise.all(units_.map((u) => buildQrDataUrl(u.qr_payload ?? u.unit_code)));
    const html = `
<!doctype html><html><head><meta charset="utf-8"/><title>Ficha Viajera</title>
<style>
@page { size: A5; margin: 10mm; }
html, body { margin: 0; padding: 0; font-family: Inter, system-ui, sans-serif; color: #0a0a0a; }
.sheet { page-break-after: always; padding: 4mm; }
.sheet:last-child { page-break-after: auto; }
.head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0a0a0a; padding-bottom: 4mm; margin-bottom: 4mm; }
.brand { font-weight: 900; letter-spacing: 0.05em; font-size: 14pt; color: #E3001B; }
.op { font-size: 10pt; opacity: 0.7; }
.qr { display: flex; gap: 6mm; align-items: center; margin-bottom: 6mm; }
.qr img { width: 45mm; height: 45mm; }
.qr .code { font-weight: 900; font-size: 18pt; word-break: break-all; }
.qr .size { font-size: 28pt; font-weight: 900; margin-top: 2mm; }
.row { display: flex; gap: 6mm; margin-bottom: 2mm; font-size: 10pt; }
.row b { display: inline-block; min-width: 28mm; }
h3 { font-size: 11pt; margin: 6mm 0 2mm; border-bottom: 1px solid #ddd; padding-bottom: 1mm; }
ul.proc { list-style: none; padding: 0; margin: 0; font-size: 10pt; }
ul.proc li { display: flex; gap: 4mm; padding: 2mm 0; border-bottom: 1px dashed #ddd; align-items: center; }
ul.proc li .chk { width: 5mm; height: 5mm; border: 1.5px solid #0a0a0a; display: inline-block; }
ul.proc li .pay { font-size: 8pt; padding: 1mm 2mm; border-radius: 2mm; background: #fdecef; color: #E3001B; font-weight: 700; }
.notes { border: 1px dashed #999; min-height: 30mm; padding: 3mm; font-size: 9pt; color: #666; }
.foot { margin-top: 6mm; font-size: 8pt; opacity: 0.6; }
</style></head><body>
${units_.map((u, i) => {
  const ord = orders.find((o) => o.id === u.production_order_id);
  const procs = processesByUnit[u.id] ?? [];
  return `
  <div class="sheet">
    <div class="head">
      <div>
        <div class="brand">BASICO · Ficha Viajera</div>
        <div class="op">OP: ${ord?.order_code ?? ""}</div>
      </div>
      <div style="text-align:right;font-size:9pt;opacity:0.7">
        Generada: ${new Date().toLocaleString()}<br/>
        ID: ${u.id.slice(0, 8)}
      </div>
    </div>
    <div class="qr">
      <img src="${qrs[i]}" alt="QR"/>
      <div>
        <div class="code">${u.unit_code}</div>
        <div class="size">${u.size ?? u.variant_label ?? "—"}</div>
      </div>
    </div>
    <div class="row"><b>Producto:</b> ${ord?.product_name ?? ""}</div>
    <div class="row"><b>SKU padre:</b> ${u.sku ?? ord?.sku ?? ""}</div>
    <div class="row"><b>SKU variante:</b> ${u.variant_sku ?? ""}</div>
    <div class="row"><b>Cantidad:</b> 1 unidad</div>
    <h3>Procesos requeridos</h3>
    <ul class="proc">
      ${procs.length === 0
        ? '<li><i>Sin procesos asociados.</i></li>'
        : procs.map((p) => `
        <li>
          <span class="chk"></span>
          <span style="flex:1"><b>${p.process_order}.</b> ${p.process_name}${p.suggested_role ? ` — <i>${p.suggested_role}</i>` : ""}</span>
          ${p.adds_to_payroll ? '<span class="pay">Nómina</span>' : ""}
        </li>`).join("")}
    </ul>
    <h3>Observaciones</h3>
    <div class="notes"></div>
    <div class="foot">Escanea el QR para abrir la unidad. Esta ficha NO marca procesos como completados.</div>
  </div>`;
}).join("")}
<script>window.onload = () => { window.print(); };</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Bloqueado por el navegador"); return; }
    w.document.write(html); w.document.close();
    await logPrint(units_, units_.length > 1 ? "batch_travel_sheets" : "travel_sheet");
  };

  const cancelUnit = async () => {
    if (!cancelOpen) return;
    if (!cancelReason.trim()) { toast.error("Motivo obligatorio"); return; }
    const { error } = await supabase
      .from("core_production_units")
      .update({
        status: "cancelled",
        cancelled_reason: cancelReason,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", cancelOpen.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("core_audit_logs").insert({
      action: "cancel_production_unit",
      table_name: "core_production_units",
      record_id: cancelOpen.id,
      new_value: cancelReason,
    });
    toast.success("Unidad cancelada");
    setCancelOpen(null); setCancelReason("");
    await load();
  };

  // KPIs
  const kpis = useMemo(() => ({
    ordersReady: eligibleOrders.length,
    totalUnits: units.filter((u) => u.status !== "cancelled").length,
    printed: units.filter((u) => (u.print_count ?? 0) > 0 && u.status !== "cancelled").length,
    cancelled: units.filter((u) => u.status === "cancelled").length,
  }), [units, eligibleOrders]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="h-6 w-6 text-primary" />
            QR / Ficha Viajera
          </h1>
          <p className="text-sm text-muted-foreground">
            Genera unidades individuales con QR, ficha viajera y etiquetas 57×40 mm.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refrescar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Órdenes listas</div><div className="text-2xl font-bold">{kpis.ordersReady}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Unidades</div><div className="text-2xl font-bold">{kpis.totalUnits}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Impresas</div><div className="text-2xl font-bold">{kpis.printed}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Canceladas</div><div className="text-2xl font-bold">{kpis.cancelled}</div></Card>
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Órdenes listas</TabsTrigger>
          <TabsTrigger value="units">Unidades generadas</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card className="p-4 mt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código OP</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Generadas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eligibleOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No hay órdenes en estado open / in_production.
                    </TableCell>
                  </TableRow>
                ) : eligibleOrders.map((o) => {
                  const u = unitsByOrder[o.id] ?? [];
                  const active = u.filter((x) => x.status !== "cancelled");
                  const fullyGenerated = active.length >= Number(o.total_quantity);
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-sm">{o.order_code}</TableCell>
                      <TableCell>{o.product_name}</TableCell>
                      <TableCell className="font-mono text-xs">{o.sku}</TableCell>
                      <TableCell className="text-right">{o.total_quantity}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={fullyGenerated ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"}>
                          {active.length}/{o.total_quantity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{o.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" onClick={() => generate(o)} disabled={generating === o.id}>
                          <QrCode className="h-3 w-3 mr-1" />
                          {generating === o.id ? "Generando..." : fullyGenerated ? "Regenerar faltantes" : "Generar unidades"}
                        </Button>
                        {active.length > 0 && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => printLabels(active)}>
                              <Printer className="h-3 w-3 mr-1" /> Etiquetas
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => printTravelSheets(active)}>
                              <FileText className="h-3 w-3 mr-1" /> Fichas
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="units">
          <Card className="p-4 mt-3">
            {selectedUnits.size > 0 && (
              <div className="flex items-center justify-between gap-2 mb-3 p-2 rounded-md border border-primary/30 bg-primary/5">
                <div className="text-sm font-semibold">{selectedUnits.size} seleccionada(s)</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setSelectedUnits(new Set())}>Cancelar</Button>
                  <Button size="sm" variant="outline" onClick={() => printLabels(units.filter((u) => selectedUnits.has(u.id)))}>
                    <Printer className="h-3 w-3 mr-1" /> Imprimir etiquetas
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => printTravelSheets(units.filter((u) => selectedUnits.has(u.id)))}>
                    <FileText className="h-3 w-3 mr-1" /> Imprimir fichas
                  </Button>
                </div>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[36px]">
                    <Checkbox
                      checked={units.length > 0 && units.every((u) => selectedUnits.has(u.id))}
                      onCheckedChange={(c) => {
                        if (c) setSelectedUnits(new Set(units.map((u) => u.id)));
                        else setSelectedUnits(new Set());
                      }}
                    />
                  </TableHead>
                  <TableHead>Código unidad</TableHead>
                  <TableHead>OP</TableHead>
                  <TableHead>SKU variante</TableHead>
                  <TableHead>Talla</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>QR</TableHead>
                  <TableHead>Impresa</TableHead>
                  <TableHead>Creada</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Sin unidades generadas todavía.</TableCell></TableRow>
                ) : units.map((u) => {
                  const ord = orders.find((o) => o.id === u.production_order_id);
                  const checked = selectedUnits.has(u.id);
                  return (
                    <TableRow key={u.id} data-state={checked ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            setSelectedUnits((prev) => {
                              const next = new Set(prev);
                              if (c) next.add(u.id); else next.delete(u.id);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold">{u.unit_code}</TableCell>
                      <TableCell className="font-mono text-xs">{ord?.order_code}</TableCell>
                      <TableCell className="font-mono text-xs">{u.variant_sku}</TableCell>
                      <TableCell>
                        <Badge className="bg-primary text-primary-foreground font-bold">{u.size ?? "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_BADGE[u.status]}>{STATUS_LABEL[u.status] ?? u.status}</Badge>
                      </TableCell>
                      <TableCell>{u.qr_token ? "✓" : "—"}</TableCell>
                      <TableCell className="text-xs">
                        {u.print_count > 0 ? `${u.print_count}×` : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{new Date(u.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="outline" onClick={() => setDetailUnit(u)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => printLabels([u])}
                          disabled={u.status === "cancelled"}>
                          <Printer className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => printTravelSheets([u])}
                          disabled={u.status === "cancelled"}>
                          <FileText className="h-3 w-3" />
                        </Button>
                        {u.status !== "cancelled" && (
                          <Button size="sm" variant="destructive" onClick={() => setCancelOpen(u)}>
                            <Ban className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detalle / preview QR */}
      <Dialog open={!!detailUnit} onOpenChange={(o) => !o && setDetailUnit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-mono">{detailUnit?.unit_code}</DialogTitle></DialogHeader>
          {detailUnit && (
            <UnitPreview
              unit={detailUnit}
              processes={processesByUnit[detailUnit.id] ?? []}
              order={orders.find((o) => o.id === detailUnit.production_order_id) ?? null}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => detailUnit && printLabels([detailUnit])}>
              <Printer className="h-3 w-3 mr-1" /> Etiqueta
            </Button>
            <Button variant="outline" onClick={() => detailUnit && printTravelSheets([detailUnit])}>
              <FileText className="h-3 w-3 mr-1" /> Ficha viajera
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelar unidad */}
      <Dialog open={!!cancelOpen} onOpenChange={(o) => !o && setCancelOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar unidad {cancelOpen?.unit_code}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motivo *</Label>
              <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            </div>
            <div className="text-xs text-muted-foreground">
              La unidad no se elimina; queda con estado <b>cancelled</b> y motivo registrado.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(null)}>Volver</Button>
            <Button variant="destructive" onClick={cancelUnit}>Cancelar unidad</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UnitPreview({ unit, processes, order }: { unit: Unit; processes: UnitProcess[]; order: Order | null }) {
  const [qrUrl, setQrUrl] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(unit.qr_payload ?? unit.unit_code, { width: 220, margin: 1 })
      .then(setQrUrl).catch(() => setQrUrl(""));
  }, [unit]);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {qrUrl && <img src={qrUrl} alt="QR" className="w-32 h-32 border rounded" />}
        <div className="space-y-1">
          <div className="text-2xl font-black">Talla {unit.size ?? "—"}</div>
          <div className="text-xs font-mono">{unit.variant_sku}</div>
          <div className="text-xs text-muted-foreground">OP: {order?.order_code}</div>
        </div>
      </div>
      <div className="text-sm">
        <div><b>Producto:</b> {order?.product_name}</div>
        <div><b>Estado:</b> {STATUS_LABEL[unit.status] ?? unit.status}</div>
        <div><b>Impresiones:</b> {unit.print_count}</div>
      </div>
      <div>
        <div className="text-sm font-semibold mb-1">Procesos pendientes</div>
        {processes.length === 0 ? (
          <div className="text-xs text-muted-foreground">Sin procesos asociados.</div>
        ) : (
          <ul className="text-sm space-y-1">
            {processes.map((p) => (
              <li key={p.id} className="flex items-center gap-2 border rounded p-1.5">
                <span className="font-mono text-xs">{p.process_order}.</span>
                <span className="flex-1">{p.process_name}</span>
                {p.adds_to_payroll && <Badge variant="outline" className="text-[10px]">Nómina</Badge>}
                <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
