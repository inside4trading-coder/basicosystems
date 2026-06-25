import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowRight,
  Radio,
  Smartphone,
  DollarSign,
  Wallet,
  Bitcoin,
  ShieldCheck,
  Activity,
  ChevronDown,
  Heart,
  CheckCircle2,
  Receipt,
  HandHeart,
  Eye,
} from "lucide-react";
import heroImg from "@/assets/fuerza-venezuela-hero.jpg";
import basicoLogoAsset from "@/assets/basico-box-logo.png.asset.json";
import { AporteDialog } from "@/components/fondo/AporteDialog";
import type { MetodoAporte } from "@/components/fondo/canales";

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
  n == null || Number.isNaN(n)
    ? "—"
    : Number(n).toLocaleString("es-VE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
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
const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};

// Animated counter
function useCountUp(target: number, duration = 1400) {
  const [val, setVal] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  useEffect(() => {
    fromRef.current = val;
    startRef.current = null;
    let raf = 0;
    const step = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(fromRef.current + (target - fromRef.current) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return val;
}

export default function FuerzaVenezuela() {
  const [t, setT] = useState<Totales | null>(null);
  const [confirmados, setConfirmados] = useState<AporteRow[]>([]);
  const [porVerificar, setPorVerificar] = useState<AporteRow[]>([]);
  const [egresos, setEgresos] = useState<EgresoRow[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [aporteMetodo, setAporteMetodo] = useState<MetodoAporte | null>(null);

  useEffect(() => {
    document.title = "fuerza venezuela — [BASICO]";
    (async () => {
      const [tRes, aRes, eRes, cRes] = await Promise.all([
        supabase.from("fondo_public_totales").select("*").maybeSingle(),
        supabase.rpc("fondo_public_aportes_list"),
        supabase.rpc("fondo_public_egresos_list"),
        supabase.from("fondo_configuracion").select("titulo_publico, subtitulo_publico, disclaimer").maybeSingle(),
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
  const vesToUsd = (ves: number | null | undefined) => (tasa && ves != null ? ves / tasa : null);

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

  const disp = useCountUp(disponibleTotalUsd);
  const ing = useCountUp(ingresadoTotalUsd);
  const gas = useCountUp(gastadoTotalUsd);

  return (
    <div className="min-h-screen bg-[#070708] text-zinc-100 antialiased selection:bg-[#E3001B]/40">
      {/* HERO */}
      <header className="relative isolate overflow-hidden">
        {/* background image */}
        <div
          className="absolute inset-0 -z-20 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImg})` }}
        />
        {/* gradients overlay */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/80 via-black/85 to-[#070708]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(227,0,27,0.18),transparent_55%)]" />
        {/* tech grid */}
        <div
          className="absolute inset-0 -z-10 opacity-[0.18] mix-blend-screen"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          }}
        />
        {/* scanline */}
        <div className="pointer-events-none absolute inset-x-0 -z-10 h-px top-1/3 bg-gradient-to-r from-transparent via-[#E3001B]/60 to-transparent animate-[scan_6s_linear_infinite]" />

        <div className="mx-auto max-w-6xl px-5 pt-12 pb-16 md:pt-20 md:pb-24">
          {/* alerta de contexto: terremoto */}
          <div
            className="animate-fade-in"
            style={{ animationDelay: "0s" }}
          >
            <div className="relative overflow-hidden rounded-xl border border-[#E3001B]/50 bg-gradient-to-r from-[#E3001B]/15 via-[#E3001B]/10 to-[#E3001B]/[0.03] p-4 backdrop-blur-sm">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#E3001B]/25 blur-2xl" />
              <div className="absolute -left-8 -bottom-8 h-20 w-20 rounded-full bg-[#E3001B]/15 blur-2xl" />
              <div className="relative flex items-start gap-3">
                <span className="relative flex h-2.5 w-2.5 shrink-0 mt-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff4d63] opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#E3001B]" />
                </span>
                <p className="text-sm md:text-base font-semibold lowercase leading-snug text-zinc-100">
                  respuesta de ayuda por el terremoto ocurrido en venezuela
                </p>
              </div>
            </div>
          </div>

          {/* live tag */}
          <div
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 backdrop-blur-sm animate-fade-in"
            style={{ animationDelay: "0.05s" }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E3001B] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E3001B]" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
              en vivo · transparente · venezuela
            </span>
          </div>

          <h1
            className="mt-7 font-black lowercase tracking-tight text-white animate-fade-in"
            style={{ fontSize: "clamp(2.75rem, 9vw, 7rem)", lineHeight: 0.95, animationDelay: "0.1s" }}
          >
            fuerza<br />venezuela
          </h1>

          <p
            className="mt-5 text-xl md:text-3xl font-semibold lowercase text-zinc-200 animate-fade-in"
            style={{ animationDelay: "0.15s" }}
          >
            una nueva forma de ayudar.
          </p>

          <p
            className="mt-4 max-w-2xl text-sm md:text-base leading-relaxed lowercase text-zinc-400 animate-fade-in"
            style={{ animationDelay: "0.18s" }}
          >
            tras el terremoto que afectó a venezuela, abrimos este fondo transparente para canalizar aportes y convertirlos en ayuda visible.
          </p>

          {/* RESUMEN EN HERO — primero, para impacto inmediato */}
          <div
            id="resumen"
            className="mt-10 animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              estado del fondo · en vivo
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <BigStat
                label="disponible total aprox."
                value={disp}
                primary
                tag="balance neto"
                hint="bs + us$ + usdt convertidos"
              />
              <BigStat label="ingresado confirmado" value={ing} tag="ingresos" hint="aportes verificados" />
              <BigStat label="gastado" value={gas} tag="egresos" hint="ya ejecutado" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-wider text-zinc-500">
              {ultimaAct ? (
                <>
                  <span>última sync: {ultimaAct}</span>
                  <span>· {t?.aportes_confirmados_count ?? 0} aportes confirmados</span>
                  <span>· {t?.aportes_pendientes_count ?? 0} pendientes</span>
                </>
              ) : (
                <span>sin actualizaciones todavía</span>
              )}
            </div>
            {!tasa && hasAnyVes && (
              <p className="mt-2 text-xs text-orange-400/90">
                · aún no hay tasa del día configurada; el equivalente usd de bolívares no se puede calcular.
              </p>
            )}
            {tasa && (
              <p className="mt-2 text-[11px] text-zinc-500 lowercase">
                tasa usada: 1 usd = {nfmt(tasa)} bs
                {t?.tasa_fecha ? ` · ${fmtDateOnly(t.tasa_fecha)}` : ""}
                {t?.tasa_fuente ? ` · ${t.tasa_fuente}` : ""}
              </p>
            )}
          </div>

          <div
            className="mt-6 max-w-2xl space-y-2 text-sm md:text-base leading-relaxed text-zinc-400 lowercase animate-fade-in"
            style={{ animationDelay: "0.23s" }}
          >
            <p>aquí no solo donas. aquí puedes ver qué pasa con tu aporte.</p>
            <p>
              cuando donas, tu aporte se registra. cuando se confirma, entra al dinero disponible.
              cuando se usa, publicamos el monto, el gasto y el comprobante. cuando es posible,
              también mostramos contenido de la entrega o la acción realizada.
            </p>
            <p>ingresos visibles. gastos con soporte. saldo disponible en vivo.</p>
          </div>

          <div
            className="mt-8 max-w-3xl animate-fade-in"
            style={{ animationDelay: "0.28s" }}
          >
            <div className="relative overflow-hidden rounded-xl border border-[#E3001B]/40 bg-[#E3001B]/[0.07] p-5 md:p-6 backdrop-blur-sm">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#E3001B]/20 blur-3xl" />
              <div className="absolute -left-10 -bottom-10 h-28 w-28 rounded-full bg-[#E3001B]/15 blur-3xl" />
              <p className="relative text-3xl md:text-5xl font-black lowercase tracking-tight text-white">
                no nos creas.
                <span className="text-[#E3001B]"> míralo.</span>
              </p>
              <p className="relative mt-2 text-xs md:text-sm text-zinc-300 lowercase">
                cada ingreso, cada gasto y cada saldo publicado en esta página.
              </p>
            </div>
          </div>

          <div
            className="mt-8 flex flex-col sm:flex-row gap-3 animate-fade-in"
            style={{ animationDelay: "0.33s" }}
          >
            <button
              onClick={() => scrollToId("aportar")}
              className="group relative inline-flex items-center justify-center gap-2 rounded-md bg-[#E3001B] px-7 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-[0_0_0_0_rgba(227,0,27,0.6)] transition-all duration-300 hover:bg-[#ff1a36] hover:shadow-[0_0_40px_-5px_rgba(227,0,27,0.8)] hover:-translate-y-0.5"
            >
              <span className="absolute inset-0 -z-10 rounded-md bg-[#E3001B] opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-60" />
              donar ahora
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => scrollToId("resumen")}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/20 bg-white/[0.03] px-7 py-4 text-sm font-semibold uppercase tracking-wider text-zinc-200 backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/[0.06] hover:text-white"
            >
              <Activity className="h-4 w-4" />
              ver fondo en vivo
            </button>
          </div>

          {/* mini flow */}
          <div
            className="mt-14 animate-fade-in"
            style={{ animationDelay: "0.38s" }}
          >
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              cómo funciona
            </p>
            <div className="flex flex-wrap items-stretch gap-3">
              {[
                { icon: Heart, label: "donar" },
                { icon: CheckCircle2, label: "confirmar" },
                { icon: Wallet, label: "disponible" },
                { icon: Receipt, label: "gasto con comprobante" },
                { icon: HandHeart, label: "ayuda visible" },
              ].map((step, i, arr) => (
                <div key={step.label} className="flex items-center gap-3">
                  <div className="group relative flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 backdrop-blur-sm transition-all hover:border-[#E3001B]/40 hover:bg-white/[0.06]">
                    <step.icon className="h-4 w-4 text-[#E3001B]" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                      {step.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-600" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => scrollToId("resumen")}
            className="mt-14 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-300 transition-colors animate-pulse"
          >
            <ChevronDown className="h-3 w-3" />
            scroll
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-16 md:py-24 space-y-20 md:space-y-28">


        {/* CÓMO APORTAR */}
        <section id="aportar" className="animate-fade-in">
          <SectionHeader
            eyebrow="canales activos"
            title="cómo aportar"
            subtitle="elige un canal, confirma tu aporte y lo publicamos aquí"
          />
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MethodCard
              icon={<Smartphone className="h-5 w-5" />}
              title="pago móvil"
              currency="BS · venezuela"
              description="transferencia o pago móvil en bolívares."
              onClick={() => setAporteMetodo("pago_movil")}
            />
            <MethodCard
              icon={<DollarSign className="h-5 w-5" />}
              title="zelle"
              currency="US$ · estados unidos"
              description="transferencia zelle en dólares."
              onClick={() => setAporteMetodo("zelle")}
            />
            <MethodCard
              icon={<Bitcoin className="h-5 w-5" />}
              title="binance"
              currency="USDT · cripto"
              description="transferencia de usdt por binance pay."
              onClick={() => setAporteMetodo("binance")}
            />
          </div>
        </section>

        {/* DETALLE POR MONEDA */}
        <section className="animate-fade-in">
          <SectionHeader
            eyebrow="transparencia por moneda"
            title="detalle del fondo"
            subtitle="los saldos reales se mantienen independientes por canal"
          />
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <DetailBlock
              tag="bolívares"
              title="pago móvil"
              accent="#E3001B"
              rows={[
                { label: "disponible", value: fmtBs(t?.ves_saldo), strong: true },
                { label: "equivalente usd", value: vesToUsd(t?.ves_saldo) == null ? "—" : `~ ${fmtUSD(vesToUsd(t?.ves_saldo))}`, subtle: true },
                { label: "ingresado", value: fmtBs(t?.ves_confirmado) },
                { label: "gastado", value: fmtBs(t?.ves_egresos) },
                { label: "por verificar", value: fmtBs(t?.ves_por_verificar), faint: true },
              ]}
            />
            <DetailBlock
              tag="dólares"
              title="zelle + efectivo"
              accent="#22d3ee"
              rows={[
                { label: "disponible", value: fmtUSD(t?.usd_saldo), strong: true },
                { label: "ingresado", value: fmtUSD(t?.usd_confirmado) },
                { label: "gastado", value: fmtUSD(t?.usd_egresos) },
                { label: "por verificar", value: fmtUSD(t?.usd_por_verificar), faint: true },
              ]}
            />
            <DetailBlock
              tag="cripto"
              title="binance"
              accent="#f59e0b"
              rows={[
                { label: "disponible", value: fmtUSDT(t?.usdt_saldo), strong: true },
                { label: "ingresado", value: fmtUSDT(t?.usdt_confirmado) },
                { label: "gastado", value: fmtUSDT(t?.usdt_egresos) },
                { label: "por verificar", value: fmtUSDT(t?.usdt_por_verificar), faint: true },
              ]}
            />
          </div>
        </section>

        {/* TABLAS */}
        <section className="animate-fade-in">
          <SectionHeader
            eyebrow="registro público"
            title="ingresos confirmados"
            subtitle="cada aporte verificado manualmente antes de sumarse"
          />
          <div className="mt-6">
            {confirmados.length === 0 ? (
              <Empty msg="aún no hay aportes confirmados." />
            ) : (
              <DataTable
                cols={["fecha", "donante", "método", "monto", "ref.", "estado"]}
                rows={confirmados.map((r) => [
                  fmtDate(r.fecha_confirmada) ?? "—",
                  r.donante_publico,
                  r.metodo,
                  fmtMonto(r.monto_original, r.moneda_original),
                  r.referencia_publica_enmascarada ?? "—",
                  <StatusBadge key="b" tone="ok">confirmado</StatusBadge>,
                ])}
              />
            )}
          </div>
        </section>

        <section className="animate-fade-in">
          <SectionHeader eyebrow="cola" title="aportes por verificar" subtitle="reportados, en proceso de validación" />
          <div className="mt-6">
            {porVerificar.length === 0 ? (
              <Empty msg="sin aportes pendientes." />
            ) : (
              <DataTable
                cols={["reportado", "método", "monto", "estado"]}
                rows={porVerificar.map((r) => [
                  r.fecha_reportada ?? "—",
                  r.metodo,
                  fmtMonto(r.monto_original, r.moneda_original),
                  <StatusBadge key="b" tone="warn">{r.estado}</StatusBadge>,
                ])}
              />
            )}
          </div>
        </section>

        <section className="animate-fade-in">
          <SectionHeader eyebrow="salidas" title="egresos ejecutados" subtitle="adónde va el dinero" />
          <div className="mt-6">
            {egresos.length === 0 ? (
              <Empty msg="aún no se han ejecutado gastos." />
            ) : (
              <DataTable
                cols={["fecha", "categoría", "descripción", "beneficiario", "monto", "comprobante"]}
                rows={egresos.map((r) => [
                  fmtDate(r.fecha_ejecucion ?? r.fecha_gasto) ?? "—",
                  r.categoria,
                  r.descripcion ?? "—",
                  r.proveedor ?? "—",
                  fmtMonto(r.monto_original, r.moneda_original),
                  r.comprobante_publico_url ? (
                    <a key="l" href={r.comprobante_publico_url} target="_blank" rel="noreferrer" className="text-[#22d3ee] hover:underline">
                      ver
                    </a>
                  ) : (
                    "—"
                  ),
                ])}
              />
            )}
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/10 pt-8 pb-2">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="flex items-start gap-3 flex-1">
              <ShieldCheck className="h-4 w-4 text-zinc-500 mt-0.5 shrink-0" />
              <p className="text-xs text-zinc-500 leading-relaxed">
                {config?.disclaimer ??
                  "[BASICO] publica este registro para mostrar de forma transparente los aportes recibidos y los gastos ejecutados. Los aportes se verifican manualmente antes de sumarse al total confirmado. Los datos sensibles serán protegidos. Este fondo no garantiza deducción fiscal."}
              </p>
            </div>
            <div className="shrink-0">
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600">respaldado por</p>
              <img
                src={basicoLogoAsset.url}
                alt="BASICO"
                className="h-10 w-auto rounded-sm border border-white/10 bg-[#E3001B] object-contain"
              />
            </div>
          </div>
        </footer>
      </main>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-40vh); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(40vh); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <div className="inline-flex items-center gap-2">
        <span className="h-px w-8 bg-[#E3001B]" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          {eyebrow}
        </span>
      </div>
      <h2 className="mt-3 text-3xl md:text-5xl font-black lowercase tracking-tight text-white">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-sm md:text-base text-zinc-400 lowercase">{subtitle}</p>
      )}
    </div>
  );
}

function BigStat({
  label,
  value,
  tag,
  hint,
  primary,
}: {
  label: string;
  value: number;
  tag: string;
  hint: string;
  primary?: boolean;
}) {
  const display = `~ US$ ${value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div
      className={`group relative overflow-hidden rounded-xl border p-6 transition-all duration-300 hover:-translate-y-0.5 ${
        primary
          ? "border-[#E3001B]/40 bg-gradient-to-br from-[#1a0205] via-[#0e0103] to-[#070708] hover:border-[#E3001B]/70 hover:shadow-[0_0_40px_-10px_rgba(227,0,27,0.5)]"
          : "border-white/10 bg-white/[0.02] backdrop-blur-sm hover:border-white/25 hover:bg-white/[0.04]"
      }`}
    >
      {primary && (
        <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-[#E3001B]/20 blur-3xl" />
      )}
      <div className="relative flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          {tag}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
          live
        </span>
      </div>
      <p className={`relative mt-4 text-xs uppercase tracking-widest ${primary ? "text-[#ff6e7e]" : "text-zinc-400"}`}>
        {label}
      </p>
      <div className={`relative mt-3 font-black tabular-nums tracking-tight ${primary ? "text-white" : "text-zinc-100"}`}
        style={{ fontSize: primary ? "clamp(2rem, 5vw, 3.25rem)" : "clamp(1.6rem, 4vw, 2.5rem)", lineHeight: 1 }}
      >
        {display}
      </div>
      <p className="relative mt-3 text-xs text-zinc-500 lowercase">{hint}</p>
    </div>
  );
}

function MethodCard({
  icon,
  title,
  currency,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  currency: string;
  description: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#E3001B]/40 hover:bg-white/[0.04]">
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[#E3001B]/0 to-transparent transition-all duration-500 group-hover:via-[#E3001B]" />
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-200 transition-colors group-hover:border-[#E3001B]/40 group-hover:text-[#ff6e7e]">
          {icon}
        </div>
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          activo
        </span>
      </div>
      <h3 className="mt-5 text-lg font-bold lowercase tracking-tight text-white">{title}</h3>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#E3001B]">
        {currency}
      </p>
      <p className="mt-3 text-xs text-zinc-400 leading-relaxed lowercase">{description}</p>
      <div className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300 transition-colors group-hover:text-white">
        usar este método
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
      </div>
    </div>
  );
}

function DetailBlock({
  tag,
  title,
  accent,
  rows,
}: {
  tag: string;
  title: string;
  accent: string;
  rows: { label: string; value: string; subtle?: boolean; faint?: boolean; strong?: boolean }[];
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-6 backdrop-blur-sm transition-colors hover:border-white/20">
      <div className="absolute left-0 top-0 h-full w-0.5" style={{ background: accent }} />
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>
        {tag}
      </p>
      <h3 className="mt-2 text-xl font-bold lowercase tracking-tight text-white">{title}</h3>
      <div className="mt-5 space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-2 last:border-0">
            <span className={`text-[11px] uppercase tracking-wider ${r.faint ? "text-zinc-600" : "text-zinc-500"}`}>
              {r.label}
            </span>
            <span
              className={`tabular-nums text-right ${
                r.strong
                  ? "text-white text-lg font-bold"
                  : r.faint
                  ? "text-zinc-500 text-sm"
                  : r.subtle
                  ? "text-zinc-400 text-sm"
                  : "text-zinc-200 text-sm font-semibold"
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

function StatusBadge({ children, tone }: { children: React.ReactNode; tone: "ok" | "warn" }) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : "border-orange-500/30 bg-orange-500/10 text-orange-300";
  return (
    <Badge variant="outline" className={`${cls} text-[10px] uppercase tracking-wider`}>
      {children}
    </Badge>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center text-sm text-zinc-500 lowercase">
      {msg}
    </div>
  );
}

function DataTable({ cols, rows }: { cols: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-sm">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            {cols.map((c) => (
              <TableHead key={c} className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i} className="border-white/5 hover:bg-white/[0.03] transition-colors">
              {r.map((cell, j) => (
                <TableCell key={j} className="text-sm text-zinc-300">
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
