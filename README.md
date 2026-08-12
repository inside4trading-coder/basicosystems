*[Versión en español](README.es.md)*

# Basico System

A modular management system for brands — and the studio that builds it
tailor-made when the standard product falls short.

**Production:** https://basicosystems.lovable.app

---

## What it is

Basico System was born from operating a real brand —[Basico Clothes](https://basicoclothes.com)—
and discovering that no generic SaaS covered the full operation. The offering
has two paths:

- **Basico System**, the product. Modules in production, customizable in
  branding, roles, flows, and fields. Up and running in days.
- **Tailor-made**, the studio. Operation discovery, new modules designed from
  scratch, and integrations with whatever is needed.

### Modules

| Module | Route | What it covers |
|---|---|---|
| Dashboard | `/dashboard` | Sales overview and live metrics |
| Orders | `/pedidos` | E-commerce sync, statuses, costs, margins, status badges, and inventory confirmations |
| CRM | `/crm` | Unified customers, segmentation, and purchase behavior |
| Planning | `/planning` | Editorial calendar synced with Notion |
| Crew | `/crew` | HR: profiles, incidents, and recurring tasks |
| RRPP | `/rrpp` | Influencer network, collaborations, coupons, and metrics |
| Campaigns | `/campaigns` | Creation wizard, detail, and email marketing results (Brevo) |
| Calls | `/llamadas` | Connected telephony (Zadarma), recordings, and per-agent analytics |
| Administration | `/administracion` | Obligations, due dates, and financial control |
| Basico Core | `/core` | Manufacturing: per-garment costs, production orders, and RESTOCK |
| Basico España | `/espana` | Spain-specific operation: sales, reports, manufacturing, labels, public POS |
| Sublime | `/sublime` | Time clock — admin panel + public kiosk at `/sublime/fichaje` |
| Estudio Visual | `/estudio-visual` | AI product photo/video generator (OpenRouter) + Instagram feed/story variants |
| Fondo Transparente | `/fondo-transparente` | Public donation tracker: totals, confirmed, and pending verification |
| Fuerza Venezuela | — | Sister page for donation transparency, same data pattern as Fondo Transparente |
| Configuration | `/configuracion` | Roles, permissions, and general panel settings |

> The Retail/POS module documented in earlier versions of this README was
> migrated into **RESTOCK**: stock replenishment now lives integrated into
> Basico España → Manufacturing, and is no longer a standalone POS with
> WooCommerce.

---

## Recent updates

- **Estudio Visual** (Aug 4, 2026) — new module: upload a photo of the
  garment and generate the studio photo (white background, with model, or
  lifestyle mockup) via OpenRouter, plus the cropped variants for Instagram
  feed (1080×1080) and story (1080×1920), composited on Canvas with the logo
  and brand colors. Prompts and template configurable from Settings.
- **RESTOCK** (Aug 8, 2026) — migration of the Basico España manufacturing
  list to absorb the stock replenishment logic.
- **Orders** (Aug 10-11, 2026) — status badges differentiating "Delivered"
  from other statuses, multi-product modal, more robust inventory
  confirmations and payloads.

---

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui · React Router ·
TanStack Query · Supabase (Postgres, Auth, Storage, and Edge Functions) ·
OpenRouter (image/video generation, Estudio Visual module) ·
Playwright and Vitest.

The hero animation is hand-written WebGL2, with no 3D libraries.

---

## Architecture

### External integrations

The system isn't an isolated ERP: it syncs live with the tools the real
operation already uses, via 40 Supabase Edge Functions.

| Integration | Edge Functions | What for |
|---|---|---|
| **WooCommerce** | `woo-sync`, `woo-orders`, `woo-customers`, `woo-customers-sync`, `woo-dashboard`, `woo-analytics-kpis`, `woo-explore`, `core-woo-sync`, `core-woo-import-variants`, `core-woo-map-import`, `core-woo-map-import-variants`, `core-woo-map-lookup`, `core-woo-stock-write`, `core-woo-test-read`, `esp-woo-sync-catalog`, `esp-woo-sync-orders`, `esp-woo-test` | Catalog, orders, customers, and stock synced both ways between Basico Core/España and the WooCommerce stores |
| **OpenRouter** | `estudio-generate-image`, `estudio-generate-video`, `estudio-list-models`, `estudio-video-status` | AI-generated product photography and video (Estudio Visual module) |
| **Zadarma** | `zadarma-sync` | Telephony: syncing calls, recordings, and per-agent analytics (Calls module) |
| **Brevo** | `brevo-campaigns`, `brevo-sync-contacts` | Email marketing: campaigns and contact sync (Campaigns module) |
| **Notion** | `notion-planning` | Synced editorial calendar (Planning module) |
| **BCV** | `fetch-bcv-rate` | Official Venezuelan Central Bank exchange rate for financial calculations |
| **Public POS (Spain)** | `esp-public-pos-admin`, `esp-public-pos-resolve`, `esp-public-pos-sale`, `esp-public-pos-search` | Public point-of-sale with no user authentication, using its own token |
| **Sublime (time clock)** | `sublime-clock-event`, `sublime-pin-admin`, `sublime-pin-public` | Staff clock-in/clock-out via PIN, admin panel, and public kiosk |
| **User administration** | `admin-list-users`, `admin-manage-users` | Account and role management from Settings |
| **Landing** | `send-landing-lead-notification` | Notification of new leads from the public form |
| **Core / manufacturing** | `core-create-production-order`, `core-generate-production-needs`, `core-generate-production-units`, `core-process-fabrication-funds` | Production orders, fabric/supply needs calculation, and manufacturing funds |
| **Authentication** | `crew-passcode` | Alternative access code for Crew staff |

### Data hooks by module

| Hook | Module | What it fetches |
|---|---|---|
| `useDashboardData.ts` | Dashboard | Aggregated sales metrics (18.9 KB — the largest in the panel) |
| `useAdminData.ts` | Administration | Obligations, due dates, and financial control |
| `useCrewData.ts` / `useCrewAudit.ts` | Crew | Profiles, incidents, clock-in audit |
| `useCoreDispatches.ts` / `useCoreLocations.ts` / `useCoreRoles.ts` / `useCoreSettings.ts` / `useCoreStatusRules.ts` | Basico Core | Dispatches, locations, roles, and production status rules |
| `useReplenishmentPolicyEvents.ts` | RESTOCK | Stock replenishment engine (36.2 KB — the largest hook in the whole repo) |
| `useWooCoreMap.ts` | Basico Core / España | Product mapping between Supabase and WooCommerce |
| `useExternalPurchaseOrders.ts` | Administration / Core | Purchase orders to external suppliers |
| `useCallsData.ts` | Calls | Data synced from Zadarma |
| `usePlanningData.ts` | Planning | Editorial calendar synced with Notion |
| `useRRPPData.ts` / `useRRPPBrand.ts` / `useRRPPGoals.ts` | RRPP | Influencers, collaborations, per-brand goals |
| `useSublimeClock.ts` | Sublime | Time clock: check-in/check-out logic |
| `useSublimeMerch.ts` | Sublime | Sublime store merchandise (23.7 KB) |
| `useBirthdayPeople.ts` / `useBlurSales.ts` | Dashboard | Auxiliary widgets (team birthdays, blurring sensitive figures) |
| `useAuth.tsx` | Global | Roles, routes allowed per role (`ALL_ROUTES`, `DEFAULT_ROLE_ROUTES`) |

### Folder structure

```
src/
  pages/                 one per route; Landing.tsx is the only public one
  components/
    landing/             the landing page: encapsulated styles and WebGL animation
    ui/                  shadcn
    admin/               user and role management
    campaigns/           email campaign wizard and detail
    configuracion/       RolePermissionsPanel and general settings
    core/                manufacturing: costs, pipeline, inventory, woocore/, payroll/, needs/
    crew/                HR
    crm/                 unified customers
    espana/              Spain operation (sales, reports, manufacturing, labels)
    estudio/config/      Estudio Visual settings tabs (prompts, brand)
    fondo/               Fondo Transparente
    pedidos/             orders, status badges, multi-product
    planning/            editorial calendar
    rrpp/                influencers and collaborations
    sublime/             time clock + mercancia/ (Sublime store)
    shared/              components shared across modules
  hooks/                 data logic — see table above
  lib/  integrations/supabase/
design/                  icon and social card sources (not served)
public/                  static assets served as-is
supabase/
  functions/             40 edge functions — see integrations table
  migrations/            174 versioned migrations (Mar 2026 → Aug 2026)
```

### The landing page

Lives in `src/pages/Landing.tsx` with its styles in
`src/components/landing/landing-bsod.css`. **Everything hangs off
`.landing-bsod`** and never touches `:root`: the HSL tokens in
`src/index.css` are consumed by the entire panel, so declaring blue there
would turn the ERP into a blue screen.

---

## Local development

```bash
npm install
npm run dev          # http://localhost:8080
```

Other commands:

```bash
npm run build        # production build
npx tsc --noEmit     # type checking
npm run lint
npx vitest           # unit tests
npx playwright test  # end to end
```

You'll need a `.env.local` with Supabase credentials. Ask a teammate for
them; they're not in the repository. The Estudio Visual module also
requires the `OPENROUTER_API_KEY` secret configured in Supabase Edge
Functions.

---

## Regenerating icons and social card

The originals are HTML files in `design/`, so the icon uses exactly the same
typography as the landing page.

```bash
node design/generate-assets.cjs
```

Produces in `public/`: `favicon.ico` (16, 32, and 48 in a single file),
`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`,
`apple-touch-icon.png`, and `og-basico-systems.png` (1200×630).

Whenever you touch any of them, **bump the cache version** in `public/sw.js`
(`basico-static-vN`). The service worker is cache-first for images and only
purges caches whose name doesn't match the current one: without that change,
anyone who already visited the site keeps seeing the old icons.

---

## Changing domains

The canonical URL lives in four places. They all need to be updated at the
same time:

| File | What it contains |
|---|---|
| `index.html` | `canonical`, `og:url`, `og:image`, `twitter:image`, and the three JSON-LD URLs |
| `public/sitemap.xml` | the `<loc>` |
| `public/robots.txt` | the `Sitemap:` line |
| `design/og-card.html` | no URL, but it's worth regenerating the card if the message changes |

Afterwards, revalidate the link preview in the three inspectors — they cache
the previous version for days:

- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)
- [X Card Validator](https://cards-dev.twitter.com/validator)

---

## SEO

Meta tags live **statically in `index.html`**, not injected from React. This
is deliberate: social crawlers don't run JavaScript and only read the served
HTML. Injecting them at runtime would reach Google, which does render, but
not the link preview.

`public/robots.txt` blocks the panel routes. Worth knowing: **this is a
request to well-behaved crawlers, not an access control**: `/pos/` carries an
access token in the URL itself, and this just keeps it out of Google's
index — it doesn't protect the address. That's handled server-side and by
expiring the tokens.
