// Módulo Despachos fábrica → tienda (Basico Core).
// No toca WooCommerce, Partidas, Nómina ni costos.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useCoreLocations } from "@/hooks/useCoreLocations";
import {
  useCoreDispatches,
  fetchDispatchUnits,
  resolveUnitForDispatch,
  DISPATCH_STATUS_LABEL,
  type Dispatch,
  type DispatchUnit,
} from "@/hooks/useCoreDispatches";
import {
  downloadDispatchFactoryPdf,
  downloadDispatchReceptionPdf,
  printBothDispatchPdfs,
} from "@/lib/coreDispatchPdf";
import {
  Truck,
  Plus,
  ScanLine,
  X,
  FileDown,
  Printer,
  Send,
  PackageCheck,
  Lock,
  Loader2,
  RefreshCw,
} from "lucide-react";

const TABS: { value: string; label: string; statuses: string[] | null }[] = [
  { value: "draft", label: "Borradores", statuses: ["draft"] },
  { value: "closed", label: "Cerrados", statuses: ["closed"] },
  { value: "sent", label: "Enviados", statuses: ["sent"] },
  { value: "received", label: "Recibidos", statuses: ["received"] },
  { value: "diff", label: "Diferencias", statuses: ["received_with_differences"] },
  { value: "all", label: "Todos", statuses: null },
];

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "received") return "default";
  if (s === "received_with_differences") return "destructive";
  if (s === "cancelled") return "outline";
  return "secondary";
};

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

