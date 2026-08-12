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
| Planning | `/planning` | Calendario editorial sincronizado con Notion |
| Crew | `/crew` | RRHH: perfiles, incidencias y tareas recurrentes |
| RRPP | `/rrpp` | Red de influencers, colaboraciones, cupones y métricas |
| Campañas | `/campaigns` | Wizard de creación, detalle y resultados de email marketing (Brevo) |
| Llamadas | `/llamadas` | Telefonía conectada (Zadarma), grabaciones y analítica por agente |
| Administración | `/administracion` | Obligaciones, vencimientos y control financiero |
| Basico Core | `/core` | Fabricación: costos por prenda, órdenes de producción y RESTOCK |
| Basico España | `/espana` | Operación específica de España: ventas, reportes, fabricación, etiquetas, POS público |
| Sublime | `/sublime` | Fichaje de asistencia — panel admin + kiosco público en `/sublime/fichaje` |
| Estudio Visual | `/estudio-visual` | Generador de fotografía/video de producto por IA (OpenRouter) + variantes para Instagram feed/story |
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
OpenRouter (generación de imágenes/video, módulo Estudio Visual) ·
Playwright y Vitest.

La animación del hero es WebGL2 escrito a mano, sin librerías de 3D.

---

## Arquitectura

### Integraciones externas

El sistema no es un ERP aislado: sincroniza en vivo con las herramientas que la
operación real ya usa, vía 40 Supabase Edge Functions.

| Integración | Edge Functions | Para qué |
|---|---|---|
| **WooCommerce** | `woo-sync`, `woo-orders`, `woo-customers`, `woo-customers-sync`, `woo-dashboard`, `woo-analytics-kpis`, `woo-explore`, `core-woo-sync`, `core-woo-import-variants`, `core-woo-map-import`, `core-woo-map-import-variants`, `core-woo-map-lookup`, `core-woo-stock-write`, `core-woo-test-read`, `esp-woo-sync-catalog`, `esp-woo-sync-orders`, `esp-woo-test` | Catálogo, pedidos, clientes y stock sincronizados en ambos sentidos entre Basico Core/España y las tiendas WooCommerce |
| **OpenRouter** | `estudio-generate-image`, `estudio-generate-video`, `estudio-list-models`, `estudio-video-status` | Generación de fotografía y video de producto por IA (módulo Estudio Visual) |
| **Zadarma** | `zadarma-sync` | Telefonía: sincronización de llamadas, grabaciones y analítica por agente (módulo Llamadas) |
| **Brevo** | `brevo-campaigns`, `brevo-sync-contacts` | Email marketing: campañas y sincronización de contactos (módulo Campañas) |
| **Notion** | `notion-planning` | Calendario editorial sincronizado (módulo Planning) |
| **BCV** | `fetch-bcv-rate` | Tasa de cambio oficial del Banco Central de Venezuela para cálculos financieros |
| **POS público (España)** | `esp-public-pos-admin`, `esp-public-pos-resolve`, `esp-public-pos-sale`, `esp-public-pos-search` | Punto de venta público sin autenticación de usuario, con token propio |
| **Sublime (fichaje)** | `sublime-clock-event`, `sublime-pin-admin`, `sublime-pin-public` | Registro de entrada/salida del personal vía PIN, panel admin y kiosco público |
| **Administración de usuarios** | `admin-list-users`, `admin-manage-users` | Gestión de cuentas y roles desde Configuración |
| **Landing** | `send-landing-lead-notification` | Notificación de nuevos leads del formulario público |
| **Core / producción** | `core-create-production-order`, `core-generate-production-needs`, `core-generate-production-units`, `core-process-fabrication-funds` | Órdenes de producción, cálculo de necesidades de tela/insumos y fondos de fabricación |
| **Autenticación** | `crew-passcode` | Código de acceso alternativo para el personal de Crew |

### Hooks de datos por módulo

| Hook | Módulo | Qué trae |
|---|---|---|
| `useDashboardData.ts` | Dashboard | Métricas agregadas de ventas (18.9 KB — el más grande del panel) |
| `useAdminData.ts` | Administración | Obligaciones, vencimientos y control financiero |
| `useCrewData.ts` / `useCrewAudit.ts` | Crew | Perfiles, incidencias, auditoría de fichajes |
| `useCoreDispatches.ts` / `useCoreLocations.ts` / `useCoreRoles.ts` / `useCoreSettings.ts` / `useCoreStatusRules.ts` | Basico Core | Despachos, ubicaciones, roles y reglas de estado de producción |
| `useReplenishmentPolicyEvents.ts` | RESTOCK | Motor de reposición de stock (36.2 KB — el hook más grande de todo el repo) |
| `useWooCoreMap.ts` | Basico Core / España | Mapeo de productos entre Supabase y WooCommerce |
| `useExternalPurchaseOrders.ts` | Administración / Core | Órdenes de compra a proveedores externos |
| `useCallsData.ts` | Llamadas | Datos sincronizados desde Zadarma |
| `usePlanningData.ts` | Planning | Calendario editorial sincronizado con Notion |
| `useRRPPData.ts` / `useRRPPBrand.ts` / `useRRPPGoals.ts` | RRPP | Influencers, colaboraciones, metas por marca |
| `useSublimeClock.ts` | Sublime | Fichaje: lógica de entrada/salida |
| `useSublimeMerch.ts` | Sublime | Mercancía de la tienda Sublime (23.7 KB) |
| `useBirthdayPeople.ts` / `useBlurSales.ts` | Dashboard | Widgets auxiliares (cumpleaños del equipo, difuminado de cifras sensibles) |
| `useAuth.tsx` | Global | Roles, rutas permitidas por rol (`ALL_ROUTES`, `DEFAULT_ROLE_ROUTES`) |

### Estructura de carpetas

```
src/
  pages/                 una por ruta; Landing.tsx es la única pública
  components/
    landing/             la landing: estilo encapsulado y animación WebGL
    ui/                  shadcn
    admin/               gestión de usuarios y roles
    campaigns/           wizard y detalle de campañas de email
    configuracion/       RolePermissionsPanel y ajustes generales
    core/                producción: costos, pipeline, inventario, woocore/, payroll/, needs/
    crew/                RRHH
    crm/                 clientes unificados
    espana/              operación España (ventas, reportes, fabricación, etiquetas)
    estudio/config/      tabs de configuración de Estudio Visual (prompts, marca)
    fondo/               Fondo Transparente
    pedidos/             pedidos, badges de estado, multi-producto
    planning/            calendario editorial
    rrpp/                influencers y colaboraciones
    sublime/             fichaje + mercancia/ (tienda Sublime)
    shared/              componentes compartidos entre módulos
  hooks/                 lógica de datos — ver tabla arriba
  lib/  integrations/supabase/
design/                  fuentes de los iconos y la tarjeta social (no se sirven)
public/                  assets estáticos servidos tal cual
supabase/
  functions/             40 edge functions — ver tabla de integraciones
  migrations/            174 migraciones versionadas (mar 2026 → ago 2026)
```

### La landing

Vive en `src/pages/Landing.tsx` con su estilo en
`src/components/landing/landing-bsod.css`. **Todo cuelga de `.landing-bsod`** y
no toca `:root`: los tokens HSL de `src/index.css` los consume el panel entero,
así que declarar ahí el azul convertiría el ERP en una pantalla azul.

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
