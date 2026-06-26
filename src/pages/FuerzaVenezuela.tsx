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
  
  CheckCircle2,
  Receipt,
  Eye,
  ExternalLink,
} from "lucide-react";
import amanecerDesktop from "@/assets/amanecer-desktop.jpg.asset.json";
import amanecerMobile from "@/assets/amanecer-mobile.jpg.asset.json";
import basicoLogoAsset from "@/assets/basico-box-logo.png.asset.json";
import fondoLogoAsset from "@/assets/logo-fondo-transparente-v2.png.asset.json";
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
  telefono_publico: string | null;
  metodo: string;
  moneda_original: string;
  monto_original: number;
  equivalente_usd: number | null;
  referencia_publica_enmascarada: string | null;
  estado: string;
  nota_publica: string | null;
  es_anonimo: boolean;
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
const HEADER_OFFSET = 80;
const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  window.scrollTo({ top, behavior: "smooth" });
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
    document.title = "Fondo Transparente | fundacionbasico.com";

    const ensureMeta = (selector: string, attrs: Record<string, string>) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        Object.entries(attrs).forEach(([k, v]) => {
          if (k !== "content") el!.setAttribute(k, v);
        });
        document.head.appendChild(el);
      }
      el.setAttribute("content", attrs.content);
    };
    const ensureCanonical = (href: string) => {
      let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", "canonical");
        document.head.appendChild(el);
      }
      el.setAttribute("href", href);
    };

    const desc =
      "Fondo Transparente por [basico]: cada aporte verificable, cada gasto público. Ayuda a las víctimas del terremoto en Venezuela con total transparencia.";
    ensureMeta('meta[name="description"]', { name: "description", content: desc });
    ensureMeta('meta[property="og:title"]', { property: "og:title", content: "Fondo Transparente | fundacionbasico.com" });
    ensureMeta('meta[property="og:description"]', { property: "og:description", content: desc });
    ensureMeta('meta[property="og:url"]', { property: "og:url", content: "https://fundacionbasico.com/" });
    ensureMeta('meta[name="twitter:title"]', { name: "twitter:title", content: "Fondo Transparente | fundacionbasico.com" });
    ensureMeta('meta[name="twitter:description"]', { name: "twitter:description", content: desc });
    ensureCanonical("https://fundacionbasico.com/");

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
    <div className="min-h-screen bg-[#070b18] text-zinc-100 antialiased selection:bg-[#ff7a4c]/40">
      {/* STICKY TOP NAV */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#070b18]/85 backdrop-blur-md supports-[backdrop-filter]:bg-[#070b18]/65">

        <div className="mx-auto max-w-6xl px-4 py-2.5 md:py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={fondoLogoAsset.url}
              alt="Fondo Transparente"
              className="h-7 md:h-8 w-auto"
            />
            <span className="hidden sm:inline text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              por [basico]
            </span>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                recaudado confirmado
              </span>
              <span className="text-sm md:text-base font-bold text-white tabular-nums">
                ~ {fmtUSD(ingresadoTotalUsd)}
              </span>
            </div>
            <button
              onClick={() => scrollToId("aportar")}
              className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#ff7a4c] to-[#ff5a6e] px-3 py-2 md:px-4 md:py-2.5 text-xs md:text-sm font-bold uppercase tracking-wider text-white shadow-[0_4px_20px_-4px_rgba(255,122,76,0.7)] hover:shadow-[0_6px_28px_-2px_rgba(255,122,76,0.9)] transition-shadow"
            >
              donar ahora
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {/* mobile recaudado row */}
        <div className="sm:hidden border-t border-white/5 px-4 py-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider">
          <span className="text-zinc-500">recaudado confirmado</span>
          <span className="font-bold text-white tabular-nums normal-case">~ {fmtUSD(ingresadoTotalUsd)}</span>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative isolate overflow-hidden">
        {/* background image — responsive: mobile portrait / desktop landscape */}
        <picture aria-hidden="true">
          <source media="(min-width: 768px)" srcSet={amanecerDesktop.url} />
          <img
            src={amanecerMobile.url}
            alt=""
            className="absolute inset-0 -z-20 h-full w-full object-cover object-[center_30%] md:object-center"
          />
        </picture>
        {/* navy + burdeos overlays — oscurece sin matar el amanecer */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#0a1428]/85 via-[#0a1428]/75 to-[#0a1428]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,140,90,0.18),transparent_55%)]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(140,30,60,0.22),transparent_60%)]" />
        {/* extra darkening band behind text — más fuerte en mobile */}
        <div className="absolute inset-x-0 top-0 -z-10 h-[70%] bg-gradient-to-b from-[#070b18]/70 via-[#070b18]/40 to-transparent md:from-[#070b18]/55 md:via-[#070b18]/25" />
        {/* tech grid */}
        <div
          className="absolute inset-0 -z-10 opacity-[0.12] mix-blend-screen"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          }}
        />
        {/* scanline — coral cálido */}
        <div className="pointer-events-none absolute inset-x-0 -z-10 h-px top-1/3 bg-gradient-to-r from-transparent via-[#ff8a5c]/40 to-transparent animate-[scan_6s_linear_infinite]" />


        <div className="mx-auto max-w-6xl px-5 pt-8 pb-16 md:pt-12 md:pb-24">
          {/* slim context band — más editorial, burdeos apagado */}
          <div
            className="animate-fade-in flex items-start gap-3 rounded-md border-l-2 border-[#c44a5a] bg-[#c44a5a]/[0.08] px-4 py-3 backdrop-blur-sm"
            style={{ animationDelay: "0s" }}
          >
            <span className="relative flex h-2 w-2 shrink-0 mt-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff7a8a] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#c44a5a]" />
            </span>
            <div className="min-w-0">
              <p className="text-sm md:text-[15px] font-semibold lowercase leading-snug text-zinc-100">
                respuesta activa por el terremoto ocurrido en venezuela
              </p>
              <p className="mt-1 text-xs md:text-sm lowercase leading-snug text-zinc-400">
                este fondo nace para canalizar aportes y convertirlos en ayuda visible, con ingresos, gastos y saldo disponible publicados.
              </p>
            </div>
          </div>


          <h1
            className="mt-7 animate-fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            <span className="sr-only">Fondo Transparente · fuerza venezuela</span>
            <img
              src={fondoLogoAsset.url}
              alt=""
              aria-hidden="true"
              className="h-auto w-full max-w-[340px] md:max-w-[460px] drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
            />
          </h1>

          {/* frase emocional — amanecer */}
          <p
            className="mt-6 text-2xl md:text-4xl font-semibold lowercase italic animate-fade-in bg-gradient-to-r from-[#ff9a6c] via-[#ffb38a] to-[#ffc9a8] bg-clip-text text-transparent leading-tight"
            style={{ animationDelay: "0.15s" }}
          >
            cada aporte acerca el amanecer.
          </p>

          <div
            className="mt-4 max-w-2xl space-y-3 animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            <p className="text-base md:text-lg leading-relaxed lowercase text-zinc-200">
              creamos un fondo abierto para responder al terremoto ocurrido en venezuela.
              aquí puedes ver <span className="text-white font-medium">qué dinero entra, qué dinero se usa, en qué se usa y cuánto queda disponible.</span>
            </p>
            <p className="text-sm md:text-base leading-relaxed lowercase text-zinc-400">
              cada ingreso confirmado se publica. cada gasto se muestra con monto y soporte. cada saldo queda visible.
            </p>
            <p className="text-xl md:text-2xl font-black lowercase tracking-tight text-white leading-tight">
              no nos creas.{" "}
              <span className="bg-gradient-to-r from-[#ff8a5c] to-[#ffb38a] bg-clip-text text-transparent">revísalo.</span>
            </p>
          </div>




          {/* RESUMEN EN HERO — primero, para impacto inmediato */}
          <div
            id="resumen"
            className="mt-10 animate-fade-in scroll-mt-24"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              estado del fondo · actualizado tras verificación
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <BigStat
                label="disponible total aprox."
                value={disp}
                primary
                tag="balance neto"
                hint="bs + us$ + usdt convertidos"
              />
              <BigStat label="recaudado confirmado" value={ing} tag="ingresos" hint="aportes verificados" />
              <BigStat label="gastado con soporte" value={gas} tag="egresos" hint="con comprobante" />
            </div>
            <p className="mt-3 text-[11px] leading-snug lowercase text-zinc-500 max-w-2xl">
              los montos aproximados combinan bs, usd y usdt usando la tasa bcv activa para bolívares. los saldos reales se mantienen separados por moneda.
            </p>
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

          {/* EL FONDO ABIERTO — trazabilidad */}
          <div
            id="fondo-abierto"
            className="mt-12 animate-fade-in scroll-mt-24"
            style={{ animationDelay: "0.23s" }}
          >
            <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-[#ff8a5c]/60" />
              el fondo abierto
            </div>

            <h2 className="text-2xl md:text-4xl font-black lowercase tracking-tight text-white leading-tight">
              no es solo donar.{" "}
              <span className="bg-gradient-to-r from-[#ff8a5c] to-[#ffb38a] bg-clip-text text-transparent">
                es poder seguir el recorrido del dinero.
              </span>
            </h2>

            <p className="mt-4 max-w-3xl text-sm md:text-base leading-relaxed lowercase text-zinc-300">
              cada aporte confirmado entra al fondo y queda publicado.
              cada gasto ejecutado se descuenta del saldo y se muestra con monto, fecha, concepto y soporte.
              si hay factura, comprobante, foto, video o contenido de entrega, también se publica.
            </p>
            <p className="mt-3 max-w-3xl text-sm md:text-base lowercase text-zinc-400">
              puedes sumar lo que entra, restar lo que sale y ver el saldo disponible.
            </p>

            {/* 3 columnas */}
            <div className="mt-7 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              {[
                {
                  tag: "ingresos",
                  title: "lo que entra",
                  ring: "border-emerald-400/30",
                  dot: "bg-emerald-400",
                  glow: "from-emerald-400/20 to-emerald-400/0",
                  items: [
                    "aportes confirmados",
                    "método de pago",
                    "moneda y monto original",
                    "equivalente aprox. en usd",
                    "fecha de confirmación",
                    "estado verificado",
                  ],
                  foot: "cada aporte confirmado suma al fondo disponible.",
                },
                {
                  tag: "egresos",
                  title: "lo que sale",
                  ring: "border-[#ff8a5c]/30",
                  dot: "bg-[#ff8a5c]",
                  glow: "from-[#ff8a5c]/20 to-[#ff8a5c]/0",
                  items: [
                    "gasto ejecutado y concepto",
                    "monto y moneda",
                    "factura o comprobante",
                    "responsable o destino",
                    "contenido de entrega",
                  ],
                  foot: "cada gasto descuenta del saldo y queda respaldado.",
                },
                {
                  tag: "saldo",
                  title: "lo que queda",
                  ring: "border-cyan-400/30",
                  dot: "bg-cyan-400",
                  glow: "from-cyan-400/20 to-cyan-400/0",
                  items: [
                    "saldo disponible por moneda",
                    "saldo aproximado total en usd",
                    "tasa bcv usada para bolívares",
                    "última actualización",
                    "movimientos por verificar",
                  ],
                  foot: "el saldo cambia con cada ingreso confirmado y cada egreso ejecutado.",
                },
              ].map((c) => (
                <div
                  key={c.tag}
                  className={`relative overflow-hidden rounded-xl border ${c.ring} bg-white/[0.025] p-4 md:p-5 backdrop-blur-sm`}
                >
                  <div className={`absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${c.glow} blur-2xl`} />
                  <div className="relative flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                    {c.tag}
                  </div>
                  <h3 className="relative mt-1.5 text-xl md:text-2xl font-black lowercase tracking-tight text-white">
                    {c.title}
                  </h3>
                  <ul className="relative mt-3 space-y-1.5 text-[12px] md:text-[13px] lowercase text-zinc-300">
                    {c.items.map((it) => (
                      <li key={it} className="flex items-start gap-2">
                        <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${c.dot}`} />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="relative mt-4 text-[11px] lowercase italic text-zinc-500 border-t border-white/5 pt-3">
                    {c.foot}
                  </p>
                </div>
              ))}
            </div>

            {/* fórmula visual */}
            <div className="mt-6 rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent p-5 md:p-7 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-center gap-3 md:gap-5 text-center">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400/90">ingresos confirmados</span>
                  <span className="mt-1 text-2xl md:text-3xl font-black tabular-nums text-white">~ {fmtUSD(ingresadoTotalUsd)}</span>
                </div>
                <span className="text-3xl md:text-5xl font-black text-zinc-600">−</span>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#ffb38a]">gastos con soporte</span>
                  <span className="mt-1 text-2xl md:text-3xl font-black tabular-nums text-white">~ {fmtUSD(gastadoTotalUsd)}</span>
                </div>
                <span className="text-3xl md:text-5xl font-black text-zinc-600">=</span>
                <div className="flex flex-col items-center rounded-lg border border-cyan-400/30 bg-cyan-400/[0.06] px-4 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">saldo disponible</span>
                  <span className="mt-1 text-2xl md:text-3xl font-black tabular-nums text-white">~ {fmtUSD(disponibleTotalUsd)}</span>
                </div>
              </div>
              <p className="mt-4 text-center text-xs md:text-sm lowercase text-zinc-400">
                la cuenta está abierta: cada movimiento publicado cambia el resultado.
              </p>
            </div>

            {/* frase fuerte */}
            <p className="mt-6 text-center text-base md:text-xl lowercase italic text-zinc-300 max-w-3xl mx-auto">
              transparencia no es decirlo.{" "}
              <span className="text-white font-semibold not-italic">es dejar que cualquiera lo revise.</span>
            </p>
          </div>


          <div
            className="mt-8 max-w-3xl animate-fade-in"
            style={{ animationDelay: "0.28s" }}
          >
            <div className="relative overflow-hidden rounded-xl border border-[#ff8a5c]/30 bg-[#3a1a14]/40 p-5 md:p-6 backdrop-blur-sm">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#ff8a5c]/20 blur-3xl" />
              <div className="absolute -left-10 -bottom-10 h-28 w-28 rounded-full bg-[#c44a5a]/20 blur-3xl" />
              <p className="relative text-3xl md:text-5xl font-black lowercase tracking-tight text-white leading-[0.95]">
                no nos creas.
                <br />
                <span className="bg-gradient-to-r from-[#ff8a5c] to-[#ffb38a] bg-clip-text text-transparent">míralo.</span>
              </p>
              <p className="relative mt-3 text-xs md:text-sm text-zinc-300 lowercase">
                cada ingreso, cada gasto y cada saldo publicado en esta página.
              </p>
              <a
                href="https://fundacionbasico.com"
                target="_blank"
                rel="noreferrer"
                className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-[#ff8a5c]/40 bg-[#ff8a5c]/10 px-4 py-2 text-sm font-semibold text-[#ffb38a] hover:bg-[#ff8a5c]/20 hover:text-white transition-colors"
              >
                <Radio className="h-3.5 w-3.5" />
                fundacionbasico.com
              </a>
            </div>
          </div>

          <div
            className="mt-8 flex flex-col sm:flex-row gap-3 animate-fade-in"
            style={{ animationDelay: "0.33s" }}
          >
            <button
              onClick={() => scrollToId("aportar")}
              className="group relative inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#ff7a4c] to-[#ff5a6e] px-7 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-[0_8px_30px_-8px_rgba(255,122,76,0.6)] transition-all duration-300 hover:shadow-[0_12px_40px_-6px_rgba(255,122,76,0.8)] hover:-translate-y-0.5"
            >
              <span className="absolute inset-0 -z-10 rounded-md bg-[#ff7a4c] opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-60" />
              donar ahora
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>

            <button
              onClick={() => scrollToId("registro")}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/20 bg-white/[0.03] px-7 py-4 text-sm font-semibold uppercase tracking-wider text-zinc-200 backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/[0.06] hover:text-white"
            >
              <Activity className="h-4 w-4" />
              ver movimientos
            </button>
          </div>

          {/* ASÍ SE RASTREA EL FONDO */}
          <div
            id="trazabilidad"
            className="mt-16 animate-fade-in scroll-mt-24"
            style={{ animationDelay: "0.38s" }}
          >
            <div className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-[#ff8a5c]/60" />
              así se rastrea el fondo
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { n: "01", t: "entra un aporte", d: "la persona dona por pago móvil, zelle, binance o efectivo." },
                { n: "02", t: "se verifica", d: "el equipo confirma manualmente el pago antes de sumarlo." },
                { n: "03", t: "se publica", d: "el aporte confirmado aparece en el registro público." },
                { n: "04", t: "se ejecuta un gasto", d: "cuando usamos el dinero, registramos concepto, monto y moneda." },
                { n: "05", t: "se adjunta soporte", d: "subimos factura, comprobante o evidencia disponible." },
                { n: "06", t: "cambia el saldo", d: "el sistema resta el egreso y muestra cuánto queda." },
              ].map((s) => (
                <div
                  key={s.n}
                  className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.025] p-4 backdrop-blur-sm transition-all hover:border-[#ff8a5c]/40 hover:bg-white/[0.05]"
                >
                  <div className="absolute -top-px left-4 right-4 h-px bg-gradient-to-r from-transparent via-[#ff8a5c]/0 to-transparent transition-all duration-500 group-hover:via-[#ff8a5c]/70" />
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-mono tracking-wider text-[#ff8a5c]/70">{s.n}</span>
                    <h4 className="text-sm md:text-base font-bold lowercase tracking-tight text-white">{s.t}</h4>
                  </div>
                  <p className="mt-2 text-[12px] leading-snug lowercase text-zinc-400">{s.d}</p>
                </div>
              ))}
            </div>

            {/* cada gasto deja rastro */}
            <div className="mt-6 rounded-xl border border-white/10 bg-gradient-to-r from-[#ff8a5c]/[0.07] via-transparent to-cyan-400/[0.05] p-5 md:p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                <Receipt className="h-3.5 w-3.5 text-[#ffb38a]" />
                cada gasto debe dejar rastro
              </div>
              <p className="mt-2 text-base md:text-lg lowercase text-zinc-100">
                cuando un gasto se ejecuta, no queda como una frase.{" "}
                <span className="text-white font-semibold">queda como un movimiento con soporte.</span>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["factura", "comprobante", "foto", "video", "entrega", "proveedor", "monto", "fecha"].map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold lowercase text-zinc-200"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs lowercase text-zinc-500">
                si existe factura, la subimos. si existe comprobante, lo mostramos. si existe contenido de entrega, lo publicamos.
              </p>
            </div>

            <p className="mt-6 text-xs md:text-sm lowercase text-zinc-500 max-w-2xl">
              transparencia no es promesa: es registro. si se usa, se publica. si se gasta, se respalda.
            </p>
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
        <section id="aportar" className="animate-fade-in scroll-mt-24">
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
            <MethodCard
              icon={<DollarSign className="h-5 w-5" />}
              title="bizum"
              currency="€ · españa"
              description="bizum en euros (se contabilizan como us$ 1:1 por ahora)."
              onClick={() => setAporteMetodo("bizum")}
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
        <section id="registro" className="animate-fade-in scroll-mt-24">
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
                cols={["fecha", "donante", "teléfono", "método", "monto", "ref.", "estado"]}
                rows={confirmados.map((r) => [
                  fmtDate(r.fecha_confirmada) ?? "—",
                  r.donante_publico,
                  r.telefono_publico ?? "—",
                  r.metodo,
                  fmtMonto(r.monto_original, r.moneda_original),
                  r.referencia_publica_enmascarada ?? "—",
                  <StatusBadge key="b" tone="ok">confirmado</StatusBadge>,
                ])}
              />
            )}
          </div>
        </section>

        <section id="por-verificar" className="animate-fade-in scroll-mt-24">
          <SectionHeader eyebrow="cola" title="aportes por verificar" subtitle="reportados, en proceso de validación" />
          <div className="mt-6">
            {porVerificar.length === 0 ? (
              <Empty msg="sin aportes pendientes." />
            ) : (
              <DataTable
                cols={["reportado", "donante", "teléfono", "método", "monto", "ref.", "estado"]}
                rows={porVerificar.map((r) => [
                  r.fecha_reportada ?? "—",
                  r.donante_publico,
                  r.telefono_publico ?? "—",
                  r.metodo,
                  fmtMonto(r.monto_original, r.moneda_original),
                  r.referencia_publica_enmascarada ?? "—",
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
        <footer className="border-t border-white/10 pt-8 md:pt-12 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 md:items-start">
            {/* Project identity */}
            <div className="md:col-span-3 flex flex-col items-center md:items-start gap-2 text-center md:text-left">
              <img
                src={fondoLogoAsset.url}
                alt="Fondo Transparente"
                className="h-6 md:h-7 w-auto"
              />
              <p className="text-[11px] md:text-xs text-zinc-500 leading-relaxed lowercase max-w-[260px]">
                cada aporte verificable, cada gasto público.
              </p>
            </div>

            {/* Trust & disclosure */}
            <div className="md:col-span-6 order-3 md:order-none">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 md:p-5 flex gap-3">
                <ShieldCheck className="h-4 w-4 md:h-5 md:w-5 text-[#E3001B] flex-shrink-0 mt-0.5" />
                <div className="space-y-1.5 min-w-0">
                  <h4 className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-zinc-200">
                    declaración de transparencia
                  </h4>
                  <p className="text-[11px] md:text-xs text-zinc-400 leading-relaxed">
                    {config?.disclaimer ??
                      "[BASICO] publica este registro para mostrar de forma transparente los aportes recibidos y los gastos ejecutados. Los aportes se verifican manualmente antes de sumarse al total confirmado. Los datos sensibles serán protegidos. Este fondo no garantiza deducción fiscal."}
                  </p>
                </div>
              </div>
            </div>

            {/* Backing & link */}
            <div className="md:col-span-3 flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-3 md:gap-4">
              <div className="flex items-center gap-2 md:flex-col md:items-end md:gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600 md:text-right">
                  respaldado por
                </span>
                <img
                  src={basicoLogoAsset.url}
                  alt="BASICO"
                  className="h-7 md:h-10 w-auto rounded-sm border border-white/10 bg-[#E3001B] object-contain"
                />
              </div>
              <a
                href="https://fundacionbasico.com"
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-1.5 text-[11px] md:text-xs font-semibold text-[#ff6e7e] hover:text-white transition-colors"
              >
                <span className="font-mono tracking-tight">fundacionbasico.com</span>
                <ExternalLink className="h-3 w-3 md:h-3.5 md:w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>
          </div>

          <div className="mt-8 md:mt-10 pt-5 md:pt-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4">
            <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-zinc-600 text-center md:text-left">
              © {new Date().getFullYear()} Fondo Transparente · fundacionbasico.com
            </p>
            <nav className="flex flex-wrap justify-center gap-3 md:gap-4 text-[9px] md:text-[10px] uppercase tracking-wider text-zinc-600">
              <a href="#resumen" className="hover:text-[#ff6e7e] transition-colors">resumen</a>
              <a href="#registro" className="hover:text-[#ff6e7e] transition-colors">registro</a>
              <a href="#aportar" className="hover:text-[#ff6e7e] transition-colors">donar</a>
            </nav>
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

      <AporteDialog
        metodo={aporteMetodo}
        open={aporteMetodo !== null}
        onOpenChange={(o) => !o && setAporteMetodo(null)}
      />
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
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  currency: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#E3001B]/40 hover:bg-white/[0.04] text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E3001B]/60"
    >
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
    </button>
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
