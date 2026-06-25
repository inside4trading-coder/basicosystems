import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Totales = {
  ves_confirmado: number; ves_por_verificar: number; ves_egresos: number; ves_saldo: number;
  usd_confirmado: number; usd_por_verificar: number; usd_egresos: number; usd_saldo: number;
  usdt_confirmado: number; usdt_por_verificar: number; usdt_egresos: number; usdt_saldo: number;
  tasa_ves_usd: number | null;
  tasa_fecha: string | null;
  tasa_fuente: string | null;
  tasa_actualizada_at: string | null;
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

const nfmt = (n: number | null | undefined, dec = 2) =>
  n == null ? "—" : Number(n).toLocaleString("es-VE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtBs = (n: number | null | undefined) => (n == null ? "—" : `Bs ${nfmt(n)}`);
const fmtUSD = (n: number | null | undefined) => (n == null ? "—" : `US$ ${nfmt(n)}`);
const fmtUSDT = (n: number | null | undefined) => (n == null ? "—" : `${nfmt(n)} USDT`);
const fmtMonto = (n: number | null | undefined, m: string) => {
  if (n == null) return "—";
  if (m === "VES") return fmtBs(n);
  if (m === "USD") return fmtUSD(n);
  if (m === "USDT") return fmtUSDT(n);
  return `${nfmt(n)} ${m}`;
};
const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("es-VE") : null);
const fmtDateOnly = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("es-VE") : null);

