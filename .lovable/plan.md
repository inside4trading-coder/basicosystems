

## Reframe final

Dos ofertas en una landing, con jerarquía clara:

1. **Tailor-made (oferta principal)** — construimos el sistema operativo completo a medida.
2. **Basico Systems SaaS (entrada)** — el mismo sistema, configurable y personalizable, listo para arrancar rápido.

Posicionamiento: "Empieza con el SaaS. Crece a medida cuando lo necesites." No es un SaaS genérico — es el sistema probado en Basico, parametrizable por marca.

## Cambios sobre el plan anterior

Mantengo toda la estructura aprobada y añado/modifico:

### Hero (ajustado)
- H1: "SISTEMAS OPERATIVOS PARA MARCAS QUE NO CABEN EN UN SAAS GENÉRICO"
- Subtítulo: "Empieza con Basico Systems. Evoluciona a un sistema 100% a medida cuando tu operación lo pida."
- Dos CTAs lado a lado:
  - Primario rojo: "Probar Basico Systems"
  - Secundario outline blanco: "Quiero uno a medida"

### Nueva sección: "DOS FORMAS DE EMPEZAR" (después del manifiesto)
Layout 2 columnas (stack en mobile), comparativa visual editorial:

**Columna A — BASICO SYSTEMS (SaaS personalizable)**
- Eyebrow: "PRODUCTO"
- Título: "Arranca en días"
- Bullets:
  - 8 módulos listos: Pedidos, CRM, Planning, Crew, RRPP, Campañas, Llamadas, Administración
  - Personalizable: branding, roles, flujos, campos
  - Integraciones nativas: WooCommerce, Brevo, Notion, Zadarma
  - Onboarding guiado con tu equipo
- CTA: "Solicitar acceso"

**Columna B — TAILOR-MADE (estudio)**
- Eyebrow: "ESTUDIO"
- Título: "Construido para tu operación"
- Bullets:
  - Discovery profundo de tu negocio
  - Módulos nuevos diseñados desde cero
  - Integraciones con cualquier herramienta
  - Soporte y evolución continua
- CTA: "Hablar con el estudio"

Visual: borde fino, fondo blanco vs fondo negro invertido para crear contraste. Misma altura.

### Sección "Capacidades" (renombrada)
Ahora se llama **"QUÉ INCLUYE BASICO SYSTEMS HOY"** y deja claro que son los módulos ya construidos del SaaS — y la base sobre la que se hacen los tailor-made.

Subtítulo: "Estos son los módulos en producción. En tailor-made, los combinamos, modificamos o construimos nuevos."

### Sección "Personalización" (nueva, antes del caso Basico)
Fondo blanco. Título: "TU MARCA, NO LA NUESTRA."
Grid 4 cards minimalistas mostrando ejes de personalización del SaaS:
- Branding (colores, logo, tipografía)
- Módulos (activa solo los que necesitas)
- Roles y permisos (RBAC configurable)
- Integraciones (las tuyas, no solo las nuestras)

### Sección "Para cualquier rubro" (mantener)
Añadir una línea: "Cada rubro arranca con Basico Systems y crece a medida según el negocio."

### Caso Basico (mantener) — añadir línea
"Basico Clothes opera hoy sobre el SaaS + módulos a medida construidos por el estudio."

### CTA final (ajustado)
Dos opciones claras en el form:
- Radio o toggle: ¿Qué te interesa?
  - Probar Basico Systems
  - Construir uno a medida
  - Aún no lo sé
- Resto del form igual (nombre, marca, email, mensaje)

### Resto de secciones
Sin cambios respecto al plan aprobado anteriormente (Stack & AI, Proceso, Banner Powered by Basico, Footer).

## Archivos (sin cambios respecto al plan anterior)

- Nuevo: `src/pages/Landing.tsx`
- Nuevo: `src/assets/landing-hero.jpg`, `src/assets/landing-case-basico.jpg`
- Modificar: `src/App.tsx` (`/` → `<Landing />`)
- Backend: tabla `landing_leads` con columna extra `interest` (`saas` | `tailor` | `unsure`)

## Fuera de alcance

- Pricing del SaaS (venta consultiva, pricing en conversación).
- Self-signup al SaaS (es solicitud → onboarding asistido).
- Demo interactiva del producto (link a screenshots/caso Basico es suficiente).