export default function CoreDispatches() {
  const { dispatches, loading, reload } = useCoreDispatches();
  const { data: locations } = useCoreLocations();
  const [tab, setTab] = useState("draft");
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<Dispatch | null>(null);

  const visible = useMemo(() => {
    const conf = TABS.find((t) => t.value === tab);
    if (!conf?.statuses) return dispatches;
    return dispatches.filter((d) => conf.statuses!.includes(d.status));
  }, [dispatches, tab]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" /> Despachos
          </h1>
          <p className="text-sm text-muted-foreground">
            Salida de prendas de fábrica hacia tienda. El stock entra a la sede solo al confirmar recepción.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={reload} aria-label="Actualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo despacho
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs">
              {t.label}
              <span className="ml-1 opacity-60">
                {t.statuses ? dispatches.filter((d) => t.statuses!.includes(d.status)).length : dispatches.length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : visible.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No hay despachos en esta vista.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {d.dispatch_number ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(d.status)} className="text-[10px]">
                        {DISPATCH_STATUS_LABEL[d.status] ?? d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{d.destination_location_name ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm">{d.unit_count ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDate(d.closed_at ?? d.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setDetail(d)}>
                        Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NewDispatchDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        locations={(locations ?? []).filter((l) => l.status === "activa")}
        onCreated={async (d) => {
          await reload();
          setDetail(d);
        }}
      />

      {detail && (
        <DispatchDetailDialog
          dispatch={detail}
          onClose={() => setDetail(null)}
          onChanged={async () => {
            await reload();
            const { data } = await supabase.from("core_dispatches").select("*").eq("id", detail.id).maybeSingle();
            if (data) setDetail(data as any);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------- Nuevo despacho ------------------------- */

function NewDispatchDialog({
  open,
  onOpenChange,
  locations,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  locations: { id: string; name: string }[];
  onCreated: (d: Dispatch) => void;
}) {
  const [locationId, setLocationId] = useState("");
  const [responsible, setResponsible] = useState("");
  const [carrier, setCarrier] = useState("");
  const [date, setDate] = useState("");
  const [orderId, setOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [orders, setOrders] = useState<{ id: string; order_code: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("core_production_orders")
      .select("id, order_code")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setOrders(((data as any[]) ?? []) as any));
  }, [open]);

  async function submit() {
    if (!locationId) {
      toast({ title: "Falta la sede destino", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("core_dispatches")
      .insert({
        destination_location_id: locationId,
        destination_location_name: locations.find((l) => l.id === locationId)?.name ?? null,
        factory_responsible: responsible || null,
        carrier_name: carrier || null,
        expected_departure_date: date || null,
        production_order_id: orderId || null,
        notes: notes || null,
        created_by: auth?.user?.id ?? null,
      } as any)
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Despacho creado", description: "Escanea las unidades que salen de fábrica." });
    setLocationId(""); setResponsible(""); setCarrier(""); setDate(""); setOrderId(""); setNotes("");
    onOpenChange(false);
    onCreated(data as any);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo despacho</DialogTitle>
          <DialogDescription>Se crea en borrador; luego escaneas las unidades.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Sede / tienda destino *</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger><SelectValue placeholder="Selecciona destino" /></SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Responsable fábrica</Label>
              <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha salida estimada</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Transportista / quien lleva</Label>
              <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>OP asociada (opcional)</Label>
              <Select value={orderId} onValueChange={setOrderId}>
                <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
                <SelectContent>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.order_code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observaciones</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Crear despacho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------- Detalle ------------------------- */

function DispatchDetailDialog({
  dispatch,
  onClose,
  onChanged,
}: {
  dispatch: Dispatch;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [units, setUnits] = useState<DispatchUnit[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const isDraft = dispatch.status === "draft";
  const isClosed = dispatch.status === "closed";
  const isSent = dispatch.status === "sent";
  const isReceived = dispatch.status === "received" || dispatch.status === "received_with_differences";

  async function loadUnits() {
    setUnits(await fetchDispatchUnits(dispatch.id));
  }

  useEffect(() => {
    loadUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch.id, dispatch.status]);

  const stats = useMemo(() => {
    const products = new Set(units.map((u) => u.sku ?? u.product_name ?? "—"));
    const sizes = new Set(units.map((u) => u.size ?? "—"));
    const orders = new Set(units.map((u) => u.order_code).filter(Boolean));
    return { total: units.length, products: products.size, sizes: sizes.size, orders: orders.size };
  }, [units]);

  async function addUnit(raw: string) {
    const res = await resolveUnitForDispatch(raw);
    if (!res.ok) {
      toast({ title: "No se puede agregar", description: res.message, variant: "destructive" });
      return;
    }
    const u = res.unit;
    const { error } = await supabase.from("core_dispatch_units").insert({
      dispatch_id: dispatch.id,
      unit_id: u.id,
      unit_code: u.unit_code,
      production_order_id: u.production_order_id ?? null,
      product_name: u.product_name ?? null,
      sku: u.variant_sku ?? u.sku ?? null,
      size: u.size ?? null,
    } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Unidad agregada", description: u.unit_code });
    await loadUnits();
  }

  async function removeUnit(id: string) {
    await supabase.from("core_dispatch_units").delete().eq("id", id);
    await loadUnits();
  }

  async function closeDispatch() {
    if (units.length === 0) {
      toast({ title: "Sin unidades", description: "Agrega al menos 1 unidad.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("core_close_dispatch", {
      _dispatch_id: dispatch.id,
      _factory_responsible: dispatch.factory_responsible ?? null,
    } as any);
    setBusy(false);
    if (error) {
      toast({ title: "Error al cerrar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Despacho cerrado", description: (data as any)?.dispatch_number ?? "" });
    await onChanged();
  }

  async function cancelDispatch() {
    setBusy(true);
    await supabase.from("core_dispatches").update({ status: "cancelled" } as any).eq("id", dispatch.id);
    await supabase.from("core_dispatch_units").update({ status: "cancelled" } as any).eq("dispatch_id", dispatch.id);
    setBusy(false);
    toast({ title: "Despacho cancelado" });
    await onChanged();
  }

  async function markSent() {
    setBusy(true);
    await supabase
      .from("core_dispatches")
      .update({ status: "sent", sent_at: new Date().toISOString() } as any)
      .eq("id", dispatch.id);
    await supabase
      .from("core_production_units")
      .update({ status: "sent_to_store" } as any)
      .in("id", units.map((u) => u.unit_id))
      .neq("status", "entered_inventory");
    setBusy(false);
    toast({ title: "Marcado como enviado" });
    await onChanged();
  }

  const pdfHeader = {
    dispatch_number: dispatch.dispatch_number,
    status: dispatch.status,
    destination_location_name: dispatch.destination_location_name,
    factory_responsible: dispatch.factory_responsible,
    carrier_name: dispatch.carrier_name,
    notes: dispatch.notes,
    closed_at: dispatch.closed_at,
    sent_at: dispatch.sent_at,
  };
  const pdfUnits = units.map((u) => ({
    unit_code: u.unit_code,
    product_name: u.product_name,
    sku: u.sku,
    size: u.size,
    order_code: u.order_code ?? null,
  }));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Truck className="h-4 w-4" />
            {dispatch.dispatch_number ?? "Despacho en borrador"}
            <Badge variant={statusVariant(dispatch.status)} className="text-[10px]">
              {DISPATCH_STATUS_LABEL[dispatch.status] ?? dispatch.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Destino: {dispatch.destination_location_name ?? "—"} · Responsable:{" "}
            {dispatch.factory_responsible ?? "—"}
            {dispatch.carrier_name ? ` · Lleva: ${dispatch.carrier_name}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Total prendas" value={stats.total} />
            <Stat label="Productos únicos" value={stats.products} />
            <Stat label="Tallas" value={stats.sizes} />
            <Stat label="OP incluidas" value={stats.orders} />
          </div>

          {isDraft && (
            <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
              <Label className="text-xs flex items-center gap-1">
                <ScanLine className="h-3.5 w-3.5" /> Escanear unidad
              </Label>
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const v = code;
                  setCode("");
                  if (v.trim()) await addUnit(v);
                }}
              >
                <Input
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="OP-000010-MF180-S-001"
                  className="font-mono"
                />
                <Button type="submit">Agregar</Button>
              </form>
              <p className="text-[11px] text-muted-foreground">
                Solo se aceptan unidades terminadas / listas para inventario.
              </p>
            </div>
          )}

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit code</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Talla</TableHead>
                  <TableHead>OP</TableHead>
                  <TableHead>Estado</TableHead>
                  {isDraft && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-sm text-muted-foreground">
                      Sin unidades.
                    </TableCell>
                  </TableRow>
                ) : (
                  units.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs">{u.unit_code}</TableCell>
                      <TableCell className="text-xs">{u.product_name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-[11px]">{u.sku ?? "—"}</TableCell>
                      <TableCell className="text-xs">{u.size ?? "—"}</TableCell>
                      <TableCell className="text-xs">{u.order_code ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={u.status === "missing" ? "destructive" : "outline"}
                          className="text-[10px]"
                        >
                          {u.status === "in_dispatch"
                            ? "En despacho"
                            : u.status === "received"
                            ? "Recibida"
                            : u.status === "missing"
                            ? "Faltante"
                            : u.status}
                        </Badge>
                      </TableCell>
                      {isDraft && (
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeUnit(u.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {isReceived && (
            <div className="text-xs text-muted-foreground border rounded-lg p-3">
              Recibido {fmtDate(dispatch.received_at)} por {dispatch.received_by_name ?? "—"}.
              {dispatch.difference_note ? ` Diferencias: ${dispatch.difference_note}` : ""}
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2 border-t pt-3">
          {isDraft && (
            <>
              <Button variant="ghost" onClick={cancelDispatch} disabled={busy}>Cancelar despacho</Button>
              <Button onClick={closeDispatch} disabled={busy || units.length === 0}>
                <Lock className="h-4 w-4 mr-1" /> Cerrar despacho
              </Button>
            </>
          )}
          {(isClosed || isSent || isReceived) && (
            <>
              <Button variant="outline" onClick={() => downloadDispatchFactoryPdf(pdfHeader, pdfUnits)}>
                <FileDown className="h-4 w-4 mr-1" /> PDF Fábrica
              </Button>
              <Button variant="outline" onClick={() => downloadDispatchReceptionPdf(pdfHeader, pdfUnits)}>
                <FileDown className="h-4 w-4 mr-1" /> PDF Tienda
              </Button>
              <Button variant="outline" onClick={() => printBothDispatchPdfs(pdfHeader, pdfUnits)}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir ambos
              </Button>
            </>
          )}
          {isClosed && (
            <Button onClick={markSent} disabled={busy}>
              <Send className="h-4 w-4 mr-1" /> Marcar como enviado
            </Button>
          )}
          {(isClosed || isSent) && (
            <Button onClick={() => setReceiveOpen(true)}>
              <PackageCheck className="h-4 w-4 mr-1" /> Confirmar recepción
            </Button>
          )}
        </DialogFooter>

        {receiveOpen && (
          <ReceiveDialog
            dispatch={dispatch}
            units={units}
            onClose={() => setReceiveOpen(false)}
            onDone={async () => {
              setReceiveOpen(false);
              await onChanged();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-black">{value}</p>
    </Card>
  );
}

/* ------------------------- Recepción ------------------------- */

function ReceiveDialog({
  dispatch,
  units,
  onClose,
  onDone,
}: {
  dispatch: Dispatch;
  units: DispatchUnit[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(units.map((u) => u.unit_id)));
  const [code, setCode] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (unitId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });

  function scan(raw: string) {
    const clean = raw.trim().toUpperCase();
    const found = units.find((u) => u.unit_code.toUpperCase() === clean);
    if (!found) {
      toast({ title: "Unidad no pertenece al despacho", description: clean, variant: "destructive" });
      return;
    }
    setSelected((prev) => new Set(prev).add(found.unit_id));
    toast({ title: "Unidad marcada como recibida", description: found.unit_code });
  }

  async function confirm() {
    setBusy(true);
    const { data, error } = await supabase.rpc("core_receive_dispatch", {
      _dispatch_id: dispatch.id,
      _received_unit_ids: Array.from(selected),
      _received_by: receivedBy || null,
      _note: note || null,
    } as any);
    setBusy(false);
    if (error) {
      toast({ title: "Error al recibir", description: error.message, variant: "destructive" });
      return;
    }
    const r: any = data;
    toast({
      title: r?.status === "received" ? "Recepción confirmada" : "Recibido con diferencias",
      description: `${r?.received ?? 0} de ${r?.total ?? units.length} unidades.`,
    });
    await onDone();
  }

  const missing = units.length - selected.size;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Confirmar recepción {dispatch.dispatch_number}</DialogTitle>
          <DialogDescription>
            Solo al confirmar entran las prendas al inventario de {dispatch.destination_location_name ?? "la sede"}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-3 pr-1">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = code;
              setCode("");
              if (v.trim()) scan(v);
            }}
          >
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Escanear unidad recibida"
              className="font-mono"
            />
            <Button type="submit" variant="secondary">Marcar</Button>
          </form>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set(units.map((u) => u.unit_id)))}>
              Todo recibido
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
              Ninguno
            </Button>
          </div>

          <div className="border rounded-lg divide-y">
            {units.map((u) => (
              <label key={u.id} className="flex items-center gap-2 p-2 text-xs cursor-pointer">
                <Checkbox checked={selected.has(u.unit_id)} onCheckedChange={() => toggle(u.unit_id)} />
                <span className="font-mono">{u.unit_code}</span>
                <span className="text-muted-foreground truncate">
                  {u.product_name ?? "—"} · {u.size ?? "—"}
                </span>
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Responsable tienda</Label>
            <Input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observación / diferencias</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {missing > 0 && (
            <p className="text-xs text-destructive">
              {missing} unidad(es) quedarán como faltantes; el despacho se marcará con diferencias.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={confirm} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <PackageCheck className="h-4 w-4 mr-1" />}
            Confirmar recepción
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
