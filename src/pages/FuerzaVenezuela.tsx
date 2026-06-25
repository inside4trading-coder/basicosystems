import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  n == null || Number.isNaN(n) ? "—" : Number(n).toLocaleString("es-VE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtBs = (n: number | null | undefined) => (n == null ? "—" : `Bs ${nfmt(n)}`);
const fmtUSD = (n: number | null | undefined) => (n == null ? "—" : `US$ ${nfmt(n)}`);
const fmtUSDT = (n: number | null | undefined) => (n == null ? "—" : `${nfmt(n)} USDT`);
const fmtApproxUSD = (n: number | null | undefined) => (n == null ? "—" : `~ US$ ${nfmt(n)}`);
const fmtMonto = (n: number | null | undefined, m: string) => {
  if (n == null) return "—";
  if (m === "VES") return fmtBs(n);
  if (m === "USD") return fmtUSD(n);
  if (m === "USDT") return fmtUSDT(n);
  return `${nfmt(n)} ${m}`;
};
const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("es-VE") : null);
const fmtDateOnly = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("es-VE") : null);
const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};

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

  const vesToUsd = (ves: number | null | undefined) =>
    tasa && ves != null ? ves / tasa : null;

  const disponibleTotalUsd =
    (vesToUsd(t?.ves_saldo) ?? 0) + Number(t?.usd_saldo ?? 0) + Number(t?.usdt_saldo ?? 0);
  const ingresadoTotalUsd =
    (vesToUsd(t?.ves_confirmado) ?? 0) + Number(t?.usd_confirmado ?? 0) + Number(t?.usdt_confirmado ?? 0);
  const gastadoTotalUsd =
    (vesToUsd(t?.ves_egresos) ?? 0) + Number(t?.usd_egresos ?? 0) + Number(t?.usdt_egresos ?? 0);

  const ultimaAct = fmtDate(t?.ultima_actualizacion ?? null);
  const hasAnyVes =
    (t?.ves_saldo ?? 0) !== 0 ||
    (t?.ves_confirmado ?? 0) !== 0 ||
    (t?.ves_egresos ?? 0) !== 0 ||
    (t?.ves_por_verificar ?? 0) !== 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
        {/* Hero */}
        <header className="mb-10 md:mb-16 animate-fade-in">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            fondo transparente de ayuda
          </p>
          <h1 className="text-5xl md:text-8xl font-black lowercase tracking-tight text-foreground">
            {config?.titulo_publico ?? "fuerza venezuela"}
          </h1>
          <p className="mt-5 text-lg md:text-2xl font-medium lowercase text-muted-foreground max-w-3xl leading-relaxed">
            somos [BASICO], una marca nacida en venezuela. hoy estamos usando nuestra comunidad para canalizar ayuda de forma transparente y verificable.
          </p>
          <div className="mt-8 md:mt-10">
            <p className="text-2xl md:text-4xl font-black lowercase text-foreground max-w-3xl">
              no nos creas. míralo.
            </p>
            <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
              cada aporte confirmado, cada gasto ejecutado y cada saldo disponible se publica aquí.
            </p>
          </div>
          <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button size="lg" className="w-full sm:w-auto" onClick={() => scrollTo("aportar")}>
              dona ahora
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" onClick={() => scrollTo("resumen")}>
              ver transparencia
            </Button>
          </div>
        </header>

        {/* Cómo aportar */}
        <section id="aportar" className="mb-12 md:mb-16 animate-fade-in" style={{ animationDelay: "0.05s" }}>
          <div className="mb-5">
            <h2 className="text-xl md:text-2xl font-black lowercase tracking-tight">cómo aportar</h2>
            <p className="text-sm text-muted-foreground lowercase mt-1">
              elige un canal, confirma tu aporte y lo publicamos aquí
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <AporteMethod title="pago móvil" currency="Bs" description="transferencia o pago móvil en bolívares." />
            <AporteMethod title="zelle" currency="US$" description="transferencia Zelle en dólares." />
            <AporteMethod title="efectivo sublime" currency="US$" description="entrega de efectivo en USD." />
            <AporteMethod title="binance" currency="USDT" description="transferencia de USDT por Binance Pay." />
          </div>
        </section>

        {/* Resumen principal — 3 cards grandes */}
        <section id="resumen" className="mb-12 md:mb-16 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <HeroCard
              label="disponible total aprox."
              value={fmtApproxUSD(disponibleTotalUsd)}
              variant="primary"
              description="suma aproximada en US$ de Bs + US$ + USDT disponibles"
            />
            <HeroCard
              label="ingresado confirmado"
              value={fmtApproxUSD(ingresadoTotalUsd)}
              variant="secondary"
              description="total aproximado de aportes ya confirmados"
            />
            <HeroCard
              label="gastado"
              value={fmtApproxUSD(gastadoTotalUsd)}
              variant="secondary"
              description="total aproximado de egresos ejecutados"
            />
          </div>

          <p className="mt-4 text-xs md:text-sm text-muted-foreground leading-relaxed">
            monto aproximado calculado con la tasa del día para bolívares. los saldos reales se mantienen separados por moneda.
            {!tasa && hasAnyVes && (
              <span className="block mt-1 text-status-error">
                aún no hay tasa del día configurada; el equivalente USD de bolívares no se puede calcular.
              </span>
            )}
            {tasa && (
              <span className="block mt-1">
                tasa usada: 1 USD = {nfmt(tasa)} Bs
                {t?.tasa_fecha ? ` · ${fmtDateOnly(t.tasa_fecha)}` : ""}
                {t?.tasa_fuente ? ` · ${t.tasa_fuente}` : ""}
              </span>
            )}
          </p>
        </section>

        {/* Detalle por moneda */}
        <section className="mb-12 md:mb-16 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <div className="mb-5">
            <h2 className="text-xl md:text-2xl font-black lowercase tracking-tight">detalle del fondo</h2>
            <p className="text-sm text-muted-foreground lowercase mt-1">
              transparencia por moneda — los saldos reales se mantienen independientes
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <DetailBlock
              title="pago móvil / bolívares"
              rows={[
                { label: "disponible en Bs", value: fmtBs(t?.ves_saldo) },
                { label: "equivalente USD aprox.", value: fmtApproxUSD(vesToUsd(t?.ves_saldo)), subtle: true },
                { label: "ingresado en Bs", value: fmtBs(t?.ves_confirmado) },
                { label: "gastado en Bs", value: fmtBs(t?.ves_egresos) },
                { label: "por verificar en Bs", value: fmtBs(t?.ves_por_verificar), faint: true },
              ]}
            />
            <DetailBlock
              title="zelle + efectivo sublime / USD"
              rows={[
                { label: "disponible USD", value: fmtUSD(t?.usd_saldo) },
                { label: "ingresado USD", value: fmtUSD(t?.usd_confirmado) },
                { label: "gastado USD", value: fmtUSD(t?.usd_egresos) },
                { label: "por verificar USD", value: fmtUSD(t?.usd_por_verificar), faint: true },
              ]}
            />
            <DetailBlock
              title="binance / USDT"
              rows={[
                { label: "disponible USDT", value: fmtUSDT(t?.usdt_saldo) },
                { label: "ingresado USDT", value: fmtUSDT(t?.usdt_confirmado) },
                { label: "gastado USDT", value: fmtUSDT(t?.usdt_egresos) },
                { label: "por verificar USDT", value: fmtUSDT(t?.usdt_por_verificar), faint: true },
              ]}
            />
          </div>
        </section>

        <p className="text-xs text-muted-foreground mb-10">
          {ultimaAct
            ? <>última actualización: {ultimaAct} · {t?.aportes_confirmados_count ?? 0} aportes confirmados · {t?.aportes_pendientes_count ?? 0} pendientes</>
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
                <Badge key="b" variant="outline" className="border-foreground text-foreground">confirmado</Badge>,
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

        <footer className="mt-16 border-t border-foreground/10 pt-6 text-xs text-muted-foreground leading-relaxed">
          {config?.disclaimer ??
            "[BASICO] publica este registro para mostrar de forma transparente los aportes recibidos y los gastos ejecutados. Los aportes se verifican manualmente antes de sumarse al total confirmado. Los datos sensibles serán protegidos. Este fondo no garantiza deducción fiscal."}
        </footer>
      </div>
    </div>
  );
}

