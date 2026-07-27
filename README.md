# Basico System

Sistema de gestión modular para marcas, y el estudio que lo construye a medida
cuando el producto estándar se queda corto.

**Producción:** https://basicosystems.lovable.app

---

## Qué es

Basico System nace de operar una marca real —[Basico Clothes](https://basicoclothes.com)—
y de comprobar que ningún SaaS genérico cubría la operación completa. La
propuesta tiene dos caminos:

- **Basico System**, el producto. Diez módulos en producción, personalizables en
  branding, roles, flujos y campos. Arranca en días.
- **Tailor-made**, el estudio. Discovery de la operación, módulos nuevos
  diseñados desde cero e integraciones con lo que haga falta.

### Módulos

| | Módulo | Qué cubre |
|---|---|---|
| 01 | Pedidos | Sincronización con el e-commerce, estados, costos y márgenes en vivo |
| 02 | CRM | Clientes unificados, segmentación y comportamiento de compra |
| 03 | Planning | Calendario editorial sincronizado con el equipo |
| 04 | Crew | RRHH: nómina, documentos, incidencias y tareas |
| 05 | RRPP | Red de influencers, colaboraciones, cupones y métricas |
| 06 | Campañas | Email marketing, audiencias y resultados |
| 07 | Llamadas | Telefonía conectada, grabaciones y analítica por agente |
| 08 | Administración | Obligaciones, vencimientos y control financiero |
| 09 | Core | Fabricación: costos por prenda, órdenes de producción, partidas y nómina de taller |
| 10 | Retail | TPV de tienda, catálogo sincronizado con WooCommerce e inventario unificado |

---

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui · React Router ·
TanStack Query · Supabase (Postgres, Auth, Storage y Edge Functions) ·
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
alguien del equipo; no están en el repositorio.

---

## Estructura

```
src/
  pages/             una por ruta; Landing.tsx es la única pública
  components/
    landing/         la landing: estilo encapsulado y animación WebGL
    ui/              shadcn
    <módulo>/        un directorio por módulo del panel
  hooks/  lib/  integrations/supabase/
design/              fuentes de los iconos y la tarjeta social (no se sirven)
public/              assets estáticos servidos tal cual
supabase/            migraciones y edge functions
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
