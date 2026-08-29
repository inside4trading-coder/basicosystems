import { useState, FormEvent } from "react";
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
import { useAuth } from "@/hooks/useAuth";
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
  { n: "01", title: "Pedidos", desc: "Sync con tu e-commerce, estados, costos y márgenes en vivo.", icon: "bsys-cart" },
  { n: "02", title: "CRM", desc: "Clientes unificados, segmentación y comportamiento de compra.", icon: "bsys-user" },
  { n: "03", title: "Planning", desc: "Calendario editorial sincronizado con Notion y tu equipo.", icon: "bsys-clock" },
  { n: "04", title: "Crew", desc: "RRHH completo: nómina, documentos, incidencias y tareas.", icon: "bsys-users" },
  { n: "05", title: "RRPP", desc: "Red de influencers, colaboraciones, cupones y métricas.", icon: "bsys-branch" },
  { n: "06", title: "Campañas", desc: "Email marketing, audiencias y resultados en un solo lugar.", icon: "bsys-mail" },
  { n: "07", title: "Llamadas", desc: "Telefonía conectada, grabaciones y analítica por agente.", icon: "bsys-chat" },
  { n: "08", title: "Administración", desc: "Obligaciones, vencimientos y control financiero.", icon: "bsys-file" },
  { n: "09", title: "Core", desc: "Fabricación completa: costos por prenda, órdenes de producción, partidas y nómina de taller.", icon: "bsys-terminal", wide: true },
  { n: "10", title: "Retail", desc: "POS de tienda, catálogo sincronizado con WooCommerce e inventario en un solo stock.", icon: "bsys-tag", wide: true },
];

const customization = [
  { title: "Branding", desc: "Tus colores, tu logo, tu tipografía. Sin rastro de Basico." },
  { title: "Módulos", desc: "Activa solo los que tu marca necesita. Apaga el resto." },
  { title: "Roles y permisos", desc: "RBAC configurable. Define quién ve y hace qué." },
  { title: "Integraciones", desc: "Conectamos las herramientas que ya usas. No al revés." },
];

const industries = [
  { title: "Moda", desc: "Stock, drops, devoluciones y RRPP." },
  { title: "Restauración", desc: "Reservas, inventario, turnos y delivery." },
  { title: "Hospitality", desc: "Reservas, housekeeping y experiencia." },
  { title: "Servicios", desc: "Clientes, propuestas, horas y facturación." },
  { title: "Eventos", desc: "Productores, proveedores, agenda y caja." },
  { title: "Retail físico", desc: "POS, stock por tienda, equipo y cliente." },
];

const process = [
  { n: "01", title: "Discovery", desc: "Entendemos tu operación real. 1–2 semanas." },
  { n: "02", title: "Diseño", desc: "Mapeamos módulos, datos y permisos." },
  { n: "03", title: "Construcción", desc: "Iteramos cada semana con tu equipo dentro." },
  { n: "04", title: "Operación", desc: "Soporte continuo y evolución del sistema." },
];

const stack = [
  "LangChain", "RAG", "Claude", "Shopify", "WooCommerce", "Supabase", "Vercel",
  "Antigravity", "Cursor", "Zadarma", "n8n", "Docker", "Obsidian",
];

const navItems = [
  { id: "dos-formas", label: "Empezar" },
  { id: "modulos", label: "Módulos" },
  { id: "proceso", label: "Proceso" },
];

