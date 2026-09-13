import { useEffect, useRef, useState, FormEvent, PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ConfettiSphere from "@/components/landing/ConfettiSphere";
import BrandMark from "@/components/BrandMark";
import "@/components/landing/landing-bsystems.css";

const leadSchema = z.object({
  name: z.string().trim().min(2, "Nombre muy corto").max(100),
  brand: z.string().trim().max(100).optional(),
  email: z.string().trim().email("Email inválido").max(255),
  message: z.string().trim().max(1000).optional(),
  interest: z.enum(["saas", "tailor", "unsure"]),
});

const modules = [
  { n: "01", group: "BASE START", title: "POS", desc: "Registra ventas, métodos de pago, clientes, descuentos y cierres de caja desde un solo punto.", icon: "bsys-cart" },
  { n: "02", group: "BASE START", title: "Inventario", desc: "Conoce qué tienes, dónde está y cómo se mueve tu mercancía.", icon: "bsys-tag" },
  { n: "03", group: "BASE START", title: "Reportes", desc: "Ventas, caja, inventario y resultados con información actual.", icon: "bsys-file" },
  { n: "04", group: "BASE START", title: "Administración", desc: "Controla obligaciones, vencimientos, movimientos y la información administrativa del negocio.", icon: "bsys-terminal" },
  { n: "05", group: "MÁS MÓDULOS B SYSTEMS", title: "WhatsApp CRM + POS", desc: "Convierte conversaciones de WhatsApp en clientes y pedidos conectados directamente con tu POS e inventario.", note: "CHAT → CLIENTE → PEDIDO → POS → INVENTARIO", icon: "bsys-chat", wide: true },
  { n: "06", group: "MÁS MÓDULOS B SYSTEMS", title: "Planificación en equipo", desc: "Organiza tareas, responsables, horarios y trabajo del equipo desde un mismo lugar.", icon: "bsys-clock" },
  { n: "07", group: "MÁS MÓDULOS B SYSTEMS", title: "Fichaje", desc: "Entradas, salidas, horas trabajadas y asistencia de tu equipo.", icon: "bsys-users" },
  { n: "08", group: "MÁS MÓDULOS B SYSTEMS", title: "Telefonía comercial", desc: "Gestiona las llamadas comerciales de tu equipo: métricas, duración, historial, resultados, grabaciones y seguimiento.", note: "CON TECNOLOGÍA ZADARMA", icon: "bsys-user" },
  { n: "09", group: "MÁS MÓDULOS B SYSTEMS", title: "B Systems Studio", desc: "Prepara contenido y material de producto directamente desde B Systems.", icon: "bsys-branch" },
  { n: "10", group: "SERVICIO ADICIONAL", title: "Web / Ecommerce", desc: "Creamos o conectamos tu tienda online para que trabaje junto a tu operación.", icon: "bsys-mail" },
];

const customization = [
  { title: "Módulos", desc: "Activa solo lo que tu negocio necesita." },
  { title: "Roles y permisos", desc: "Define qué puede hacer y ver cada persona." },
  { title: "Integraciones", desc: "Conecta las herramientas que forman parte de tu operación." },
  { title: "A tu medida", desc: "Construimos procesos y módulos específicos para tu empresa." },
];

const industries = [
  { title: "Tienda", desc: "POS · Inventario · WhatsApp · Ecommerce" },
  { title: "Distribuidora", desc: "Vendedores en calle · Rutas · Pedidos mayoristas · Crédito · Cobranzas · Descuentos" },
  { title: "Marca / Fabricante", desc: "Producción · Costos · Proveedores · Materiales · Trazabilidad" },
  { title: "Clínica", desc: "Pacientes · Citas · Seguimiento · Recordatorios" },
  { title: "Restauración", desc: "Reservas · Inventario · Equipo · Delivery" },
  { title: "Servicios", desc: "Clientes · Propuestas · Horas · Facturación" },
];

const processes = {
  start: ["Activa", "Configura", "Empieza", "Crece"],
  custom: ["Entendemos", "Diseñamos", "Construimos", "Mejoramos"],
};

const integrations = ["WhatsApp", "Instagram", "WooCommerce", "Shopify", "Zadarma", "+ Más integraciones"];

// Mapa de conexión de la sección Módulos: mismo patrón que la pieza de
// Instagram "puede conectar las partes clave de tu operación" — nodo central
// [B] con las áreas que ya conecta, antes de entrar al detalle de cada módulo.
const operationMap = [
  "Ventas", "Inventario", "Producción", "Finanzas", "Equipo", "Clientes", "Compras",
];

// Árbol de decisión "No todo necesita IA" — mismo patrón que la pieza
// [B] Principle / 001. Sustituye el listado de herramientas como mensaje
// principal del bloque Stack; el listado baja a nota al pie.
const decisions = [
  { q: "¿Basta una condición sencilla?", a: "Regla" },
  { q: "¿Una secuencia puede ejecutarse sola?", a: "Automatización" },
  { q: "¿Tu empresa necesita una herramienta propia?", a: "Software" },
  { q: "¿Hace falta interpretar, analizar o asistir?", a: "IA" },
];

const navItems = [
  { id: "start", label: "Start" },
  { id: "modulos", label: "Módulos" },
  { id: "custom", label: "Custom" },
  { id: "proceso", label: "Proceso" },
];

export default function Landing() {
  const [submitting, setSubmitting] = useState(false);
  const [interest, setInterest] = useState<"saas" | "tailor" | "unsure">("unsure");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);

  // Nav compacto + parallax del hero + barra de progreso + cortina de
  // acento. Un solo listener con rAF para las cuatro cosas: togglear la
  // clase de scrolled es barato, pero escribir la custom property y el
  // ancho de la barra en cada evento de scroll sin throttle sí provoca
  // layout thrash.
  // La barra escribe directo al DOM por ref, no por estado — un re-render de
  // toda la página en cada frame de scroll sería el detalle "premium" que
  // termina sintiéndose lento.
  useEffect(() => {
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion && curtainRef.current) {
      curtainRef.current.style.display = "none";
    }
    // Cortina de acento: golpe de color a pantalla completa que se dispara
    // una única vez, al cruzar el límite hero→cuerpo, y barre hacia arriba
    // para revelar lo que sigue. Con reduced-motion queda "ya jugada" desde
    // el arranque, así el listener nunca la dispara.
    let curtainPlayed = reducedMotion;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 24);
        if (heroRef.current && y < window.innerHeight) {
          heroRef.current.style.setProperty("--scrollY", String(y));
        }
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (progressRef.current) {
          progressRef.current.style.width = `${max > 0 ? Math.min(100, (y / max) * 100) : 0}%`;
        }
        if (!curtainPlayed && heroRef.current) {
          const threshold = heroRef.current.offsetHeight * 0.55;
          if (y > threshold) {
            curtainPlayed = true;
            const el = curtainRef.current;
            if (el) {
              // Cubre instantáneo (sin transición) y en el frame siguiente
              // arranca el barrido — así el golpe de color aparece de golpe
              // y se retira con una transición, no al revés.
              el.classList.add("curtain--cover");
              requestAnimationFrame(() => {
                el.classList.remove("curtain--cover");
                el.classList.add("curtain--sweep");
              });
              window.setTimeout(() => { el.style.display = "none"; }, 700);
            }
          }
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scrollspy del nav: qué sección ancla está activa. Umbral bajo y franja
  // centrada en el viewport para que el cambio ocurra cuando la sección
  // domina la pantalla, no en el primer píxel de entrada.
  useEffect(() => {
    const targets = navItems
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => !!el);
    if (!targets.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  // Scroll-reveal: cada `.reveal` aparece la primera vez que entra en
  // pantalla. `unobserve` tras revelarlo — es una entrada, no algo que deba
  // repetirse al subir y bajar. Respeta prefers-reduced-motion también en JS:
  // sin esto, el elemento nace en opacity:0 vía CSS y si el observer no
  // llegara a disparar (motion-reduce ya lo neutraliza por CSS, pero más
  // vale no depender de una sola capa) se quedaría invisible para siempre.
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = document.querySelectorAll(".reveal");
    if (reduced) {
      nodes.forEach((n) => n.classList.add("in-view"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  // Tilt 3D sutil en tarjetas, módulos, caminos y nodos del mapa. Sólo con
  // ratón de precisión (`pointer: fine`) — en táctil no hay hover que leer,
  // y respeta reduced-motion igual que el resto de la capa de movimiento.
  // El transform se escribe inline porque tiene que combinar la inclinación
  // (calculada del cursor) con la elevación (constante); son la misma
  // propiedad y no pueden convivir en dos reglas CSS a la vez.
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = matchMedia("(pointer: fine)").matches;
    if (reduced || !fine) return;
    const els = document.querySelectorAll<HTMLElement>(".card, .mod, .path, .map__node");
    const onMove = (e: PointerEvent) => {
      const el = e.currentTarget as HTMLElement;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(800px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateY(-3px)`;
    };
    const onLeave = (e: PointerEvent) => { (e.currentTarget as HTMLElement).style.transform = ""; };
    els.forEach((el) => {
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
    });
    return () => {
      els.forEach((el) => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerleave", onLeave);
      });
    };
  }, []);

  // Ripple del CTA: un círculo de luz nace en el punto exacto del click y se
  // expande. Vía CSS variables + una clase que se retira sola al terminar la
  // animación — no hay temporizador que pueda desincronizarse.
  const ripple = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--rx", `${e.clientX - r.left}px`);
    el.style.setProperty("--ry", `${e.clientY - r.top}px`);
    el.classList.remove("is-rippling");
    // Forzar reflow: sin esto, quitar y volver a poner la clase en el mismo
    // tick no reinicia la animación si el botón se pulsa dos veces seguidas.
    void el.offsetWidth;
    el.classList.add("is-rippling");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      brand: String(fd.get("brand") ?? "") || undefined,
      email: String(fd.get("email") ?? ""),
      message: String(fd.get("message") ?? "") || undefined,
      interest,
    };
    const parsed = leadSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Revisa el formulario");
      return;
    }
    setSubmitting(true);
    const { name, email, brand, message, interest: i } = parsed.data;
    const leadId = crypto.randomUUID();
    const { error } = await supabase
      .from("landing_leads")
      .insert([{ id: leadId, name, email, brand, message, interest: i }]);
    setSubmitting(false);
    if (error) {
      console.error("landing_leads insert error:", error);
      toast.error("No pudimos enviar tu mensaje. Intenta de nuevo.");
      return;
    }
    // Fire-and-forget email notification (no bloquea el éxito del form)
    supabase.functions
      .invoke("send-landing-lead-notification", {
        body: { leadId, name, email, brand, interest: i, message: message ?? "" },
      })
      .catch((err) => console.error("send-landing-lead-notification failed:", err));
    toast.success("Recibido. Volvemos en menos de 48h.");
    (e.target as HTMLFormElement).reset();
    setInterest("unsure");
  };

  const scrollTo = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  const chooseInterest = (next: "saas" | "tailor" | "unsure") => {
    setInterest(next);
    document.getElementById("hablemos")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="landing-bsystems">
      {/* Cortina de acento: golpe de color a pantalla completa, una sola vez
          por sesión, al cruzar el límite hero→cuerpo — ver el useEffect de
          arriba. Arranca oculta arriba del viewport (translateY(-100%)). */}
      <div ref={curtainRef} className="curtain" aria-hidden="true" />

      {/* Barra de progreso de scroll. El ancho lo escribe el listener de
          scroll directo por ref — ver el useEffect de arriba. */}
      <div className="scroll-progress" aria-hidden="true">
        <div ref={progressRef} className="scroll-progress__bar" />
      </div>

      {/* NAV */}
      <header className={scrolled ? "nav nav--scrolled" : "nav"}>
        <nav className="nav__inner">
          <Link to="/" className="nav__mark">
            <BrandMark variant="negative" style={{ fontSize: "1.625rem" }} />
          </Link>
          <div className="nav__links">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={activeSection === item.id ? "active" : undefined}
                onClick={scrollTo(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="nav__right">
            <Link to="/login" className="nav__login">Panel</Link>
            <button type="button" className="btn fill sm" onPointerDown={ripple} onClick={scrollTo("hablemos")}>
              Hablemos
            </button>
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <button type="button" aria-label="Abrir menú" className="nav__burger">
                  <Menu size={22} />
                </button>
              </SheetTrigger>
              {/* El panel se monta en un portal fuera de `.landing-bsystems`: sus
                  estilos van en la sección `.landing-sheet` de la hoja. */}
              <SheetContent side="right" className="landing-sheet w-[80vw] max-w-sm pt-12">
                {/* Radix exige un título en el diálogo para los lectores de
                    pantalla; visualmente no pinta nada aquí. */}
                <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
                <nav>
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setMobileNavOpen(false);
                        setTimeout(() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" }), 100);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>
                <div className="sheet__foot">
                  <Link to="/login" onClick={() => setMobileNavOpen(false)}>
                    Panel
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileNavOpen(false);
                      setTimeout(() => document.getElementById("hablemos")?.scrollIntoView({ behavior: "smooth" }), 100);
                    }}
                  >
                    Hablemos
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <header className="hero" ref={heroRef}>
        <ConfettiSphere />
        <p className="eyebrow">[B] Systems</p>
        <h1>
          Hacemos que tu empresa funcione <em>mejor</em>
        </h1>
        <p className="sub">
          Empieza con todo lo necesario para administrar y operar tu negocio: ventas, inventario, administración y reportes. Y cuando tu empresa necesite una operación específica, construimos B Systems alrededor de ella.
        </p>
        <p className="hero__offer">B Systems Start · $29.99/mes · sin costo de inicio</p>
        <div className="ctas">
          <button type="button" className="btn fill" onPointerDown={ripple} onClick={() => chooseInterest("saas")}>
            Empezar con Start
          </button>
          <button type="button" className="btn ghost" onClick={() => chooseInterest("tailor")}>
            Pedir presupuesto
          </button>
        </div>
      </header>

      <div className="below">
        {/* UNA PLATAFORMA, DOS FORMAS */}
        <section className="block reveal">
          <p className="kicker">Una plataforma. Dos formas de empezar.</p>
          <h2>Empieza hoy.<br />Crece sin quedarte corto.</h2>
          <div className="manifest manifest--two">
            <div><span className="n">01</span><h3>Start</h3><p>Una base lista para administrar y operar tu negocio.</p></div>
            <div><span className="n">02</span><h3>Custom</h3><p>B Systems construido alrededor de la operación específica de tu empresa.</p></div>
          </div>
          <p className="lede">No tienes que elegir entre un software cerrado o desarrollar todo desde cero.</p>
        </section>

        {/* DOS FORMAS DE EMPEZAR */}
        <section className="block reveal" id="start">
          <p className="kicker">Empieza con lo que necesitas</p>
          <h2>Dos formas de empezar</h2>
          <div className="paths">
            <article className="path">
              <div className="path__bar">
                <span className="path__dot r" />
                <span className="path__dot y" />
                <span className="path__dot g" />
                <span className="path__label">start.bsystems</span>
              </div>
              <div className="path__body">
                <p className="tag">Listo para empezar</p>
                <h3>B Systems Start</h3>
                <p className="path__price">$29.99 <small>/ mes</small></p>
                <p className="sub2">Pagado en bolívares a tasa BCV del día.</p>
                <span className="path__badge">Sin costo de inicio</span>
                <p className="sub2">Todo lo esencial para administrar y operar tu negocio desde un solo sistema.</p>
                <ul>
                  {["POS", "Inventario", "Administración", "Reportes"].map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <p className="path__note">Activa otros módulos de B Systems según cómo trabaja tu negocio.</p>
                <button
                  type="button"
                  className="btn fill"
                  onPointerDown={ripple}
                  onClick={() => chooseInterest("saas")}
                >
                  Empezar con Start
                </button>
              </div>
            </article>

            <article className="path dark" id="custom">
              <div className="path__bar">
                <span className="path__dot r" />
                <span className="path__dot y" />
                <span className="path__dot g" />
                <span className="path__label">custom.bsystems</span>
              </div>
              <div className="path__body">
                <p className="tag">A tu medida</p>
                <h3>B Systems Custom</h3>
                <p className="path__quote">Pedir presupuesto</p>
                <p className="sub2">Construimos B Systems alrededor de cómo opera tu empresa.</p>
                <ul>
                  {["Módulos a medida", "Integraciones", "Automatizaciones", "Flujos propios", "Dashboards", "Roles y permisos"].map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => chooseInterest("tailor")}
                >
                  Pedir presupuesto
                </button>
              </div>
            </article>
          </div>
        </section>

        {/* MÓDULOS — diagrama de conexión, mismo patrón que la pieza "puede
            conectar las partes clave de tu operación": nodo [B] arriba, las
            áreas que conecta debajo, antes de entrar al detalle de cada módulo. */}
        <section className="block reveal" id="modulos">
          <p className="kicker">Módulos B Systems</p>
          <div className="section-head">
            <div>
              <h2>Todo conectado en el mismo negocio.</h2>
              <p className="lede">
                Empieza con las herramientas esenciales y conecta nuevos módulos a medida que tu operación crece.
              </p>
            </div>
          </div>
          <div className="map">
            <div className="map__hub-wrap">
              <span className="map__hub" aria-hidden="true">[B]</span>
              <span className="map__stem" aria-hidden="true" />
            </div>
            <div className="map__grid">
              {operationMap.map((area) => (
                <span key={area} className="map__node">{area}</span>
              ))}
            </div>
          </div>
          <p className="module-group">Base Start</p>
          <div className="mods">
            {modules.slice(0, 4).map((m) => (
              <div key={m.n} className="mod">
                <div className="mod__head">
                  <span className="mod__icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                      <use href={`/icons.svg#${m.icon}`} />
                    </svg>
                  </span>
                  <span className="n">{m.n}</span>
                </div>
                <h3>{m.title}</h3>
                <p>{m.desc}</p>
              </div>
            ))}
          </div>
          <p className="module-group">Más módulos B Systems</p>
          <div className="mods">
            {modules.slice(4).map((m) => (
              <div key={m.n} className={m.wide ? "mod wide" : "mod"}>
                <div className="mod__head">
                  <span className="mod__icon"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><use href={`/icons.svg#${m.icon}`} /></svg></span>
                  <span className="n">{m.group}</span>
                </div>
                <h3>{m.title}</h3>
                <p>{m.desc}</p>
                {m.note && <p className="mod__note">{m.note}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* PERSONALIZACIÓN */}
        <section className="block reveal">
          <p className="kicker">Flexible por diseño</p>
          <h2>Tu operación, no una plantilla.</h2>
          <p className="lede">B Systems se configura alrededor de las personas, procesos y herramientas de tu empresa.</p>
          <div className="cards">
            {customization.map((c) => (
              <div key={c.title} className="card">
                <h3>{c.title}</h3>
                <p>{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* NO TODO NECESITA IA — árbol de decisión, mismo patrón que la pieza
            [B] Principle / 001. El listado de herramientas se conserva como
            respaldo técnico, degradado a nota al pie del bloque oscuro. */}
        <section className="block reveal">
          <p className="kicker">[B] Principle / 001</p>
          <h2>No todo necesita IA.</h2>
          <ol className="decision">
            {decisions.map((d) => (
              <li key={d.a}>
                <span className="decision__q">{d.q}</span>
                <span className="decision__a">{d.a}</span>
              </li>
            ))}
          </ol>
          <p className="decision__msg">Usamos lo que tenga sentido. No incorporamos IA porque esté de moda.</p>
          <div className="stackwrap">
            <p className="kicker" style={{ color: "var(--blue-300)" }}>Integraciones</p>
            <h3 className="integration-title">B Systems se conecta con tu operación.</h3>
            <p className="integration-copy">Podemos conectar B Systems con las herramientas que tu empresa ya utiliza.</p>
            <div className="marquee">
              <div className="marquee__track">
                {integrations.map((s) => (
                  <span key={s}>{s}</span>
                ))}
                <div aria-hidden="true" className="marquee__dup">
                  {integrations.map((s) => (
                    <span key={s}>{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RUBROS */}
        <section className="block reveal">
          <p className="kicker">B Systems Custom</p>
          <h2>B Systems se adapta a cómo opera tu empresa.</h2>
          <p className="lede">
            No todas las empresas trabajan igual. Por eso B Systems puede configurarse y construirse alrededor de cada operación.
          </p>
          <div className="cards three">
            {industries.map((i) => (
              <div key={i.title} className="card">
                <h3>{i.title}</h3>
                <p>{i.desc}</p>
              </div>
            ))}
          </div>
          <p className="custom-message">Tu empresa no tiene que adaptarse al software.<br />B Systems puede adaptarse a tu empresa.</p>
          <p className="lede">Estos son ejemplos de configuración, no productos prefabricados.</p>
        </section>

        {/* PROCESO — secuencia con flechas, mismo patrón que la pieza
            "después decidimos qué hacer" (01→02→03→04). */}
        <section className="block reveal" id="proceso">
          <p className="kicker">Cómo empezamos</p>
          <h2>Dos caminos.<br />El mismo sistema.</h2>
          <div className="process-paths">
            {(["start", "custom"] as const).map((kind) => (
              <div className={`process-path process-path--${kind}`} key={kind}>
                <h3>{kind}</h3>
                <ol className="steps">
                  {processes[kind].map((title, index) => <li key={title}><span className="n">0{index + 1}</span><h4>{title}</h4></li>)}
                </ol>
                <p>{kind === "start" ? "Empieza con una base lista y activa nuevas herramientas cuando tu negocio las necesite." : "Entendemos cómo opera tu empresa y construimos B Systems alrededor de ella."}</p>
              </div>
            ))}
          </div>
        </section>

        {/* BANDA DE MARCA */}
        <section className="band reveal">
          <div className="inner">
            <p className="k">[B] Systems</p>
            <h2>Producto.<br />Diseño.<br />Obsesión por el detalle.</h2>
          </div>
        </section>

        {/* CONTACTO */}
        <section className="block contact reveal" id="hablemos">
          <p className="kicker">Hablemos</p>
          <h2>¿Cómo podemos ayudarte?</h2>
          <p className="lede">
            Empieza con B Systems Start o cuéntanos qué necesitas construir. Respondemos en menos de 48 horas.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <Label>¿Qué te interesa?</Label>
              <RadioGroup
                value={interest}
                onValueChange={(v) => setInterest(v as typeof interest)}
                className="radio-row"
              >
                {([
                  ["saas", "Quiero B Systems Start"],
                  ["tailor", "Quiero uno a medida"],
                  ["unsure", "Aún no lo sé"],
                ] as const).map(([v, l]) => (
                  <label key={v} htmlFor={`interest-${v}`} className={interest === v ? "on" : undefined}>
                    <RadioGroupItem value={v} id={`interest-${v}`} />
                    <span>{l}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="field-row">
              <div className="field">
                <Label htmlFor="name">Nombre *</Label>
                <Input id="name" name="name" required maxLength={100} />
              </div>
              <div className="field">
                <Label htmlFor="brand">Marca</Label>
                <Input id="brand" name="brand" maxLength={100} />
              </div>
            </div>
            <div className="field">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" required maxLength={255} />
            </div>
            <div className="field">
              <Label htmlFor="message">Cuéntanos cómo trabaja tu empresa hoy</Label>
              <Textarea id="message" name="message" rows={5} maxLength={1000} />
            </div>
            <button type="submit" className="btn fill" onPointerDown={ripple} disabled={submitting}>
              {submitting && <span className="spinner" aria-hidden="true" />}
              {submitting ? "Enviando..." : "Enviar"}
            </button>
          </form>
        </section>

        {/* FOOTER — la misma decisión Start / Custom del hero. */}
        <footer className="foot">
          <div className="foot__top">
            <BrandMark variant="negative" style={{ fontSize: "1.625rem" }} />
          </div>
          <div className="foot__cols">
            <div className="foot__col">
              <p className="foot__col-title">Start</p>
              <button
                type="button"
                onClick={() => chooseInterest("saas")}
              >
                Empezar →
              </button>
            </div>
            <div className="foot__col">
              <p className="foot__col-title">Custom</p>
              <button
                type="button"
                onClick={() => chooseInterest("tailor")}
              >
                Pedir presupuesto →
              </button>
            </div>
            <div className="foot__col">
              <p className="foot__col-title">Empresa</p>
              <Link to="/login">Ir al panel →</Link>
            </div>
          </div>
          <p className="foot__tagline">Hacemos que tu empresa funcione mejor.</p>
          <p className="foot__copy">© 2026 [B] SYSTEMS</p>
        </footer>
      </div>
    </div>
  );
}