function HeroCard({
  label,
  value,
  description,
  variant,
}: {
  label: string;
  value: string;
  description: string;
  variant: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";
  return (
    <Card
      className={`overflow-hidden border-0 shadow-sm ${
        isPrimary
          ? "bg-primary text-primary-foreground"
          : "bg-card border border-foreground/10 text-card-foreground"
      }`}
    >
      <CardContent className="p-5 md:p-7">
        <p
          className={`text-[11px] md:text-xs font-semibold uppercase tracking-widest mb-3 ${
            isPrimary ? "text-primary-foreground/80" : "text-muted-foreground"
          }`}
        >
          {label}
        </p>
        <div className="text-3xl md:text-5xl font-black tabular-nums tracking-tight">{value}</div>
        <p
          className={`mt-3 text-xs md:text-sm leading-relaxed ${
            isPrimary ? "text-primary-foreground/80" : "text-muted-foreground"
          }`}
        >
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

function DetailBlock({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; subtle?: boolean; faint?: boolean }[];
}) {
  return (
    <div className="bg-card border border-foreground/10 rounded-lg p-5">
      <h3 className="text-sm md:text-base font-bold lowercase tracking-tight mb-4">{title}</h3>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3">
            <span
              className={`text-xs ${
                r.faint ? "text-muted-foreground/70" : r.subtle ? "text-muted-foreground" : "text-muted-foreground"
              }`}
            >
              {r.label}
            </span>
            <span
              className={`text-sm md:text-base font-semibold tabular-nums text-right ${
                r.faint ? "text-muted-foreground" : r.subtle ? "text-foreground/80" : "text-foreground"
              }`}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg md:text-xl font-black lowercase tracking-tight mb-3 border-b border-foreground/10 pb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-sm text-muted-foreground py-6">{msg}</p>;
}

function DataTable({ cols, rows }: { cols: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto border border-foreground/10 rounded-md">
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

