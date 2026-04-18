import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import {
  ShoppingBag,
  Users,
  Calendar,
  HardHat,
  Megaphone,
  Phone,
  Building2,
  LayoutDashboard,
  Palette,
  Blocks,
  Shield,
  Plug,
  Shirt,
  Utensils,
  Hotel,
  Briefcase,
  Sparkles,
  Store,
  ArrowRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import heroImg from "@/assets/landing-hero.jpg";
import caseImg from "@/assets/landing-case-basico.jpg";

const leadSchema = z.object({
  name: z.string().trim().min(2, "Nombre muy corto").max(100),
  brand: z.string().trim().max(100).optional(),
  email: z.string().trim().email("Email inválido").max(255),
  message: z.string().trim().max(1000).optional(),
  interest: z.enum(["saas", "tailor", "unsure"]),
});

const modules = [
  { n: "01", title: "Pedidos", desc: "Sync con tu e-commerce, estados, costos y márgenes en vivo.", icon: ShoppingBag },
  { n: "02", title: "CRM", desc: "Clientes unificados, segmentación y comportamiento de compra.", icon: Users },
  { n: "03", title: "Planning", desc: "Calendario editorial sincronizado con Notion y tu equipo.", icon: Calendar },
  { n: "04", title: "Crew", desc: "RRHH completo: nómina, documentos, incidencias y tareas.", icon: HardHat },
  { n: "05", title: "RRPP", desc: "Red de influencers, colaboraciones, cupones y métricas.", icon: Sparkles },
  { n: "06", title: "Campañas", desc: "Email marketing, audiencias y resultados en un solo lugar.", icon: Megaphone },
  { n: "07", title: "Llamadas", desc: "Telefonía conectada, grabaciones y analítica por agente.", icon: Phone },
  { n: "08", title: "Administración", desc: "Obligaciones, vencimientos y control financiero.", icon: Building2 },
];

const customization = [
  { title: "Branding", desc: "Tus colores, tu logo, tu tipografía. Sin rastro de Basico.", icon: Palette },
  { title: "Módulos", desc: "Activa solo los que tu marca necesita. Apaga el resto.", icon: Blocks },
  { title: "Roles y permisos", desc: "RBAC configurable. Define quién ve y hace qué.", icon: Shield },
  { title: "Integraciones", desc: "Conectamos las herramientas que ya usas. No al revés.", icon: Plug },
];

const industries = [
  { title: "Moda", desc: "Stock, drops, devoluciones y RRPP.", icon: Shirt },
  { title: "Restauración", desc: "Reservas, inventario, turnos y delivery.", icon: Utensils },
  { title: "Hospitality", desc: "Reservas, housekeeping y experiencia.", icon: Hotel },
  { title: "Servicios", desc: "Clientes, propuestas, horas y facturación.", icon: Briefcase },
  { title: "Eventos", desc: "Productores, proveedores, agenda y caja.", icon: Sparkles },
  { title: "Retail físico", desc: "POS, stock por tienda, equipo y cliente.", icon: Store },
];

const process = [
  { n: "01", title: "Discovery", desc: "Entendemos tu operación real. 1–2 semanas." },
  { n: "02", title: "Diseño", desc: "Mapeamos módulos, datos y permisos." },
  { n: "03", title: "Construcción", desc: "Iteramos cada semana con tu equipo dentro." },
  { n: "04", title: "Operación", desc: "Soporte continuo y evolución del sistema." },
];

const stack = [
  "Lovable Cloud", "Claude", "GPT", "Gemini", "Supabase", "WooCommerce", "Brevo", "Notion", "Zadarma",
];

export default function Landing() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [interest, setInterest] = useState<"saas" | "tailor" | "unsure">("unsure");

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
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* NAV */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-background/70 border-b border-border/40">
        <nav className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-8 py-4">
          <Link to="/" className="font-black uppercase tracking-tight text-lg sm:text-xl">
            Basico <span className="text-primary">/</span> Systems
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium uppercase tracking-wide">
            <button onClick={scrollTo("dos-formas")} className="hover:text-primary transition-colors">Empezar</button>
            <button onClick={scrollTo("modulos")} className="hover:text-primary transition-colors">Módulos</button>
            <button onClick={scrollTo("caso")} className="hover:text-primary transition-colors">Caso</button>
            <button onClick={scrollTo("contacto")} className="hover:text-primary transition-colors">Proceso</button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" className="hidden sm:inline text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
              {user ? "Panel" : "Acceso equipo"}
            </Link>
            <Button variant="brand" size="sm" onClick={scrollTo("contacto")}>Hablemos</Button>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden bg-foreground text-background">
        <img src={heroImg} alt="" width={1920} height={1080} className="absolute inset-0 w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/60 via-foreground/40 to-foreground" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full">
          <p className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-primary mb-6 sm:mb-8 animate-fade-in">
            <span className="w-8 h-px bg-primary" /> Estudio de sistemas · IA aplicada
          </p>
          <h1 className="font-black uppercase tracking-tight leading-[0.95] text-4xl sm:text-6xl lg:text-7xl xl:text-8xl max-w-5xl animate-fade-in">
            Sistemas operativos para marcas que <span className="text-primary">no caben</span> en un SaaS genérico
          </h1>
          <p className="mt-6 sm:mt-8 max-w-2xl text-base sm:text-lg lg:text-xl text-background/70 leading-relaxed animate-fade-in">
            Empieza con Basico Systems. Evoluciona a un sistema 100% a medida cuando tu operación lo pida.
          </p>
          <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row gap-3 sm:gap-4 animate-fade-in">
            <Button variant="brand" size="lg" onClick={scrollTo("dos-formas")} className="w-full sm:w-auto">
              Probar Basico Systems <ArrowRight className="ml-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={scrollTo("contacto")}
              className="w-full sm:w-auto bg-transparent border-background/40 text-background hover:bg-background hover:text-foreground uppercase font-bold tracking-wide"
            >
              Quiero uno a medida
            </Button>
          </div>
        </div>
      </section>

      {/* MANIFIESTO */}
      <section className="py-20 sm:py-32 px-4 sm:px-8 lg:px-16">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-primary mb-8">No somos un SaaS</p>
          <div className="grid md:grid-cols-3 gap-10 sm:gap-12">
            {[
              "No alquilas software. Te construimos uno.",
              "No te adaptas al producto. El sistema se adapta a ti.",
              "No pagas por features que no usas. Pagas por lo que tu operación necesita.",
            ].map((line, i) => (
              <div key={i} className="border-t-2 border-foreground pt-6">
                <span className="block text-sm font-mono text-muted-foreground mb-3">0{i + 1}</span>
                <p className="text-2xl sm:text-3xl font-black uppercase tracking-tight leading-tight">{line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DOS FORMAS DE EMPEZAR */}
      <section id="dos-formas" className="py-20 sm:py-32 px-4 sm:px-8 lg:px-16 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 sm:mb-16">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-primary mb-4">Dos caminos</p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight">Dos formas de empezar</h2>
          </div>
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
            {/* SaaS */}
            <article className="bg-background border border-border p-8 sm:p-10 lg:p-12 flex flex-col">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary mb-4">Producto</p>
              <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-2">Basico Systems</h3>
              <p className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-muted-foreground mb-8">Arranca en días</p>
              <ul className="space-y-4 mb-10 flex-1">
                {[
                  "8 módulos listos: Pedidos, CRM, Planning, Crew, RRPP, Campañas, Llamadas, Administración",
                  "Personalizable: branding, roles, flujos y campos",
                  "Integraciones nativas: WooCommerce, Brevo, Notion, Zadarma",
                  "Onboarding guiado con tu equipo",
                ].map((b) => (
                  <li key={b} className="flex gap-3 text-sm sm:text-base">
                    <Check className="text-primary shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant="default"
                size="lg"
                onClick={() => { setInterest("saas"); scrollTo("contacto")(); }}
                className="w-full uppercase font-bold tracking-wide"
              >
                Solicitar acceso <ArrowRight />
              </Button>
            </article>

            {/* Tailor */}
            <article className="bg-foreground text-background border border-foreground p-8 sm:p-10 lg:p-12 flex flex-col">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary mb-4">Estudio</p>
              <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-2">Tailor-made</h3>
              <p className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-background/60 mb-8">Construido para tu operación</p>
              <ul className="space-y-4 mb-10 flex-1">
                {[
                  "Discovery profundo de tu negocio",
                  "Módulos nuevos diseñados desde cero",
                  "Integraciones con cualquier herramienta",
                  "Soporte y evolución continua",
                ].map((b) => (
                  <li key={b} className="flex gap-3 text-sm sm:text-base">
                    <Check className="text-primary shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant="brand"
                size="lg"
                onClick={() => { setInterest("tailor"); scrollTo("contacto")(); }}
                className="w-full"
              >
                Hablar con el estudio <ArrowRight />
              </Button>
            </article>
          </div>
        </div>
      </section>

      {/* MÓDULOS */}
      <section id="modulos" className="py-20 sm:py-32 px-4 sm:px-8 lg:px-16">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 sm:mb-16 max-w-3xl">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-primary mb-4">El producto</p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight mb-6">Qué incluye Basico Systems hoy</h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Estos son los módulos en producción. En tailor-made, los combinamos, modificamos o construimos nuevos.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.n} className="bg-background p-6 sm:p-8 group hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between mb-6">
                    <span className="text-3xl font-mono text-muted-foreground/60">{m.n}</span>
                    <Icon className="text-foreground/80 group-hover:text-primary transition-colors" size={24} />
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-tight mb-2">{m.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PERSONALIZACIÓN */}
      <section className="py-20 sm:py-32 px-4 sm:px-8 lg:px-16 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 sm:mb-16 max-w-3xl">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-primary mb-4">Personalización</p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight">Tu marca, no la nuestra.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {customization.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.title} className="bg-background border border-border p-6 sm:p-8">
                  <Icon className="text-primary mb-6" size={28} />
                  <h3 className="text-lg font-black uppercase tracking-tight mb-2">{c.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* STACK & AI */}
      <section className="py-20 sm:py-32 px-4 sm:px-8 lg:px-16 bg-foreground text-background">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-primary mb-4">Stack</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight mb-4">
            Construido con las mejores herramientas de IA
          </h2>
          <p className="text-base sm:text-lg text-background/70 mb-12 max-w-2xl mx-auto">
            Integramos los modelos y servicios que tu operación necesita.
          </p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 sm:gap-x-12 mb-8">
            {stack.map((s) => (
              <span key={s} className="text-sm sm:text-base font-bold uppercase tracking-wider text-background/80">{s}</span>
            ))}
          </div>
          <p className="text-sm text-background/50">Si tu marca usa otras herramientas, las integramos.</p>
        </div>
      </section>

      {/* CASO BASICO */}
      <section id="caso" className="py-20 sm:py-32 px-4 sm:px-8 lg:px-16">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-primary mb-4">Caso 01</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight mb-12 sm:mb-16">Basico Clothes</h2>
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-start">
            <div className="aspect-[3/4] overflow-hidden bg-muted">
              <video
                src="/landingasset.mp4"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-lg sm:text-xl leading-relaxed mb-8">
                Basico Clothes opera hoy sobre Basico Systems + módulos a medida construidos por el estudio.
                Una sola fuente de verdad para pedidos, clientes, equipo y finanzas.
              </p>
              <div className="grid grid-cols-2 gap-px bg-border mb-10">
                {[
                  ["8", "Módulos en producción"],
                  ["4", "Integraciones en vivo"],
                  ["5", "Roles RBAC"],
                  ["24/7", "Sync automática"],
                ].map(([n, l]) => (
                  <div key={l} className="bg-background p-6">
                    <div className="text-4xl sm:text-5xl font-black tracking-tight">{n}</div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mt-2">{l}</div>
                  </div>
                ))}
              </div>
              <ul className="space-y-3">
                {[
                  "Una sola fuente de verdad. Adiós a los Excels paralelos.",
                  "Costos y márgenes en tiempo real, por pedido y por SKU.",
                  "Calendario editorial sincronizado con Notion.",
                  "Telefonía, RRHH y RRPP unificados con el e-commerce.",
                ].map((b) => (
                  <li key={b} className="flex gap-3 text-sm sm:text-base">
                    <Check className="text-primary shrink-0 mt-1" size={18} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <a
                href="https://basicoclothes.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-8 text-sm font-bold uppercase tracking-wider text-primary hover:gap-3 transition-all"
              >
                Ver basicoclothes.com <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* RUBROS */}
      <section className="py-20 sm:py-32 px-4 sm:px-8 lg:px-16 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 sm:mb-16 max-w-3xl">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-primary mb-4">Adaptable</p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight mb-6">Da igual el rubro</h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Lo que cambia es el negocio. Lo que se mantiene es el método. Cada rubro arranca con Basico Systems y crece a medida según el negocio.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {industries.map((i) => {
              const Icon = i.icon;
              return (
                <div key={i.title} className="bg-background border border-border p-6 sm:p-8 flex gap-5 items-start">
                  <Icon className="text-primary shrink-0" size={28} />
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight mb-1">{i.title}</h3>
                    <p className="text-sm text-muted-foreground">{i.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PROCESO */}
      <section className="py-20 sm:py-32 px-4 sm:px-8 lg:px-16 bg-foreground text-background">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 sm:mb-16">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-primary mb-4">Cómo trabajamos</p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight">Proceso</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-background/10">
            {process.map((p) => (
              <div key={p.n} className="bg-foreground p-8">
                <div className="text-5xl font-black text-primary mb-4">{p.n}</div>
                <h3 className="text-lg font-black uppercase tracking-tight mb-2">{p.title}</h3>
                <p className="text-sm text-background/60 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BANNER POWERED BY */}
      <section className="py-20 sm:py-32 px-4 sm:px-8 lg:px-16 bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] mb-6 opacity-80">Un área de Basico</p>
          <p className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight leading-[0.95]">
            El mismo ADN: producto, diseño, obsesión por el detalle.
          </p>
          <a
            href="https://basicoclothes.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-8 text-sm font-bold uppercase tracking-wider hover:gap-3 transition-all"
          >
            basicoclothes.com <ArrowRight size={16} />
          </a>
        </div>
      </section>

      {/* CTA / CONTACTO */}
      <section id="contacto" className="py-20 sm:py-32 px-4 sm:px-8 lg:px-16 bg-foreground text-background">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-primary mb-4">Empecemos</p>
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight mb-6">
              ¿Listo para que tu marca opere como Basico?
            </h2>
            <p className="text-base sm:text-lg text-background/70">
              Cuéntanos cómo opera tu marca hoy. Volvemos en menos de 48h con un primer mapa.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 bg-background text-foreground p-6 sm:p-10 border border-background/20">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider mb-3 block">¿Qué te interesa?</Label>
              <RadioGroup value={interest} onValueChange={(v) => setInterest(v as typeof interest)} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  ["saas", "Probar Basico Systems"],
                  ["tailor", "Construir uno a medida"],
                  ["unsure", "Aún no lo sé"],
                ] as const).map(([v, l]) => (
                  <label
                    key={v}
                    htmlFor={`interest-${v}`}
                    className={`flex items-center gap-3 border p-4 cursor-pointer transition-colors ${
                      interest === v ? "border-primary bg-primary/5" : "border-border hover:border-foreground/40"
                    }`}
                  >
                    <RadioGroupItem value={v} id={`interest-${v}`} />
                    <span className="text-sm font-medium">{l}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider">Nombre *</Label>
                <Input id="name" name="name" required maxLength={100} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="brand" className="text-xs font-bold uppercase tracking-wider">Marca</Label>
                <Input id="brand" name="brand" maxLength={100} className="mt-2" />
              </div>
            </div>
            <div>
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider">Email *</Label>
              <Input id="email" name="email" type="email" required maxLength={255} className="mt-2" />
            </div>
            <div>
              <Label htmlFor="message" className="text-xs font-bold uppercase tracking-wider">Cuéntanos sobre tu operación</Label>
              <Textarea id="message" name="message" rows={5} maxLength={1000} className="mt-2" />
            </div>
            <Button type="submit" variant="brand" size="lg" className="w-full" disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar"} {!submitting && <ArrowRight />}
            </Button>
          </form>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-10 px-4 sm:px-8 lg:px-16">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Basico Systems · Un área de Basico · {new Date().getFullYear()}
          </p>
          <div className="flex items-center gap-6">
            <a href="https://basicoclothes.com" target="_blank" rel="noopener noreferrer" className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
              basicoclothes.com
            </a>
            <Link to="/login" className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
              {user ? "Ir al panel" : "Acceso equipo"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
