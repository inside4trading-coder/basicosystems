import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  HeartHandshake, Plus, RefreshCw, ExternalLink, CheckCircle2, XCircle, Copy, Upload, Receipt, History, Settings as SettingsIcon, Download,
} from "lucide-react";
import { Link } from "react-router-dom";

type Metodo = "pago_movil" | "binance" | "zelle" | "efectivo_sublime";
type Moneda = "VES" | "USD" | "USDT";
type AporteEstado =
  | "por_verificar" | "coincidencia_encontrada" | "confirmado"
  | "rechazado" | "duplicado" | "monto_incorrecto";
type EgresoCategoria = "comida" | "agua" | "medicina" | "transporte" | "logistica" | "refugio" | "otro";
type EgresoEstado = "pendiente" | "aprobado" | "ejecutado" | "anulado";

type Aporte = {
  id: string;
  created_at: string;
  fecha_reportada: string | null;
  fecha_confirmada: string | null;
  nombre_donante: string | null;
  nombre_publico: string | null;
  es_anonimo: boolean;
  email_contacto: string | null;
  metodo: Metodo;
  moneda_original: Moneda;
  monto_original: number;
  tasa_usada: number | null;
  equivalente_usd: number | null;
  referencia_privada: string | null;
  referencia_publica_enmascarada: string | null;
  estado: AporteEstado;
  nota_publica: string | null;
  nota_interna: string | null;
};

type Movimiento = {
  id: string;
  fecha: string;
  metodo: Metodo;
  referencia: string | null;
  monto: number;
  moneda: Moneda;
  origen: string | null;
  estado: string;
};

type Egreso = {
  id: string;
  fecha_gasto: string | null;
  fecha_ejecucion: string | null;
  categoria: EgresoCategoria;
  descripcion: string | null;
  proveedor: string | null;
  moneda_original: Moneda;
  monto_original: number;
  tasa_usada: number | null;
  equivalente_usd: number | null;
  estado: EgresoEstado;
  nota_publica: string | null;
  nota_interna: string | null;
};

type AuditRow = {
  id: string;
  created_at: string;
  user_email: string | null;
  accion: string;
  tabla: string;
  record_id: string | null;
};

const ESTADO_BADGE: Record<AporteEstado, { label: string; variant: any }> = {
  por_verificar: { label: "Por verificar", variant: "secondary" },
  coincidencia_encontrada: { label: "Coincidencia", variant: "default" },
  confirmado: { label: "Confirmado", variant: "default" },
  rechazado: { label: "Rechazado", variant: "destructive" },
  duplicado: { label: "Duplicado", variant: "destructive" },
  monto_incorrecto: { label: "Monto incorrecto", variant: "destructive" },
};

const nfmt = (n?: number | null) =>
  n == null ? "—" : Number(n).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUSD = (n?: number | null) => (n == null ? "—" : `US$ ${nfmt(n)}`);
const fmtBs = (n?: number | null) => (n == null ? "—" : `Bs ${nfmt(n)}`);
const fmtUSDT = (n?: number | null) => (n == null ? "—" : `${nfmt(n)} USDT`);
const fmtMonto = (n: number, m: string) => {
  if (m === "VES") return fmtBs(n);
  if (m === "USD") return fmtUSD(n);
  if (m === "USDT") return fmtUSDT(n);
  return `${nfmt(n)} ${m}`;
};
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString("es-VE") : "—");
const fmtDateOrNone = (d?: string | null) => (d ? new Date(d).toLocaleString("es-VE") : "sin actualizaciones todavía");

function maskRef(metodo: Metodo, raw: string): string {
  const v = (raw || "").trim();
  if (!v) return "";
  const tail = v.slice(-4);
  if (metodo === "zelle") {
    const at = v.indexOf("@");
    if (at > 0) {
      const dom = v.slice(at);
      return `****${dom}`;
    }
    return `****${tail}`;
  }
  if (metodo === "binance") return `tx ****${tail.toUpperCase()}`;
  return `ref. ****${tail}`;
}

