import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Totales = {
  total_confirmado_usd: number;
  total_por_verificar_aprox: number;
  total_egresos_usd: number;
  saldo_disponible_usd: number;
  aportes_confirmados_count: number;
  aportes_pendientes_count: number;
  ultima_actualizacion: string | null;
};

type AporteRow = {
  id: string;
  fecha_reportada: string | null;
  fecha_confirmada: string | null;
  donante_publico: string;
  metodo: string;
  moneda_original: string;
  monto_original: number;
  equivalente_usd: number | null;
  referencia_publica_enmascarada: string | null;
  estado: string;
  nota_publica: string | null;
};

type EgresoRow = {
  id: string;
  fecha_gasto: string | null;
  fecha_ejecucion: string | null;
  categoria: string;
  descripcion: string | null;
  proveedor: string | null;
  moneda_original: string;
  monto_original: number;
  equivalente_usd: number | null;
  comprobante_publico_url: string | null;
  estado: string;
  nota_publica: string | null;
};

type Config = {
  titulo_publico: string;
  subtitulo_publico: string;
  disclaimer: string;
};

const fmtUSD = (n: number | null | undefined) =>
  n == null ? "—" : `US$ ${Number(n).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtMonto = (n: number | null | undefined, m: string) =>
  n == null ? "—" : `${Number(n).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${m}`;
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("es-VE") : "—");

export default function FuerzaVenezuela() {
  const [totales, setTotales] = useState<Totales | null>(null);
  const [confirmados, setConfirmados] = useState<AporteRow[]>([]);
  const [porVerificar, setPorVerificar] = useState<AporteRow[]>([]);
  const [egresos, setEgresos] = useState<EgresoRow[]>([]);
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    document.title = "fuerza venezuela — [BASICO]";
    (async () => {
      const [tRes, aRes, eRes, cRes] = await Promise.all([
        supabase.from("fondo_public_totales").select("*").single(),
        supabase.from("fondo_public_aportes").select("*").order("fecha_confirmada", { ascending: false }).limit(500),
        supabase.from("fondo_public_egresos").select("*").order("fecha_ejecucion", { ascending: false }).limit(500),
        supabase.from("fondo_configuracion").select("titulo_publico, subtitulo_publico, disclaimer").single(),
      ]);
      if (tRes.data) setTotales(tRes.data as any);
      if (aRes.data) {
        const rows = aRes.data as AporteRow[];
        setConfirmados(rows.filter((r) => r.estado === "confirmado"));
        setPorVerificar(rows.filter((r) => r.estado !== "confirmado"));
      }
      if (eRes.data) setEgresos(eRes.data as any);
      if (cRes.data) setConfig(cRes.data as any);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-16">
        <header className="mb-10">
          <h1 className="text-4xl md:text-6xl font-bold lowercase tracking-tight">
            {config?.titulo_publico ?? "fuerza venezuela"}
          </h1>
          <p className="mt-2 text-base md:text-lg text-neutral-600 lowercase">
            {config?.subtitulo_publico ?? "fondo transparente de ayuda por [basico]"}
          </p>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
          <KPI label="Total confirmado" value={fmtUSD(totales?.total_confirmado_usd ?? 0)} />
          <KPI label="Por verificar" value={fmtUSD(totales?.total_por_verificar_aprox ?? 0)} subtle />
          <KPI label="Gastos ejecutados" value={fmtUSD(totales?.total_egresos_usd ?? 0)} />
          <KPI label="Saldo disponible" value={fmtUSD(totales?.saldo_disponible_usd ?? 0)} highlight />
        </section>

        <p className="text-xs text-neutral-500 mb-10">
          Última actualización: {fmtDate(totales?.ultima_actualizacion ?? null)} · {totales?.aportes_confirmados_count ?? 0} aportes confirmados ·{" "}
          {totales?.aportes_pendientes_count ?? 0} pendientes
        </p>

        <Section title="ingresos confirmados">
          {confirmados.length === 0 ? (
            <Empty msg="Aún no hay aportes confirmados." />
          ) : (
            <DataTable
              cols={["Fecha", "Donante", "Método", "Monto", "USD", "Ref.", "Estado"]}
              rows={confirmados.map((r) => [
                fmtDate(r.fecha_confirmada),
                r.donante_publico,
                r.metodo,
                fmtMonto(r.monto_original, r.moneda_original),
                fmtUSD(r.equivalente_usd),
                r.referencia_publica_enmascarada ?? "—",
                <Badge key="b" variant="outline" className="border-black text-black">confirmado</Badge>,
              ])}
            />
          )}
        </Section>

        <Section title="aportes por verificar">
          {porVerificar.length === 0 ? (
            <Empty msg="Sin aportes pendientes." />
          ) : (
            <DataTable
              cols={["Reportado", "Método", "Monto", "Estado"]}
              rows={porVerificar.map((r) => [
                r.fecha_reportada ?? "—",
                r.metodo,
                fmtMonto(r.monto_original, r.moneda_original),
                <Badge key="b" variant="secondary">{r.estado}</Badge>,
              ])}
            />
          )}
        </Section>

        <Section title="egresos ejecutados">
          {egresos.length === 0 ? (
            <Empty msg="Aún no se han ejecutado gastos." />
          ) : (
            <DataTable
              cols={["Fecha", "Categoría", "Descripción", "Beneficiario", "Monto", "USD", "Comprobante"]}
              rows={egresos.map((r) => [
                fmtDate(r.fecha_ejecucion ?? r.fecha_gasto),
                r.categoria,
                r.descripcion ?? "—",
                r.proveedor ?? "—",
                fmtMonto(r.monto_original, r.moneda_original),
                fmtUSD(r.equivalente_usd),
                r.comprobante_publico_url ? (
                  <a key="l" href={r.comprobante_publico_url} target="_blank" rel="noreferrer" className="underline">
                    ver
                  </a>
                ) : (
                  "—"
                ),
              ])}
            />
          )}
        </Section>

        <footer className="mt-16 border-t border-black/20 pt-6 text-xs text-neutral-600 leading-relaxed">
          {config?.disclaimer ??
            "[BASICO] publica este registro para mostrar de forma transparente los aportes recibidos y los gastos ejecutados. Los aportes se verifican manualmente antes de sumarse al total confirmado. Los datos sensibles serán protegidos. Este fondo no garantiza deducción fiscal."}
        </footer>
      </div>
    </div>
  );
}

function KPI({ label, value, highlight, subtle }: { label: string; value: string; highlight?: boolean; subtle?: boolean }) {
  return (
    <Card className={`border-black/20 ${highlight ? "bg-black text-white" : subtle ? "bg-neutral-50" : ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-xs font-medium uppercase tracking-wider ${highlight ? "text-white/70" : "text-neutral-500"}`}>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xl md:text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg md:text-xl font-semibold lowercase mb-3 border-b border-black/20 pb-1">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-sm text-neutral-500 py-6">{msg}</p>;
}

function DataTable({ cols, rows }: { cols: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto border border-black/10 rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            {cols.map((c) => (
              <TableHead key={c} className="text-xs uppercase tracking-wider">{c}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {r.map((cell, j) => (
                <TableCell key={j} className="text-sm">{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
