import { useState, useEffect } from "react";
import { BrandMark } from "../components/BrandMark";
import { ConfettiSphere } from "../components/landing/ConfettiSphere";
import "../components/landing/landing-bsystems.css";

export function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [activePillar, setActivePillar] = useState<"ordenar" | "conectar" | "automatizar">("ordenar");
  const [activeArea, setActiveArea] = useState<string>("ventas");
  const [beforeAfter, setBeforeAfter] = useState(50);
  const [processStep, setProcessStep] = useState(0);
  const [formData, setFormData] = useState({
    nombre: "",
    empresa: "",
    email: "",
    mensaje: "",
    interes: "ordenar"
  });
  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProcessStep(prev => (prev + 1) % 5);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const pillars = {
    ordenar: {
      title: "ORDENAR",
      subtitle: "Cuando la información, las tareas y los procesos están repartidos.",
      visual: (
        <div className="pillar-visual">
          <div className="chaos-grid">
            <div className="chaos-item">📄 12 archivos</div>
            <div className="chaos-item">💬 4 conversaciones</div>
            <div className="chaos-item">👤 3 responsables</div>
          </div>
          <div className="arrow-down">↓</div>
          <div className="order-result">
            <div className="order-card">✓ 1 proceso claro</div>
          </div>
        </div>
      )
    },
    conectar: {
      title: "CONECTAR",
      subtitle: "Las herramientas y áreas que ya tienes empiezan a trabajar juntas.",
      visual: (
        <div className="pillar-visual">
          <div className="connect-diagram">
            <div className="connect-center">[B]</div>
            <div className="connect-node top">Ventas</div>
            <div className="connect-node right">Inventario</div>
            <div className="connect-node bottom">Finanzas</div>
            <div className="connect-node left">Equipo</div>
            <div className="connect-line line-1"></div>
            <div className="connect-line line-2"></div>
            <div className="connect-line line-3"></div>
            <div className="connect-line line-4"></div>
          </div>
        </div>
      )
    },
    automatizar: {
      title: "AUTOMATIZAR",
      subtitle: "Tu equipo deja de perder tiempo repitiendo tareas que pueden resolverse automáticamente.",
      visual: (
        <div className="pillar-visual">
          <div className="automation-flow">
            <div className="auto-step">Pedido recibido</div>
            <div className="auto-check">✓ stock actualizado</div>
            <div className="auto-check">✓ documento creado</div>
            <div className="auto-check">✓ equipo avisado</div>
            <div className="auto-check">✓ seguimiento programado</div>
          </div>
        </div>
      )
    }
  };

  const areas = {
    ventas: {
      title: "VENTAS",
      desc: "Todos tus pedidos y clientes en un mismo lugar.",
      icon: "📦"
    },
    inventario: {
      title: "INVENTARIO",
      desc: "Sabes qué tienes, dónde está y qué está por acabarse.",
      icon: "📊"
    },
    produccion: {
      title: "PRODUCCION",
      desc: "Sabes qué se está haciendo, qué falta y cuánto cuesta.",
      icon: "⚙️"
    },
    finanzas: {
      title: "FINANZAS",
      desc: "Sabes cuánto entró·¿¿, cuánto salió y en qué.",
      icon: "💰"
    },
    equipo: {
      title: "EQUIPO",
      desc: "Cada persona sabe qué tiene que hacer.",
      icon: "👥"
    },
    clientes: {
      title: "CLIENTES",
      desc: "Informacion y seguimiento conectados.",
      icon: "🤝"
    },
    compras: {
      title: "COMPRAS",
      desc: "Necesidades, proveedores y pagos bajo control.",
      icon: "🛒"
    }
  };

  const faqs = [
    {
      q: "Tengo que cambiar las herramientas que ya utilizo?",
      a: "No. Hacemos que las herramientas que ya usas trabajen juntas. No necesitas reemplazar todo."
    },
    {
      q: "Todo necesita IA?",
      a: "No. Usamos IA solo cuando realmente aporta. Muchas veces basta con una regla sencilla o una automatizacion."
    },
    {
      q: "Podeis empezar solamente por un proceso?",
      a: "Sí·¿. Empezamos por lo que más duele hoy y vamos expandiendo el sistema."
    },
    {
      q: "Constru is herramientas a medida?",
      a: "Sí·¿. Diseñ¿·¿amos el sistema alrededor de cómo funciona tu empresa, no al revé·¿s."
    },
    {
      q: "C ómo empieza un proyecto?",
      a: "Primero entendemos cómo trabajas. Después te enseñamos cómo podría funcionar mejor."
    }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div className="landing-bsystems">
      {/* NAV */}
      <nav className={`landing-nav ${scrolled ? "scrolled" : ""}`}>
        <div className="nav-content">
          <BrandMark size="small" />
          <div className="nav-links">
            <a href="#problema">El problema</a>
            <a href="#pilares">Qué·¿ hacemos</a>
            <a href="#antes-despues">Resultados</a>
            <a href="#areas">Lo que construimos</a>
            <a href="#proceso">C ómo trabajamos</a>
          </div>
          <a href="#contacto" className="nav-cta">Cu éntanos cómo trabajas</a>
        </div>
      </nav>

      {/* 01 — HERO */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-text">
            <h1>Hacemos que tu empresa funcione mejor.</h1>
            <p className="hero-subtitle">
              Estudiamos cómo trabajas, encontramos lo que te hace perder tiempo
              y construimos una forma mejor de hacerlo.
            </p>
            <div className="hero-ctas">
              <a href="#contacto" className="btn-primary">Cu éntanos cómo trabajas</a>
              <a href="#proceso" className="btn-secondary">Ver cómo funciona</a>
            </div>
          </div>
          <div className="hero-animation">
            <ConfettiSphere />
          </div>
        </div>
        
        {/* Animated process explanation */}
        <div className="process-explainer">
          <div className="process-steps">
            {[
              { before: "Pedido", after: "Pedido", during: "[B] SYSTEMS" },
              { before: "Email", after: "Inventario actualizado", during: "" },
              { before: "Excel", after: "Administraci ón informada", during: "" },
              { before: "WhatsApp", after: "Equipo avisado", during: "" },
              { before: "Inventario", after: "Informaci ón conectada", during: "" },
              { before: "Administraci ón", after: "", during: "" }
            ].map((step, idx) => (
              <div key={idx} className={`process-step ${idx === processStep ? "active" : ""}`}>
                <div className="step-before">{step.before}</div>
                {idx === 0 && <div className="step-during">{step.during}</div>}
                {idx > 0 && step.after && <div className="step-after">{step.after}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 02 — EL PROBLEMA */}
      <section id="problema" className="problem-section">
        <div className="problem-content">
          <h2>Tu empresa ya tiene un sistema.</h2>
          <p className="problem-subtitle">
            Probablemente está repartido entre hojas de cálculo, mensajes,
            correos, herramientas y personas.
          </p>
          
          <div className="scattered-elements">
            <div className="scatter-item" style={{top: "10%", left: "15%"}}>📊 Excel</div>
            <div className="scatter-item" style={{top: "20%", right: "20%"}}>📧 Email</div>
            <div className="scatter-item" style={{bottom: "30%", left: "10%"}}>💬 WhatsApp</div>
            <div className="scatter-item" style={{bottom: "15%", right: "15%"}}>🛒 Ecommerce</div>
            <div className="scatter-item" style={{top: "40%", left: "50%", transform: "translateX(-50%)"}}>📦 Inventario</div>
            <div className="scatter-item" style={{top: "60%", right: "25%"}}>🧾 Facturaci ón</div>
          </div>

          <div className="problem-situations">
            <div className="situation-card">
              <div className="situation-icon">📥</div>
              <p>Un pedido entra y alguien tiene que copiarlo a otro sitio.</p>
            </div>
            <div className="situation-card">
              <div className="situation-icon">🔐</div>
              <p>Solo una persona sabe cómo se hace determinado proceso.</p>
            </div>
            <div className="situation-card">
              <div className="situation-icon">❓</div>
              <p>Para saber qué está pasando tienes que preguntarle a alguien.</p>
            </div>
            <div className="situation-card">
              <div className="situation-icon">🔇</div>
              <p>Tus herramientas tienen información, pero no hablan entre ellas.</p>
            </div>
            <div className="situation-card">
              <div className="situation-icon">🔄</div>
              <p>El equipo repite tareas manualmente todos los días.</p>
            </div>
            <div className="situation-card">
              <div className="situation-icon">📊</div>
              <p>Hay datos, pero nadie los ve cuando los necesita.</p>
            </div>
          </div>

          <p className="problem-resolution">
            No tienes que cambiar todo lo que ya usas.<br />
            <strong>Hacemos que trabaje junto.</strong>
          </p>
        </div>
      </section>

      {/* 03 — ORDENAR · CONECTAR · AUTOMATIZAR */}
      <section id="pilares" className="pillars-section">
        <div className="pillars-container">
          <div className="pillars-nav">
            <button 
              className={`pillar-btn ${activePillar === "ordenar" ? "active" : ""}`}
              onClick={() => setActivePillar("ordenar")}
            >
              ORDENAR
            </button>
            <button 
              className={`pillar-btn ${activePillar === "conectar" ? "active" : ""}`}
              onClick={() => setActivePillar("conectar")}
            >
              CONECTAR
            </button>
            <button 
              className={`pillar-btn ${activePillar === "automatizar" ? "active" : ""}`}
              onClick={() => setActivePillar("automatizar")}
            >
              AUTOMATIZAR
            </button>
          </div>
          
          <div className="pillars-display">
            <div className="pillar-content">
              <h3>{pillars[activePillar].title}</h3>
              <p>{pillars[activePillar].subtitle}</p>
              {pillars[activePillar].visual}
            </div>
          </div>
        </div>
      </section>

      {/* 04 — ANTES / DESPUES */}
      <section id="antes-despues" className="beforeafter-section">
        <div className="beforeafter-container">
          <h2>Ejemplo de proceso</h2>
          
          <div className="beforeafter-slider">
            <div 
              className="beforeafter-compare"
              style={{
                background: `linear-gradient(to right, #f5f5f5 ${beforeAfter}%, #0B37FF ${beforeAfter}%)`
              }}
            >
              <div className="before-side">
                <h4>ANTES</h4>
                <div className="process-flow">
                  <div className="flow-step">Pedido</div>
                  <div className="flow-arrow">↓</div>
                  <div className="flow-step">Correo</div>
                  <div className="flow-arrow">↓</div>
                  <div className="flow-step">WhatsApp</div>
                  <div className="flow-arrow">↓</div>
                  <div className="flow-step">Excel</div>
                  <div className="flow-arrow">↓</div>
                  <div className="flow-step">Persona</div>
                  <div className="flow-arrow">↓</div>
                  <div className="flow-step">Otra herramienta</div>
                  <div className="flow-arrow">↓</div>
                  <div className="flow-step">Administraci ón</div>
                </div>
                <div className="process-metrics">
                  <div className="metric">8 pasos</div>
                  <div className="metric">4 herramientas</div>
                  <div className="metric">3 intervenciones manuales</div>
                </div>
              </div>
              
              <div className="after-side">
                <h4>DESPU ÉS</h4>
                <div className="process-flow">
                  <div className="flow-step after">Pedido</div>
                  <div className="flow-arrow after">↓</div>
                  <div className="flow-step after highlight">[B] SYSTEMS</div>
                  <div className="flow-arrow after">↓</div>
                  <div className="flow-step after">Todo actualizado</div>
                </div>
                <div className="process-metrics">
                  <div className="metric after">3 pasos</div>
                  <div className="metric after">1 intervenci ón</div>
                  <div className="metric after">Informaci ón conectada</div>
                </div>
              </div>
            </div>
            
            <input
              type="range"
              min="0"
              max="100"
              value={beforeAfter}
              onChange={(e) => setBeforeAfter(Number(e.target.value))}
              className="beforeafter-input"
            />
          </div>
          
          <p className="beforeafter-note">
            Esto es un ejemplo de proceso, no un resultado garantizado.
          </p>
        </div>
      </section>

      {/* 05 — LO QUE PODEMOS CONSTRUIR */}
      <section id="areas" className="areas-section">
        <div className="areas-container">
          <h2>Lo que necesite tu operación.</h2>
          
          <div className="areas-grid">
            <div className="areas-nav">
              {Object.entries(areas).map(([key, area]) => (
                <button
                  key={key}
                  className={`area-btn ${activeArea === key ? "active" : ""}`}
                  onClick={() => setActiveArea(key)}
                >
                  <span className="area-icon">{area.icon}</span>
                  <span className="area-title">{area.title}</span>
                </button>
              ))}
            </div>
            
            <div className="areas-display">
              <div className="area-card">
                <div className="area-header">
                  <span className="area-icon-large">{areas[activeArea as keyof typeof areas].icon}</span>
                  <h3>{areas[activeArea as keyof typeof areas].title}</h3>
                </div>
                <p>{areas[activeArea as keyof typeof areas].desc}</p>
              </div>
              
              <div className="connection-diagram">
                <div className="connection-title">TODO LO IMPORTANTE, CONECTADO</div>
                <div className="connection-visual">
                  <div className="conn-center">[B]</div>
                  <div className="conn-node top">Ventas</div>
                  <div className="conn-node right">Inventario</div>
                  <div className="conn-node bottom">Finanzas</div>
                  <div className="conn-node left">Clientes</div>
                  <div className="conn-node left-bottom">Equipo</div>
                  <div className="conn-node right-bottom">Compras</div>
                </div>
                <p className="connection-note">
                  No necesitas reemplazar todo.<br />
                  Podemos conectar lo que ya funciona.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 06 — PRUEBA REAL + NO TODO NECESITA IA */}
      <section className="proof-section">
        <div className="proof-container">
          <div className="proof-case">
            <h3>Un sistema creado para una operación real</h3>
            <div className="case-grid">
              <div className="case-problem">
                <h4>PROBLEMA</h4>
                <p>Informaci ón y procesos repartidos.</p>
              </div>
              <div className="case-system">
                <h4>SISTEMA</h4>
                <div className="system-modules">
                  <span className="module-tag">Ventas</span>
                  <span className="module-tag">Productos</span>
                  <span className="module-tag">Inventario</span>
                  <span className="module-tag">Producci ón</span>
                  <span className="module-tag">Costes</span>
                  <span className="module-tag">Proveedores</span>
                  <span className="module-tag">Finanzas</span>
                </div>
              </div>
              <div className="case-connection">
                <h4>CONEXI ÓN</h4>
                <p>Venta → demanda → producci ón → inventario → costes → decisi ón</p>
              </div>
            </div>
          </div>
          
          <div className="principle-section">
            <div className="principle-header">
              <span className="principle-tag">[B] PRINCIPLE</span>
              <h3>NO TODO NECESITA IA.</h3>
            </div>
            <div className="principle-grid">
              <div className="principle-card">
                <div className="principle-icon">⚡</div>
                <h4>REGLA</h4>
                <p>cuando una condición sencilla basta.</p>
              </div>
              <div className="principle-card">
                <div className="principle-icon">🔄</div>
                <h4>AUTOMATIZACI ÓN</h4>
                <p>cuando una secuencia puede ejecutarse sola.</p>
              </div>
              <div className="principle-card">
                <div className="principle-icon">🛠️</div>
                <h4>SOFTWARE</h4>
                <p>cuando la empresa necesita una herramienta propia.</p>
              </div>
              <div className="principle-card highlight">
                <div className="principle-icon">🤖</div>
                <h4>IA</h4>
                <p>cuando realmente hace falta interpretar, analizar o asistir.</p>
              </div>
            </div>
            <p className="principle-message">
              Usamos lo que tenga sentido.<br />
              No incorporamos IA porque esté de moda.
            </p>
          </div>
        </div>
      </section>

      {/* 07 — C ÓMO TRABAJAMOS + CTA */}
      <section id="proceso" className="process-section">
        <div className="process-container">
          <h2>C ómo trabajamos</h2>
          
          <div className="process-timeline">
            <div className="timeline-step">
              <div className="step-number">01</div>
              <h4>ENTENDEMOS</h4>
              <p>Vemos cómo funciona actualmente la empresa.</p>
              <div className="step-result">diagn óstico inicial</div>
            </div>
            <div className="timeline-line"></div>
            <div className="timeline-step">
              <div className="step-number">02</div>
              <h4>ORDENAMOS</h4>
              <p>Mapeamos procesos, herramientas, personas y problemas.</p>
              <div className="step-result">mapa de la operaci ón</div>
            </div>
            <div className="timeline-line"></div>
            <div className="timeline-step">
              <div className="step-number">03</div>
              <h4>DISEÑ· ¿AMOS</h4>
              <p>Decidimos qué simplificar, conectar, automatizar o construir.</p>
              <div className="step-result">propuesta del sistema</div>
            </div>
            <div className="timeline-line"></div>
            <div className="timeline-step">
              <div className="step-number">04</div>
              <h4>CONSTRUIMOS</h4>
              <p>Creamos una primera solución funcionando dentro de la operación real.</p>
              <div className="step-result">primera versión funcional</div>
            </div>
            <div className="timeline-line"></div>
            <div className="timeline-step">
              <div className="step-number">05</div>
              <h4>MEJORAMOS</h4>
              <p>Medimos y hacemos evolucionar el sistema.</p>
              <div className="step-result">mejora continua</div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACTO + FAQ */}
      <section id="contacto" className="contact-section">
        <div className="contact-container">
          <div className="contact-intro">
            <h2>Ensé·¿ñ·¿·anos cómo funciona tu empresa.</h2>
            <p>Nosotros te enseñamos cómo podría funcionar mejor.</p>
          </div>
          
          {submitted ? (
            <div className="form-success">
              <div className="success-icon">✓</div>
              <h3>Gracias por contar nos cómo trabajas.</h3>
              <p>Te contactaremos pronto para entender mejor tu operación.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="contact-form">
              <div className="form-grid">
                <input
                  type="text"
                  placeholder="Tu nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  required
                />
                <input
                  type="text"
                  placeholder="Empresa"
                  value={formData.empresa}
                  onChange={(e) => setFormData({...formData, empresa: e.target.value})}
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
                <select
                  value={formData.interes}
                  onChange={(e) => setFormData({...formData, interes: e.target.value})}
                >
                  <option value="ordenar">Ordenar una operación</option>
                  <option value="conectar">Conectar herramientas o procesos</option>
                  <option value="automatizar">Automatizar tareas</option>
                  <option value="construir">Construir software interno</option>
                  <option value="entender">Quiero entender qué mejorar</option>
                </select>
              </div>
              <textarea
                placeholder="Cu éntanos qué quieres mejorar"
                value={formData.mensaje}
                onChange={(e) => setFormData({...formData, mensaje: e.target.value})}
                rows={4}
                required
              />
              <button type="submit" className="btn-primary full-width">
                Cu éntanos cómo trabajas
              </button>
              <div className="form-notes">
                <span>Sin compromiso.</span>
                <span>Empezamos entendiendo.</span>
                <span>No necesitas saber de tecnología.</span>
              </div>
            </form>
          )}
          
          {/* FAQ */}
          <div className="faq-section">
            <h3>Preguntas frecuentes</h3>
            <div className="faq-list">
              {faqs.map((faq, idx) => (
                <div 
                  key={idx} 
                  className={`faq-item ${openFaq === idx ? "open" : ""}`}
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                >
                  <div className="faq-question">
                    <span>{faq.q}</span>
                    <span className="faq-toggle">{openFaq === idx ? "−" : "+"}</span>
                  </div>
                  <div className="faq-answer">{faq.a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="footer-content">
          <BrandMark size="small" />
          <p>Primero entendemos. Después construimos.</p>
          <div className="footer-links">
            <a href="#">Aviso legal</a>
            <a href="#">Privacidad</a>
          </div>
          <p className="footer-copy"> © 2026 [B] SYSTEMS</p>
        </div>
      </footer>
    </div>
  );
}