function toCsv(rows: any[], cols: { key: string; label: string }[]): string {
  const head = cols.map((c) => `"${c.label}"`).join(",");
  const body = rows
    .map((r) =>
      cols
        .map((c) => {
          const v = r[c.key];
          if (v == null) return "";
          const s = String(v).replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(",")
    )
    .join("\n");
  return `${head}\n${body}`;
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FondoTransparente() {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <HeartHandshake className="h-7 w-7" /> Fondo Transparente
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestión interna de aportes, conciliación y egresos. Página pública en{" "}
            <Link to="/fuerza-venezuela" target="_blank" className="underline">/fuerza-venezuela</Link>.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/fuerza-venezuela" target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" /> Ver página pública
          </a>
        </Button>
      </header>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="aportes">Aportes</TabsTrigger>
          <TabsTrigger value="conciliacion">Conciliación</TabsTrigger>
          <TabsTrigger value="carga">Carga masiva</TabsTrigger>
          <TabsTrigger value="egresos">Egresos</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
          <TabsTrigger value="configuracion">Configuración pública</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><DashboardTab /></TabsContent>
        <TabsContent value="aportes"><AportesTab /></TabsContent>
        <TabsContent value="conciliacion"><ConciliacionTab /></TabsContent>
        <TabsContent value="carga"><CargaMasivaTab /></TabsContent>
        <TabsContent value="egresos"><EgresosTab /></TabsContent>
        <TabsContent value="auditoria"><AuditoriaTab /></TabsContent>
        <TabsContent value="configuracion"><ConfiguracionTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- DASHBOARD ---------------- */
function DashboardTab() {
  const [t, setT] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("fondo_public_totales").select("*").single();
    setT(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const tasa = t?.tasa_ves_usd && Number(t.tasa_ves_usd) > 0 ? Number(t.tasa_ves_usd) : null;
  const vesSaldoUsd = tasa && t?.ves_saldo != null ? Number(t.ves_saldo) / tasa : null;
  const totalRefUsd = (vesSaldoUsd ?? 0) + Number(t?.usd_saldo ?? 0) + Number(t?.usdt_saldo ?? 0);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refrescar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Pago Móvil / Bolívares</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KCard label="Confirmado" value={fmtBs(t?.ves_confirmado ?? 0)} accent="primary" />
          <KCard label="Por verificar" value={fmtBs(t?.ves_por_verificar ?? 0)} />
          <KCard label="Egresos" value={fmtBs(t?.ves_egresos ?? 0)} />
          <KCard label="Saldo disponible" value={fmtBs(t?.ves_saldo ?? 0)} accent="success" />
        </CardContent>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {tasa ? (
            <>Equivalente USD del saldo: <strong>{fmtUSD(vesSaldoUsd)}</strong> · Tasa: 1 USD = {nfmt(tasa)} Bs
            {t?.tasa_fecha ? ` · ${new Date(t.tasa_fecha).toLocaleDateString("es-VE")}` : ""}
            {t?.tasa_fuente ? ` · ${t.tasa_fuente}` : ""}</>
          ) : (
            <>Tasa del día no configurada (Configuración → Tasa del día).</>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Zelle + Efectivo Sublime / USD</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KCard label="Confirmado" value={fmtUSD(t?.usd_confirmado ?? 0)} accent="primary" />
          <KCard label="Por verificar" value={fmtUSD(t?.usd_por_verificar ?? 0)} />
          <KCard label="Egresos" value={fmtUSD(t?.usd_egresos ?? 0)} />
          <KCard label="Saldo disponible" value={fmtUSD(t?.usd_saldo ?? 0)} accent="success" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Binance / USDT</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KCard label="Confirmado" value={fmtUSDT(t?.usdt_confirmado ?? 0)} accent="primary" />
          <KCard label="Por verificar" value={fmtUSDT(t?.usdt_por_verificar ?? 0)} />
          <KCard label="Egresos" value={fmtUSDT(t?.usdt_egresos ?? 0)} />
          <KCard label="Saldo disponible" value={fmtUSDT(t?.usdt_saldo ?? 0)} accent="success" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Resumen general (referencial)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KCard label="Saldo Bs" value={fmtBs(t?.ves_saldo ?? 0)} />
          <KCard label="Equiv USD de Bs" value={fmtUSD(vesSaldoUsd)} />
          <KCard label="Saldo USD" value={fmtUSD(t?.usd_saldo ?? 0)} />
          <KCard label="Saldo USDT" value={fmtUSDT(t?.usdt_saldo ?? 0)} />
          <KCard label="Total aprox USD" value={fmtUSD(totalRefUsd)} accent="success" />
        </CardContent>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          Cifra referencial. Cada moneda se gasta por separado; no hay conversión automática entre saldos.
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {t?.ultima_actualizacion
          ? <>Última actualización: {fmtDate(t.ultima_actualizacion)} · {t?.aportes_confirmados_count ?? 0} confirmados · {t?.aportes_pendientes_count ?? 0} pendientes</>
          : <>sin actualizaciones todavía</>}
        {loading && " · cargando…"}
      </p>

      <Card>
        <CardHeader><CardTitle className="text-sm">Reglas contables</CardTitle></CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <div>· Pago Móvil → VES · Zelle → USD · Efectivo Sublime → USD · Binance → USDT</div>
          <div>· Los egresos descuentan saldo de la misma moneda usada para pagar.</div>
          <div>· No se mezclan monedas automáticamente. Las conversiones deben registrarse como movimiento de conversión.</div>
        </CardContent>
      </Card>
    </div>
  );
}

function KCard({ label, value, accent }: { label: string; value: string; accent?: "primary" | "success" }) {
  return (
    <Card className={accent === "primary" ? "bg-primary text-primary-foreground" : accent === "success" ? "border-green-500" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-wider opacity-80">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xl md:text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

/* ---------------- APORTES ---------------- */
function AportesTab() {
  const [rows, setRows] = useState<Aporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>("all");
  const [filtroMetodo, setFiltroMetodo] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fondo_aportes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter(
    (r) => (filtroEstado === "all" || r.estado === filtroEstado) && (filtroMetodo === "all" || r.metodo === filtroMetodo)
  );

  const toggleAll = (checked: boolean) => {
    if (!checked) return setSelected(new Set());
    setSelected(new Set(filtered.filter((r) => r.estado === "coincidencia_encontrada").map((r) => r.id)));
  };
  const toggleOne = (id: string, c: boolean) => {
    const n = new Set(selected);
    c ? n.add(id) : n.delete(id);
    setSelected(n);
  };

  const confirmarSeleccion = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    let ok = 0, ko = 0;
    for (const id of ids) {
      const { error } = await supabase.rpc("fondo_confirmar_aporte", { p_id: id });
      if (error) ko++; else ok++;
    }
    toast.success(`Confirmados: ${ok}${ko ? ` · errores: ${ko}` : ""}`);
    setSelected(new Set());
    load();
  };

  const exportar = () => {
    const csv = toCsv(filtered, [
      { key: "fecha_reportada", label: "Fecha reportada" },
      { key: "fecha_confirmada", label: "Fecha confirmada" },
      { key: "nombre_donante", label: "Donante" },
      { key: "metodo", label: "Método" },
      { key: "moneda_original", label: "Moneda" },
      { key: "monto_original", label: "Monto" },
      { key: "tasa_usada", label: "Tasa" },
      { key: "equivalente_usd", label: "USD" },
      { key: "referencia_privada", label: "Referencia" },
      { key: "estado", label: "Estado" },
    ]);
    downloadCsv(`fondo_aportes_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const exactosSelCount = useMemo(
    () => filtered.filter((r) => selected.has(r.id) && r.estado === "coincidencia_encontrada").length,
    [filtered, selected]
  );

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Estado</Label>
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="por_verificar">Por verificar</SelectItem>
              <SelectItem value="coincidencia_encontrada">Coincidencia</SelectItem>
              <SelectItem value="confirmado">Confirmados</SelectItem>
              <SelectItem value="rechazado">Rechazados</SelectItem>
              <SelectItem value="duplicado">Duplicados</SelectItem>
              <SelectItem value="monto_incorrecto">Monto incorrecto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Método</Label>
          <Select value={filtroMetodo} onValueChange={setFiltroMetodo}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pago_movil">Pago Móvil (Bs)</SelectItem>
              <SelectItem value="zelle">Zelle (USD)</SelectItem>
              <SelectItem value="efectivo_sublime">Efectivo Sublime (USD)</SelectItem>
              <SelectItem value="binance">Binance (USDT)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" /> Refrescar</Button>
          <Button variant="outline" size="sm" onClick={exportar}><Download className="h-4 w-4 mr-2" /> CSV</Button>
          <Button size="sm" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-2" /> Reportar aporte</Button>
        </div>
      </div>

      {exactosSelCount > 0 && (
        <Card className="border-primary">
          <CardContent className="py-3 flex items-center justify-between">
            <div className="text-sm">
              <strong>{exactosSelCount}</strong> aporte(s) con coincidencia exacta seleccionados.
              <span className="text-muted-foreground ml-2">
                Total: {fmtUSD(filtered.filter((r) => selected.has(r.id)).reduce((s, r) => s + (r.equivalente_usd ?? 0), 0))}
              </span>
            </div>
            <Button size="sm" onClick={confirmarSeleccion}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar coincidencias exactas seleccionadas
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))}
                      onCheckedChange={(c) => toggleAll(Boolean(c))}
                    />
                  </TableHead>
                  <TableHead>Reportado</TableHead>
                  <TableHead>Donante</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>USD</TableHead>
                  <TableHead>Ref. pública</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">Cargando…</TableCell></TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">Sin aportes.</TableCell></TableRow>
                )}
                {filtered.map((r) => {
                  const b = ESTADO_BADGE[r.estado];
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        {r.estado === "coincidencia_encontrada" && (
                          <Checkbox checked={selected.has(r.id)} onCheckedChange={(c) => toggleOne(r.id, Boolean(c))} />
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{r.fecha_reportada ?? fmtDate(r.created_at)}</TableCell>
                      <TableCell className="text-sm">
                        {r.es_anonimo ? <em>anónimo</em> : (r.nombre_donante || r.nombre_publico || "—")}
                      </TableCell>
                      <TableCell className="text-sm">{r.metodo}</TableCell>
                      <TableCell className="text-sm tabular-nums">{fmtMonto(r.monto_original, r.moneda_original)}</TableCell>
                      <TableCell className="text-sm tabular-nums">{fmtUSD(r.equivalente_usd)}</TableCell>
                      <TableCell className="text-sm font-mono text-xs">{r.referencia_publica_enmascarada ?? "—"}</TableCell>
                      <TableCell><Badge variant={b.variant}>{b.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setEditingId(r.id)}>Gestionar</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {openNew && <AporteFormDialog onClose={() => { setOpenNew(false); load(); }} />}
      {editingId && (
        <AporteGestionDialog
          aporte={rows.find((x) => x.id === editingId)!}
          onClose={() => { setEditingId(null); load(); }}
        />
      )}
    </div>
  );
}

function AporteFormDialog({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({
    nombre_donante: "",
    nombre_publico: "",
    es_anonimo: false,
    email_contacto: "",
    metodo: "pago_movil" as Metodo,
    moneda_original: "VES" as Moneda,
    monto_original: "",
    tasa_usada: "",
    referencia_privada: "",
    fecha_reportada: new Date().toISOString().slice(0, 10),
    nota_interna: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const monto = parseFloat(f.monto_original);
    if (!monto || monto <= 0) return toast.error("Monto inválido");
    setSaving(true);
    const tasa = f.tasa_usada ? parseFloat(f.tasa_usada) : null;
    const equiv =
      f.moneda_original === "USD" || f.moneda_original === "USDT"
        ? monto
        : tasa
          ? monto / tasa
          : null;
    const ref = f.referencia_privada ? maskRef(f.metodo, f.referencia_privada) : null;
    const { error } = await supabase.from("fondo_aportes").insert({
      nombre_donante: f.nombre_donante || null,
      nombre_publico: f.nombre_publico || null,
      es_anonimo: f.es_anonimo,
      email_contacto: f.email_contacto || null,
      metodo: f.metodo,
      moneda_original: f.moneda_original,
      monto_original: monto,
      tasa_usada: tasa,
      equivalente_usd: equiv,
      referencia_privada: f.referencia_privada || null,
      referencia_publica_enmascarada: ref,
      fecha_reportada: f.fecha_reportada || null,
      nota_interna: f.nota_interna || null,
      estado: "por_verificar",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Aporte registrado");
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Reportar aporte</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Donante (interno)</Label>
            <Input value={f.nombre_donante} onChange={(e) => setF({ ...f, nombre_donante: e.target.value })} />
          </div>
          <div>
            <Label>Nombre público</Label>
            <Input value={f.nombre_publico} onChange={(e) => setF({ ...f, nombre_publico: e.target.value })} />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox checked={f.es_anonimo} onCheckedChange={(c) => setF({ ...f, es_anonimo: Boolean(c) })} />
            <Label>Mostrar como anónimo</Label>
          </div>
          <div>
            <Label>Email contacto</Label>
            <Input value={f.email_contacto} onChange={(e) => setF({ ...f, email_contacto: e.target.value })} />
          </div>
          <div>
            <Label>Método</Label>
            <Select
              value={f.metodo}
              onValueChange={(v) => {
                const metodo = v as Metodo;
                const monedaForzada: Moneda =
                  metodo === "pago_movil" ? "VES"
                  : metodo === "binance" ? "USDT"
                  : "USD";
                setF({ ...f, metodo, moneda_original: monedaForzada });
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pago_movil">Pago Móvil (Bs)</SelectItem>
                <SelectItem value="zelle">Zelle (USD)</SelectItem>
                <SelectItem value="efectivo_sublime">Efectivo Sublime (USD)</SelectItem>
                <SelectItem value="binance">Binance (USDT)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Moneda</Label>
            <Input value={f.moneda_original} disabled />
            <p className="text-[10px] text-muted-foreground mt-1">
              Determinada por el método. No se mezclan monedas automáticamente.
            </p>
          </div>
          <div>
            <Label>Monto</Label>
            <Input type="number" step="0.01" value={f.monto_original} onChange={(e) => setF({ ...f, monto_original: e.target.value })} />
          </div>
          <div>
            <Label>Tasa usada (VES/USD)</Label>
            <Input type="number" step="0.01" value={f.tasa_usada} onChange={(e) => setF({ ...f, tasa_usada: e.target.value })} />
          </div>
          <div>
            <Label>Fecha reportada</Label>
            <Input type="date" value={f.fecha_reportada} onChange={(e) => setF({ ...f, fecha_reportada: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Referencia / correo / hash</Label>
            <Input value={f.referencia_privada} onChange={(e) => setF({ ...f, referencia_privada: e.target.value })} />
            {f.referencia_privada && (
              <p className="text-xs text-muted-foreground mt-1">Se mostrará en público como: <code>{maskRef(f.metodo, f.referencia_privada)}</code></p>
            )}
          </div>
          <div className="col-span-2">
            <Label>Nota interna</Label>
            <Textarea value={f.nota_interna} onChange={(e) => setF({ ...f, nota_interna: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AporteGestionDialog({ aporte, onClose }: { aporte: Aporte; onClose: () => void }) {
  const [tasa, setTasa] = useState(aporte.tasa_usada?.toString() ?? "");
  const [equiv, setEquiv] = useState(aporte.equivalente_usd?.toString() ?? "");
  const [notaPub, setNotaPub] = useState(aporte.nota_publica ?? "");
  const [notaInt, setNotaInt] = useState(aporte.nota_interna ?? "");
  const [saving, setSaving] = useState(false);
  const [bcv, setBcv] = useState<number | null>(null);

  useEffect(() => {
    if (aporte.moneda_original !== "VES") return;
    supabase.rpc("fondo_get_active_bcv_rate").then(({ data }) => {
      const r = Array.isArray(data) && data.length > 0 ? Number(data[0].rate) : null;
      setBcv(r);
      if (r && !tasa) setTasa(r.toString());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aporte.id]);

  const confirmar = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("fondo_confirmar_aporte", {
      p_id: aporte.id,
      p_tasa: tasa ? parseFloat(tasa) : null,
      p_equivalente_usd: equiv ? parseFloat(equiv) : null,
      p_nota_publica: notaPub || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Aporte confirmado");
    onClose();
  };

  const cambiar = async (estado: AporteEstado) => {
    setSaving(true);
    const { error } = await supabase.rpc("fondo_cambiar_estado_aporte", {
      p_id: aporte.id,
      p_nuevo_estado: estado,
      p_nota_interna: notaInt || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Marcado: ${estado}`);
    onClose();
  };

  const saveNotes = async () => {
    setSaving(true);
    const { error } = await supabase.from("fondo_aportes").update({
      nota_publica: notaPub || null,
      nota_interna: notaInt || null,
    }).eq("id", aporte.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Notas guardadas");
    onClose();
  };

  const equivCalc = (() => {
    if (aporte.moneda_original !== "VES") return aporte.monto_original;
    const t = parseFloat(tasa);
    if (!t || t <= 0) return null;
    return aporte.monto_original / t;
  })();

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gestionar aporte</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Info label="Donante" value={aporte.es_anonimo ? "anónimo" : (aporte.nombre_donante ?? "—")} />
            <Info label="Estado" value={ESTADO_BADGE[aporte.estado].label} />
            <Info label="Método" value={aporte.metodo} />
            <Info label="Moneda" value={aporte.moneda_original} />
            <Info label="Monto" value={fmtMonto(aporte.monto_original, aporte.moneda_original)} />
            <Info label="Ref. privada" value={aporte.referencia_privada ?? "—"} />
          </div>
          {aporte.estado !== "confirmado" && (
            <div className="space-y-2 border-t pt-3">
              {aporte.moneda_original === "VES" && (
                <div className="text-xs text-muted-foreground">
                  {bcv ? (
                    <>Tasa BCV activa: <strong>Bs {bcv.toLocaleString("es-VE", { maximumFractionDigits: 4 })} / US$</strong> — aplicada por defecto.</>
                  ) : (
                    <>No hay tasa BCV activa. Ingresa una tasa manual o ejecuta "Forzar actualización BCV" en Configuración.</>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tasa VES/USD</Label>
                  <Input type="number" step="0.01" value={tasa} onChange={(e) => setTasa(e.target.value)} />
                </div>
                <div>
                  <Label>Equivalente USD</Label>
                  <Input type="number" step="0.01" value={equiv} onChange={(e) => setEquiv(e.target.value)} placeholder={equivCalc ? equivCalc.toFixed(2) : ""} />
                </div>
              </div>
            </div>
          )}
          <div>
            <Label>Nota pública</Label>
            <Textarea value={notaPub} onChange={(e) => setNotaPub(e.target.value)} />
          </div>
          <div>
            <Label>Nota interna</Label>
            <Textarea value={notaInt} onChange={(e) => setNotaInt(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={saveNotes} disabled={saving}>Guardar notas</Button>
          <Button variant="destructive" onClick={() => cambiar("rechazado")} disabled={saving}>
            <XCircle className="h-4 w-4 mr-2" /> Rechazar
          </Button>
          <Button variant="outline" onClick={() => cambiar("duplicado")} disabled={saving}>
            <Copy className="h-4 w-4 mr-2" /> Duplicado
          </Button>
          <Button variant="outline" onClick={() => cambiar("monto_incorrecto")} disabled={saving}>Monto incorrecto</Button>
          {aporte.estado !== "confirmado" && (
            <Button onClick={confirmar} disabled={saving}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar aporte
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

/* ---------------- CONCILIACIÓN ---------------- */
function ConciliacionTab() {
  const [aportes, setAportes] = useState<Aporte[]>([]);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [a, m] = await Promise.all([
      supabase.from("fondo_aportes").select("*").in("estado", ["por_verificar", "coincidencia_encontrada"]),
      supabase.from("fondo_movimientos_cargados").select("*").in("estado", ["sin_conciliar", "conciliado"]),
    ]);
    setAportes((a.data as any) ?? []);
    setMovs((m.data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const matches = useMemo(() => {
    return aportes.map((ap) => {
      const exact = movs.find(
        (m) =>
          m.metodo === ap.metodo &&
          m.moneda === ap.moneda_original &&
          Math.abs(Number(m.monto) - Number(ap.monto_original)) < 0.01 &&
          (m.referencia ?? "").trim() &&
          (ap.referencia_privada ?? "").includes((m.referencia ?? "").trim().slice(-4))
      );
      if (exact) return { ap, mov: exact, tipo: "exacta" as const };
      const posible = movs.find(
        (m) =>
          m.metodo === ap.metodo &&
          m.moneda === ap.moneda_original &&
          Math.abs(Number(m.monto) - Number(ap.monto_original)) < 0.01
      );
      if (posible) return { ap, mov: posible, tipo: "posible" as const };
      const distinto = movs.find(
        (m) =>
          m.metodo === ap.metodo &&
          m.moneda === ap.moneda_original &&
          (m.referencia ?? "").trim() &&
          (ap.referencia_privada ?? "").includes((m.referencia ?? "").trim().slice(-4))
      );
      if (distinto) return { ap, mov: distinto, tipo: "monto_diferente" as const };
      return { ap, mov: null, tipo: "sin_coincidencia" as const };
    });
  }, [aportes, movs]);

  const marcarCoincidencia = async (ap: Aporte) => {
    const { error } = await supabase
      .from("fondo_aportes")
      .update({ estado: "coincidencia_encontrada" })
      .eq("id", ap.id);
    if (error) return toast.error(error.message);
    toast.success("Marcado como coincidencia. Confirma en pestaña Aportes.");
    load();
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Compara aportes pendientes contra movimientos cargados manualmente.
        </p>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" /> Refrescar</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aporte reportado</TableHead>
                  <TableHead>Método/Monto</TableHead>
                  <TableHead>Movimiento</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Cargando…</TableCell></TableRow>}
                {!loading && matches.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Sin aportes pendientes.</TableCell></TableRow>
                )}
                {matches.map(({ ap, mov, tipo }) => (
                  <TableRow key={ap.id}>
                    <TableCell className="text-sm">
                      {ap.nombre_donante ?? "—"}<br />
                      <span className="text-xs text-muted-foreground">{fmtDate(ap.created_at)}</span>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {ap.metodo}<br />{fmtMonto(ap.monto_original, ap.moneda_original)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {mov ? <>
                        {mov.fecha} · {mov.referencia ?? "—"}<br />
                        <span className="text-xs">{fmtMonto(mov.monto, mov.moneda)}</span>
                      </> : <em className="text-xs text-muted-foreground">sin coincidencia</em>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tipo === "exacta" ? "default" : tipo === "posible" ? "secondary" : "outline"}>
                        {tipo === "exacta" ? "Exacta" : tipo === "posible" ? "Posible" : tipo === "monto_diferente" ? "Monto distinto" : "Sin match"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {tipo === "exacta" && (
                        <Button size="sm" onClick={() => marcarCoincidencia(ap)}>Marcar coincidencia</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- CARGA MASIVA ---------------- */
function CargaMasivaTab() {
  const [text, setText] = useState("fecha,metodo,referencia,monto,moneda,origen,nota\n");
  const [preview, setPreview] = useState<any[]>([]);
  const [movs, setMovs] = useState<Movimiento[]>([]);

  const loadMovs = async () => {
    const { data } = await supabase.from("fondo_movimientos_cargados").select("*").order("created_at", { ascending: false }).limit(200);
    setMovs((data as any) ?? []);
  };
  useEffect(() => { loadMovs(); }, []);

  const parsear = () => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return setPreview([]);
    const head = lines[0].split(",").map((s) => s.trim().toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const cells = line.split(",").map((s) => s.trim());
      const obj: any = {};
      head.forEach((h, i) => (obj[h] = cells[i] ?? ""));
      return obj;
    });
    setPreview(rows);
  };

  const subir = async () => {
    if (preview.length === 0) return toast.error("Nada para subir");
    const batch = crypto.randomUUID();
    const valid = preview
      .filter((r) => r.fecha && r.metodo && r.monto && r.moneda)
      .map((r) => ({
        fecha: r.fecha,
        metodo: r.metodo as Metodo,
        referencia: r.referencia || null,
        monto: parseFloat(r.monto),
        moneda: r.moneda as Moneda,
        origen: r.origen || null,
        nota: r.nota || null,
        batch_id: batch,
        raw_data: r,
      }));
    if (valid.length === 0) return toast.error("Sin filas válidas");
    const { error } = await supabase.from("fondo_movimientos_cargados").insert(valid);
    if (error) return toast.error(error.message);
    toast.success(`${valid.length} movimiento(s) cargados`);
    setPreview([]);
    setText("fecha,metodo,referencia,monto,moneda,origen,nota\n");
    loadMovs();
  };

  const marcar = async (id: string, estado: "duplicado" | "ignorado") => {
    const { error } = await supabase.from("fondo_movimientos_cargados").update({ estado }).eq("id", id);
    if (error) return toast.error(error.message);
    loadMovs();
  };

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Upload className="h-4 w-4" /> Cargar movimientos (CSV)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Encabezado esperado: <code>fecha,metodo,referencia,monto,moneda,origen,nota</code> · Métodos: pago_movil/zelle/efectivo_sublime/binance · Monedas: VES/USD/USDT.
          </p>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className="font-mono text-xs" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={parsear}>Previsualizar</Button>
            <Button onClick={subir} disabled={preview.length === 0}>Subir {preview.length || ""}</Button>
          </div>
          {preview.length > 0 && (
            <pre className="text-xs bg-muted p-2 rounded max-h-40 overflow-auto">{JSON.stringify(preview, null, 2)}</pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Movimientos cargados</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Ref.</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movs.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Sin movimientos.</TableCell></TableRow>
                )}
                {movs.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm">{m.fecha}</TableCell>
                    <TableCell className="text-sm">{m.metodo}</TableCell>
                    <TableCell className="text-sm font-mono text-xs">{m.referencia ?? "—"}</TableCell>
                    <TableCell className="text-sm tabular-nums">{fmtMonto(m.monto, m.moneda)}</TableCell>
                    <TableCell><Badge variant="outline">{m.estado}</Badge></TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => marcar(m.id, "duplicado")}>Duplicado</Button>
                      <Button size="sm" variant="outline" onClick={() => marcar(m.id, "ignorado")}>Ignorar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- EGRESOS ---------------- */
function EgresosTab() {
  const [rows, setRows] = useState<Egreso[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("fondo_egresos").select("*").order("created_at", { ascending: false });
    setRows((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const cambiarEstado = async (id: string, estado: EgresoEstado, extra: any = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    const upd: any = { estado, ...extra };
    if (estado === "aprobado") upd.aprobado_por = user?.id;
    if (estado === "ejecutado") upd.fecha_ejecucion = new Date().toISOString();
    const before = rows.find((r) => r.id === id);
    const { error } = await supabase.from("fondo_egresos").update(upd).eq("id", id);
    if (error) return toast.error(error.message);
    await supabase.from("fondo_audit_log").insert({
      user_id: user?.id, user_email: user?.email,
      accion: `egreso_${estado}`, tabla: "fondo_egresos", record_id: id,
      valor_anterior: before as any, valor_nuevo: { ...before, ...upd } as any,
    });
    toast.success(`Egreso ${estado}`);
    load();
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" /> Refrescar</Button>
        <Button size="sm" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-2" /> Registrar egreso</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Beneficiario</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>USD</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Cargando…</TableCell></TableRow>}
                {!loading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Sin egresos.</TableCell></TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{r.fecha_gasto ?? "—"}</TableCell>
                    <TableCell className="text-sm">{r.categoria}</TableCell>
                    <TableCell className="text-sm">{r.descripcion ?? "—"}</TableCell>
                    <TableCell className="text-sm">{r.proveedor ?? "—"}</TableCell>
                    <TableCell className="text-sm tabular-nums">{fmtMonto(r.monto_original, r.moneda_original)}</TableCell>
                    <TableCell className="text-sm tabular-nums">{fmtUSD(r.equivalente_usd)}</TableCell>
                    <TableCell>
                      <Badge variant={r.estado === "ejecutado" ? "default" : r.estado === "anulado" ? "destructive" : "secondary"}>
                        {r.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {r.estado === "pendiente" && (
                        <Button size="sm" variant="outline" onClick={() => cambiarEstado(r.id, "aprobado")}>Aprobar</Button>
                      )}
                      {r.estado === "aprobado" && (
                        <Button size="sm" onClick={() => cambiarEstado(r.id, "ejecutado")}>Marcar ejecutado</Button>
                      )}
                      {r.estado !== "anulado" && r.estado !== "ejecutado" && (
                        <Button size="sm" variant="destructive" onClick={() => cambiarEstado(r.id, "anulado")}>Anular</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {openNew && <EgresoFormDialog onClose={() => { setOpenNew(false); load(); }} />}
    </div>
  );
}

function EgresoFormDialog({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({
    fecha_gasto: new Date().toISOString().slice(0, 10),
    categoria: "comida" as EgresoCategoria,
    descripcion: "",
    proveedor: "",
    moneda_original: "USD" as Moneda,
    monto_original: "",
    tasa_usada: "",
    comprobante_publico_url: "",
    nota_publica: "",
    nota_interna: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const monto = parseFloat(f.monto_original);
    if (!monto || monto <= 0) return toast.error("Monto inválido");
    setSaving(true);
    const tasa = f.tasa_usada ? parseFloat(f.tasa_usada) : null;
    const equiv =
      f.moneda_original === "USD" || f.moneda_original === "USDT"
        ? monto
        : tasa
          ? monto / tasa
          : null;
    const { error } = await supabase.from("fondo_egresos").insert({
      fecha_gasto: f.fecha_gasto,
      categoria: f.categoria,
      descripcion: f.descripcion || null,
      proveedor: f.proveedor || null,
      moneda_original: f.moneda_original,
      monto_original: monto,
      tasa_usada: tasa,
      equivalente_usd: equiv,
      comprobante_publico_url: f.comprobante_publico_url || null,
      nota_publica: f.nota_publica || null,
      nota_interna: f.nota_interna || null,
      estado: "pendiente",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Egreso registrado");
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Registrar egreso</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={f.fecha_gasto} onChange={(e) => setF({ ...f, fecha_gasto: e.target.value })} />
          </div>
          <div>
            <Label>Categoría</Label>
            <Select value={f.categoria} onValueChange={(v) => setF({ ...f, categoria: v as EgresoCategoria })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["comida","agua","medicina","transporte","logistica","refugio","otro"].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Descripción</Label>
            <Input value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Beneficiario / Proveedor</Label>
            <Input value={f.proveedor} onChange={(e) => setF({ ...f, proveedor: e.target.value })} />
          </div>
          <div>
            <Label>Moneda</Label>
            <Select value={f.moneda_original} onValueChange={(v) => setF({ ...f, moneda_original: v as Moneda })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="VES">VES</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="USDT">USDT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Monto</Label>
            <Input type="number" step="0.01" value={f.monto_original} onChange={(e) => setF({ ...f, monto_original: e.target.value })} />
          </div>
          <div>
            <Label>Tasa</Label>
            <Input type="number" step="0.01" value={f.tasa_usada} onChange={(e) => setF({ ...f, tasa_usada: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Comprobante público (URL)</Label>
            <Input value={f.comprobante_publico_url} onChange={(e) => setF({ ...f, comprobante_publico_url: e.target.value })} placeholder="https://…" />
          </div>
          <div className="col-span-2">
            <Label>Nota pública</Label>
            <Textarea value={f.nota_publica} onChange={(e) => setF({ ...f, nota_publica: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Nota interna</Label>
            <Textarea value={f.nota_interna} onChange={(e) => setF({ ...f, nota_interna: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- AUDITORÍA ---------------- */
function AuditoriaTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  useEffect(() => {
    supabase.from("fondo_audit_log").select("*").order("created_at", { ascending: false }).limit(300).then(({ data }) => setRows((data as any) ?? []));
  }, []);
  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" /> Bitácora</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Tabla</TableHead>
                <TableHead>ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Sin registros.</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{fmtDate(r.created_at)}</TableCell>
                  <TableCell className="text-xs">{r.user_email ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.accion}</TableCell>
                  <TableCell className="text-xs">{r.tabla}</TableCell>
                  <TableCell className="text-xs font-mono">{r.record_id ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- CONFIGURACIÓN ---------------- */
function ConfiguracionTab() {
  const [c, setC] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    supabase.from("fondo_configuracion").select("*").single().then(({ data }) => setC(data));
  }, []);
  if (!c) return <p className="text-sm text-muted-foreground mt-4">Cargando…</p>;
  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("fondo_configuracion").update({
      titulo_publico: c.titulo_publico,
      subtitulo_publico: c.subtitulo_publico,
      disclaimer: c.disclaimer,
      tasa_sugerida: c.tasa_sugerida ? parseFloat(c.tasa_sugerida) : null,
    }).eq("id", true);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configuración guardada");
  };

  const guardarTasa = async () => {
    const t = c.tasa_ves_usd ? parseFloat(c.tasa_ves_usd) : null;
    if (!t || t <= 0) return toast.error("Tasa inválida");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("fondo_configuracion").update({
      tasa_ves_usd: t,
      tasa_fecha: c.tasa_fecha || new Date().toISOString().slice(0, 10),
      tasa_fuente: c.tasa_fuente || null,
      tasa_actualizada_at: new Date().toISOString(),
      tasa_actualizada_por: user?.id ?? null,
    }).eq("id", true);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Tasa del día actualizada");
    supabase.from("fondo_configuracion").select("*").single().then(({ data }) => setC(data));
  };

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><SettingsIcon className="h-4 w-4" /> Página pública</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input value={c.titulo_publico ?? ""} onChange={(e) => setC({ ...c, titulo_publico: e.target.value })} />
          </div>
          <div>
            <Label>Subtítulo</Label>
            <Input value={c.subtitulo_publico ?? ""} onChange={(e) => setC({ ...c, subtitulo_publico: e.target.value })} />
          </div>
          <div>
            <Label>Disclaimer</Label>
            <Textarea rows={5} value={c.disclaimer ?? ""} onChange={(e) => setC({ ...c, disclaimer: e.target.value })} />
          </div>
          <div>
            <Label>Tasa sugerida — uso histórico (VES/USD)</Label>
            <Input type="number" step="0.01" value={c.tasa_sugerida ?? ""} onChange={(e) => setC({ ...c, tasa_sugerida: e.target.value })} />
          </div>
          <Button onClick={save} disabled={saving}>Guardar</Button>
        </CardContent>
      </Card>

      <BcvAutoRateCard onRateApplied={() => {
        supabase.from("fondo_configuracion").select("*").single().then(({ data }) => setC(data));
      }} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><SettingsIcon className="h-4 w-4" /> Tasa manual (fallback)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Úsala solo si DolarApi falla. Solo aplica para aportes en VES / Pago Móvil. Zelle (USD), efectivo Sublime (USD) y Binance (USDT) no usan tasa.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Tasa VES → USD</Label>
              <Input
                type="number" step="0.01"
                placeholder="ej: 40.50"
                value={c.tasa_ves_usd ?? ""}
                onChange={(e) => setC({ ...c, tasa_ves_usd: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground mt-1">1 USD = X Bs</p>
            </div>
            <div>
              <Label>Fecha de la tasa</Label>
              <Input type="date" value={c.tasa_fecha ?? ""} onChange={(e) => setC({ ...c, tasa_fecha: e.target.value })} />
            </div>
            <div>
              <Label>Fuente / nota</Label>
              <Input
                placeholder="BCV / Monitor / nota interna"
                value={c.tasa_fuente ?? ""}
                onChange={(e) => setC({ ...c, tasa_fuente: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Última actualización de la tasa:{" "}
            {c.tasa_actualizada_at ? new Date(c.tasa_actualizada_at).toLocaleString("es-VE") : "sin actualizaciones todavía"}
          </p>
          <Button onClick={guardarTasa} disabled={saving}>Guardar tasa manual</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function BcvAutoRateCard({ onRateApplied }: { onRateApplied: () => void }) {
  const [active, setActive] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.rpc("fondo_get_active_bcv_rate");
    setActive(Array.isArray(data) && data.length > 0 ? data[0] : null);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const forzar = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-bcv-rate", { body: {} });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Error desconocido");
      toast.success(`Tasa BCV actualizada: Bs ${Number(data.rate).toLocaleString("es-VE", { maximumFractionDigits: 4 })} / US$`);
      await load();
      onRateApplied();
    } catch (e: any) {
      toast.error(`No se pudo actualizar: ${e.message ?? e}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Tasa BCV automática (DolarApi)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Se actualiza automáticamente de lunes a viernes a las 12:30 (hora Venezuela) desde <code>ve.dolarapi.com/v1/dolares/oficial</code>.
          También puedes forzar la actualización manualmente.
        </p>
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          {loading ? (
            <span className="text-muted-foreground">Cargando…</span>
          ) : active ? (
            <div className="space-y-1">
              <div className="font-mono text-base">
                Bs {Number(active.rate).toLocaleString("es-VE", { maximumFractionDigits: 4 })} / US$
              </div>
              <div className="text-xs text-muted-foreground">
                Fuente: {active.source} · Tomada: {new Date(active.fetched_at).toLocaleString("es-VE")}
                {active.provider_updated_at ? ` · BCV: ${new Date(active.provider_updated_at).toLocaleString("es-VE")}` : ""}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">Tasa BCV no configurada todavía</span>
          )}
        </div>
        <Button onClick={forzar} disabled={running}>
          <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
          Forzar actualización BCV
        </Button>
      </CardContent>
    </Card>
  );
}

