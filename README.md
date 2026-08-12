# Basico System

Sistema de gestión modular para marcas, y el estudio que lo construye a medida
cuando el producto estándar se queda corto.

**Producción:** https://basicosystems.lovable.app

---

## Qué es

Basico System nace de operar una marca real —[Basico Clothes](https://basicoclothes.com)—
y de comprobar que ningún SaaS genérico cubría la operación completa. La
propuesta tiene dos caminos:

- **Basico System**, el producto. Módulos en producción, personalizables en
  branding, roles, flujos y campos. Arranca en días.
- **Tailor-made**, el estudio. Discovery de la operación, módulos nuevos
  diseñados desde cero e integraciones con lo que haga falta.

### Módulos

| Módulo | Ruta | Qué cubre |
|---|---|---|
| Dashboard | `/dashboard` | Resumen de ventas y métricas en vivo |
| Pedidos | `/pedidos` | Sincronización con el e-commerce, estados, costos, márgenes, badges de estado y confirmaciones de inventario |
| CRM | `/crm` | Clientes unificados, segmentación y comportamiento de compra |
| Planning | `/planning` | Calendario editorial sincronizado con el equipo |
| Crew | `/crew` | RRHH: perfiles, incidencias y tareas recurrentes |
| RRPP | `/rrpp` | Red de influencers, colaboraciones, cupones y métricas |
| Campañas | `/campaigns` | Wizard de creación, detalle y resultados de email marketing |
| Llamadas | `/llamadas` | Telefonía conectada, grabaciones y analítica por agente |
| Administración | `/administracion` | Obligaciones, vencimientos y control financiero |
| Basico Core | `/core` | Fabricación: costos por prenda, órdenes de producción y RESTOCK |
| Basico España | `/espana` | Operación específica de España: ventas, reportes, fabricación, etiquetas |
| Sublime | `/sublime` | Fichaje de asistencia — panel admin + kiosco público en `/sublime/fichaje` |
| Estudio Visual | `/estudio-visual` | Generador de fotografía de producto por IA (OpenRouter) + variantes para Instagram feed/story |
| Fondo Transparente | `/fondo-transparente` | Seguimiento público de aportes/donaciones: totales, confirmados y pendientes de verificar |
| Fuerza Venezuela | — | Página hermana de transparencia de aportes, mismo patrón de datos que Fondo Transparente |
| Configuración | `/configuracion` | Roles, permisos y ajustes generales del panel |

> El módulo de Retail/POS que documentaba versiones anteriores de este README
> migró a **RESTOCK**: la reposición de stock ahora vive integrada en
> Basico España → Fabricación, ya no es un TPV independiente con WooCommerce.

---

## Actualizaciones recientes

- **Estudio Visual** (4 ago 2026) — nuevo módulo: sube una foto de la prenda y
  genera la foto de estudio (fondo blanco, con modelo, o mockup lifestyle) vía
  OpenRouter, más las variantes recortadas para Instagram feed (1080×1080) y
  story (1080×1920), compuestas en Canvas con el logo y los colores de marca.
  Prompts y plantilla configurables desde Configuración.
- **RESTOCK** (8 ago 2026) — migración del listado de fabricación de Basico
  España para absorber la lógica de reposición de stock.
- **Pedidos** (10-11 ago 2026) — badges de estado diferenciando "Entregado" de
  otros estados, modal de multi-producto, payloads y confirmaciones de
  inventario más robustas.

---

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui · React Router ·
TanStack Query · Supabase (Postgres, Auth, Storage y Edge Functions) ·
OpenRouter (generación de imágenes, módulo Estudio Visual) ·
Playwright y Vitest.

La animación del hero es WebGL2 escrito a mano, sin librerías de 3D.

---

## Desarrollo local

```bash
npm install
npm run dev          # http://localhost:8080
```

Otros comandos:

```bash
npm run build        # build de producción
npx tsc --noEmit     # comprobación de tipos
npm run lint
npx vitest           # tests unitarios
npx playwright test  # end to end
```

Hace falta un `.env.local` con las credenciales de Supabase. Pídeselas a
alguien del equipo; no están en el repositorio. El módulo Estudio Visual
además requiere el secret `OPENROUTER_API_KEY` configurado en Supabase Edge
Functions.

---

## Estructura

```
src/
  pages/             una por ruta; Landing.tsx es la única pública
  components/
    landing/         la landing: estilo encapsulado y animación WebGL
    ui/              shadcn
    estudio/config/  tabs de configuración de Estudio Visual (prompts, marca)
    <módulo>/        un directorio por módulo del panel
  hooks/  lib/  integrations/supabase/
design/              fuentes de los iconos y la tarjeta social (no se sirven)
public/              assets estáticos servidos tal cual
supabase/            migraciones y edge functions (incluye estudio-generate-image)
```

### La landing

Vive en `src/pages/Landing.tsx` con su estilo en
`src/components/landing/landing-bsod.css`. **Todo cuelga de `.landing-bsod`** y
no toca `:root`: los tokens HSL de `src/index.css` los consume el panel entero,
así que declarar ahí el azul convertiría el ERP en una pantalla azul.

---

## Regenerar iconos y tarjeta social

Los originales son HTML en `design/`, para que el icono use exactamente la misma
tipografía que la landing.

```bash
node design/generate-assets.cjs
```

Produce en `public/`: `favicon.ico` (16, 32 y 48 en un solo fichero),
`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`
y `og-basico-systems.png` (1200×630).

Al tocar cualquiera de ellos, **sube la versión de la caché** en `public/sw.js`
(`basico-static-vN`). El service worker es cache-first para imágenes y sólo
purga las cachés cuyo nombre no coincide con el actual: sin ese cambio, quien ya
visitó el sitio sigue viendo los iconos viejos.

---

## Cambiar de dominio

La URL canónica está en cuatro sitios. Hay que cambiarlos a la vez:

| Fichero | Qué contiene |
|---|---|
| `index.html` | `canonical`, `og:url`, `og:image`, `twitter:image` y las tres URL del JSON-LD |
| `public/sitemap.xml` | el `<loc>` |
| `public/robots.txt` | la línea `Sitemap:` |
| `design/og-card.html` | nada de URL, pero conviene regenerar la tarjeta si cambia el mensaje |

Después, revalidar la vista previa del enlace en los tres inspectores —cachean
la versión anterior durante días:

- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)
- [X Card Validator](https://cards-dev.twitter.com/validator)

---

## SEO

Las etiquetas viven **estáticas en `index.html`**, no inyectadas desde React.
Es deliberado: los rastreadores sociales no ejecutan JavaScript y sólo leen el
HTML servido. Inyectarlas en runtime alcanzaría a Google, que sí renderiza, pero
no a la vista previa del enlace.

`public/robots.txt` bloquea las rutas del panel. Conviene saber que **es una
petición a rastreadores que se portan bien, no un control de acceso**: `/pos/`
lleva un token en la URL y esto lo mantiene fuera del índice de Google, pero no
protege la dirección. Eso se resuelve en servidor y caducando los tokens.