export default function FuerzaVenezuela() {
  const [t, setT] = useState<Totales | null>(null);
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
      if (tRes.data) setT(tRes.data as any);
      if (aRes.data) {
        const rows = aRes.data as AporteRow[];
        setConfirmados(rows.filter((r) => r.estado === "confirmado"));
        setPorVerificar(rows.filter((r) => r.estado !== "confirmado"));
      }
      if (eRes.data) setEgresos(eRes.data as any);
      if (cRes.data) setConfig(cRes.data as any);
    })();
  }, []);

  const tasa = t?.tasa_ves_usd && t.tasa_ves_usd > 0 ? Number(t.tasa_ves_usd) : null;
  const vesSaldoUsd = tasa && t?.ves_saldo != null ? t.ves_saldo / tasa : null;
  const totalRefUsd =
    (vesSaldoUsd ?? 0) + Number(t?.usd_saldo ?? 0) + Number(t?.usdt_saldo ?? 0);
  const ultimaAct = fmtDate(t?.ultima_actualizacion ?? null);

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

        {/* Bloque 1 — Pago Móvil / Bs */}
        <BlockCard title="pago móvil / bolívares" subtitle="aportes recibidos en Bs por Pago Móvil">
          <KPIGrid>
            <KPI label="Total confirmado" value={fmtBs(t?.ves_confirmado)} />
            <KPI label="Por verificar" value={fmtBs(t?.ves_por_verificar)} subtle />
            <KPI label="Gastos ejecutados" value={fmtBs(t?.ves_egresos)} />
            <KPI label="Saldo disponible" value={fmtBs(t?.ves_saldo)} highlight />
          </KPIGrid>
          <TasaNote
            tasa={tasa}
            fecha={t?.tasa_fecha ?? null}
            fuente={t?.tasa_fuente ?? null}
            equiv={vesSaldoUsd}
          />
        </BlockCard>

        {/* Bloque 2 — Zelle + Efectivo Sublime / USD */}
        <BlockCard title="zelle + efectivo sublime / usd" subtitle="aportes en US$ por Zelle o efectivo recibido en Sublime">
          <KPIGrid>
            <KPI label="Total confirmado" value={fmtUSD(t?.usd_confirmado)} />
            <KPI label="Por verificar" value={fmtUSD(t?.usd_por_verificar)} subtle />
            <KPI label="Gastos ejecutados" value={fmtUSD(t?.usd_egresos)} />
            <KPI label="Saldo disponible" value={fmtUSD(t?.usd_saldo)} highlight />
          </KPIGrid>
        </BlockCard>

        {/* Bloque 3 — Binance / USDT */}
        <BlockCard title="binance / usdt" subtitle="aportes en USDT recibidos por Binance">
          <KPIGrid>
            <KPI label="Total confirmado" value={fmtUSDT(t?.usdt_confirmado)} />
            <KPI label="Por verificar" value={fmtUSDT(t?.usdt_por_verificar)} subtle />
            <KPI label="Gastos ejecutados" value={fmtUSDT(t?.usdt_egresos)} />
            <KPI label="Saldo disponible" value={fmtUSDT(t?.usdt_saldo)} highlight />
          </KPIGrid>
        </BlockCard>

        {/* Bloque resumen general */}
        <BlockCard title="resumen general" subtitle="visión consolidada — cifras referenciales, no representan un único saldo bancario">
          <KPIGrid cols={5}>
            <KPI label="Saldo Bs" value={fmtBs(t?.ves_saldo)} />
            <KPI label="Equiv. USD de Bs" value={fmtUSD(vesSaldoUsd)} subtle />
            <KPI label="Saldo USD" value={fmtUSD(t?.usd_saldo)} />
            <KPI label="Saldo USDT" value={fmtUSDT(t?.usdt_saldo)} />
            <KPI
              label="Total aprox. en USD"
              value={fmtUSD(totalRefUsd)}
              highlight
            />
          </KPIGrid>
          <p className="text-xs text-neutral-500 mt-3 leading-relaxed">
            <strong>Cifra referencial.</strong> Calculada como{" "}
            <code className="text-[11px]">equiv USD de Bs + saldo USD + saldo USDT</code>. Cada moneda se gasta
            por separado; no hay conversión automática entre saldos.
            {tasa ? (
              <> Tasa usada: 1 USD = {nfmt(tasa)} Bs{t?.tasa_fecha ? ` · ${fmtDateOnly(t.tasa_fecha)}` : ""}.</>
            ) : (
              <> Aún no se ha configurado la tasa del día; el equivalente USD de Bs no se puede calcular.</>
            )}
          </p>
        </BlockCard>

        <p className="text-xs text-neutral-500 mb-10">
          {ultimaAct
            ? <>Última actualización: {ultimaAct} · {t?.aportes_confirmados_count ?? 0} aportes confirmados · {t?.aportes_pendientes_count ?? 0} pendientes</>
            : <>sin actualizaciones todavía</>}
        </p>

        <Section title="ingresos confirmados">
          {confirmados.length === 0 ? (
            <Empty msg="Aún no hay aportes confirmados." />
          ) : (
            <DataTable
              cols={["Fecha", "Donante", "Método", "Monto", "Ref.", "Estado"]}
              rows={confirmados.map((r) => [
                fmtDate(r.fecha_confirmada) ?? "—",
                r.donante_publico,
                r.metodo,
                fmtMonto(r.monto_original, r.moneda_original),
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
              cols={["Fecha", "Categoría", "Descripción", "Beneficiario", "Monto", "Comprobante"]}
              rows={egresos.map((r) => [
                fmtDate(r.fecha_ejecucion ?? r.fecha_gasto) ?? "—",
                r.categoria,
                r.descripcion ?? "—",
                r.proveedor ?? "—",
                fmtMonto(r.monto_original, r.moneda_original),
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

function BlockCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 border border-black/15 rounded-lg p-4 md:p-6">
      <div className="mb-4">
        <h2 className="text-lg md:text-xl font-semibold lowercase">{title}</h2>
        {subtitle && <p className="text-xs md:text-sm text-neutral-500 lowercase mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function KPIGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 4 | 5 }) {
  const c = cols === 5 ? "md:grid-cols-5" : "md:grid-cols-4";
  return <div className={`grid grid-cols-2 ${c} gap-3`}>{children}</div>;
}

function KPI({ label, value, highlight, subtle }: { label: string; value: string; highlight?: boolean; subtle?: boolean }) {
  return (
    <Card className={`border-black/20 ${highlight ? "bg-black text-white" : subtle ? "bg-neutral-50" : ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-[10px] md:text-xs font-medium uppercase tracking-wider ${highlight ? "text-white/70" : "text-neutral-500"}`}>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-lg md:text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function TasaNote({
  tasa, fecha, fuente, equiv,
}: { tasa: number | null; fecha: string | null; fuente: string | null; equiv: number | null }) {
  if (!tasa) {
    return (
      <p className="text-xs text-neutral-500 mt-3">
        Tasa del día no configurada. El equivalente en USD no se puede calcular todavía.
      </p>
    );
  }
  return (
    <div className="text-xs text-neutral-600 mt-3 space-y-1">
      <div>Equivalente USD del saldo: <strong>{fmtUSD(equiv)}</strong> (referencial)</div>
      <div className="text-neutral-500">
        Tasa usada: 1 USD = {nfmt(tasa)} Bs
        {fecha ? ` · ${fmtDateOnly(fecha)}` : ""}
        {fuente ? ` · ${fuente}` : ""}
      </div>
    </div>
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