export default function Landing() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [interest, setInterest] = useState<"saas" | "tailor" | "unsure">("unsure");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  return (
    <div className="landing-bsystems">
      {/* NAV */}
      <header className="nav">
        <nav className="nav__inner">
          <Link to="/" className="nav__mark">
            <BrandMark variant="negative" style={{ fontSize: "1.625rem" }} />
          </Link>
          <div className="nav__links">
            {navItems.map((item) => (
              <button key={item.id} type="button" onClick={scrollTo(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="nav__right">
            <Link to="/login" className="nav__login">
              {user ? "Panel" : "Acceso equipo"}
            </Link>
            <button type="button" className="btn fill sm" onClick={scrollTo("contacto")}>
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
                    {user ? "Panel" : "Acceso equipo"}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileNavOpen(false);
                      setTimeout(() => document.getElementById("contacto")?.scrollIntoView({ behavior: "smooth" }), 100);
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
      <header className="hero">
        <ConfettiSphere />
        <p className="eyebrow">Estudio de sistemas · IA aplicada</p>
        <h1>
          Sistemas operativos para marcas que <em>no caben</em> en un SaaS genérico
        </h1>
        <p className="sub">
          Empieza con Basico System. Evoluciona a un sistema 100% a medida cuando tu operación lo pida.
        </p>
        <div className="ctas">
          <button type="button" className="btn fill" onClick={scrollTo("dos-formas")}>
            Probar Basico System
          </button>
          <button type="button" className="btn ghost" onClick={scrollTo("contacto")}>
            Quiero uno a medida
          </button>
        </div>
      </header>

      <div className="below">
        {/* MANIFIESTO */}
        <section className="block">
          <p className="kicker">No somos un SaaS</p>
          <div className="manifest">
            {[
              "No alquilas software. Te construimos uno.",
              "No te adaptas al producto. El sistema se adapta a ti.",
              "No pagas por features que no usas. Pagas por lo que tu operación necesita.",
            ].map((line, i) => (
              <div key={line}>
                <span className="n">0{i + 1}</span>
                <p>{line}</p>
              </div>
            ))}
          </div>
        </section>

        {/* DOS FORMAS DE EMPEZAR */}
        <section className="block" id="dos-formas">
          <p className="kicker">Dos caminos</p>
          <h2>Dos formas de empezar</h2>
          <div className="paths">
            <article className="path">
              <div className="path__bar">
                <span className="path__dot r" />
                <span className="path__dot y" />
                <span className="path__dot g" />
                <span className="path__label">basico.systems</span>
              </div>
              <div className="path__body">
                <p className="tag">Producto</p>
                <h3>Basico System</h3>
                <p className="sub2">Arranca en días</p>
                <ul>
                  {[
                    "10 módulos listos: Pedidos, CRM, Planning, Crew, RRPP, Campañas, Llamadas, Administración, Core y Retail",
                    "Personalizable: branding, roles, flujos y campos",
                    "Integraciones nativas: WooCommerce, Brevo, Notion, Zadarma",
                    "Onboarding guiado con tu equipo",
                  ].map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn fill"
                  onClick={() => { setInterest("saas"); scrollTo("contacto")(); }}
                >
                  Solicitar acceso
                </button>
              </div>
            </article>

            <article className="path dark">
              <div className="path__bar">
                <span className="path__dot r" />
                <span className="path__dot y" />
                <span className="path__dot g" />
                <span className="path__label">estudio.basico.systems</span>
              </div>
              <div className="path__body">
                <p className="tag">Estudio</p>
                <h3>Tailor-made</h3>
                <p className="sub2">Construido para tu operación</p>
                <ul>
                  {[
                    "Discovery profundo de tu negocio",
                    "Módulos nuevos diseñados desde cero",
                    "Integraciones con cualquier herramienta",
                    "Soporte y evolución continua",
                  ].map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => { setInterest("tailor"); scrollTo("contacto")(); }}
                >
                  Hablar con el estudio
                </button>
              </div>
            </article>
          </div>
        </section>

        {/* MÓDULOS */}
        <section className="block" id="modulos">
          <p className="kicker">El producto</p>
          <h2>Qué incluye Basico System hoy</h2>
          <p className="lede">
            Estos son los módulos en producción. En tailor-made, los combinamos, modificamos o construimos nuevos.
          </p>
          <div className="mods">
            {modules.map((m) => (
              <div key={m.n} className={m.wide ? "mod wide" : "mod"}>
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
        </section>

        {/* PERSONALIZACIÓN */}
        <section className="block">
          <p className="kicker">Personalización</p>
          <h2>Tu marca, no la nuestra.</h2>
          <div className="cards">
            {customization.map((c) => (
              <div key={c.title} className="card">
                <h3>{c.title}</h3>
                <p>{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* STACK */}
        <section className="block">
          <p className="kicker">Stack</p>
          <h2>Construido con las mejores herramientas de IA</h2>
          <p className="lede">Integramos los modelos y servicios que tu operación necesita.</p>
          <div className="stackwrap">
            <div className="stackrow">
              {stack.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <p className="stacknote">Si tu marca usa otras herramientas, las integramos.</p>
          </div>
        </section>

        {/* RUBROS */}
        <section className="block">
          <p className="kicker">Adaptable</p>
          <h2>Da igual el rubro</h2>
          <p className="lede">
            Lo que cambia es el negocio. Lo que se mantiene es el método. Cada rubro arranca con
            Basico System y crece a medida según el negocio.
          </p>
          <div className="cards three">
            {industries.map((i) => (
              <div key={i.title} className="card">
                <h3>{i.title}</h3>
                <p>{i.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PROCESO */}
        <section className="block" id="proceso">
          <p className="kicker">Cómo trabajamos</p>
          <h2>Proceso</h2>
          <ul className="steps">
            {process.map((p) => (
              <li key={p.n}>
                <span className="n">{p.n}</span>
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* BANDA DE MARCA */}
        <section className="band">
          <div className="inner">
            <p className="k">Un área de Basico</p>
            <h2>El mismo ADN: producto, diseño, obsesión por el detalle.</h2>
            <a href="https://basicoclothes.com" target="_blank" rel="noopener noreferrer">
              basicoclothes.com
            </a>
          </div>
        </section>

        {/* CONTACTO */}
        <section className="block contact" id="contacto">
          <p className="kicker">Empecemos</p>
          <h2>¿Listo para que tu marca opere como Basico?</h2>
          <p className="lede">
            Cuéntanos cómo opera tu marca hoy. Volvemos en menos de 48 h con un primer mapa.
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
                  ["saas", "Probar Basico System"],
                  ["tailor", "Construir uno a medida"],
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
              <Label htmlFor="message">Cuéntanos sobre tu operación</Label>
              <Textarea id="message" name="message" rows={5} maxLength={1000} />
            </div>
            <button type="submit" className="btn fill" disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar"}
            </button>
          </form>
        </section>

        {/* FOOTER */}
        <footer className="foot">
          <div className="foot__inner">
            <div className="foot__brand">
              <BrandMark variant="negative" style={{ fontSize: "1.375rem" }} />
              <p>Basico System · Un área de Basico · {new Date().getFullYear()}</p>
            </div>
            <div className="foot__links">
              <a href="https://basicoclothes.com" target="_blank" rel="noopener noreferrer">
                basicoclothes.com
              </a>
              <Link to="/login">{user ? "Ir al panel" : "Acceso equipo"}</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
