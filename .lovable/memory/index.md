Basico Systems — panel de gestión para Basico Clothes (basicoclothes.es)

## Design System
- Primary: #E3001B (354 100% 44%) — red
- Secondary: #0A0A0A (0 0% 4%) — near-black
- Background: #F5F5F5 (0 0% 96%)
- Font: Inter, weight 900 for headings, tight tracking, uppercase labels
- Sidebar: black bg, red accent on active item
- Status badges: green=success, red=error, yellow=warning, grey=inactive

## Roles
- admin: full access including Configuración
- manager: all except Configuración
- partner: read-only Dashboard + Planning

## Modules
1. Dashboard (reads from orders/order_items tables in DB)
2. Pedidos (reads from orders/order_items tables with expandable rows)
3. CRM (WooCommerce customers + segments)
4. Planning (Trello API)
5. Campaigns (Brevo API + WooCommerce segments)
6. Configuración (admin only — users, integrations, CSV cost upload)

## Data Architecture
- orders, order_items, payments, product_costs tables in Supabase
- woo-sync edge function syncs WooCommerce → Supabase
- Dashboard/Pedidos read from DB, not WooCommerce API directly
- product_costs populated via CSV upload in Configuración
- analytic_category: superior, inferior, accesorios

## Currency & Exchange Rate
- USD is default display currency
- VES orders converted using exchange_rate (fallback: 55 VES/USD)
- total_amount_usd used for all KPIs and charts
- Exchange rate API: pydolarve.org (may fail in edge runtime, fallback used)
- woo-sync timeout: 7 days works, 30 days may timeout

## Secrets
- WC_CONSUMER_KEY, WC_CONSUMER_SECRET (WooCommerce)
- TRELLO_API_KEY, TRELLO_TOKEN, TRELLO_WORKSPACE_ID
- BREVO_API_KEY (pending)
