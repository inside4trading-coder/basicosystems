## Plan: POS Móvil BASICO ESPAÑA — Público por sede, Escáner real, Menú móvil

Tres bloques independientes: (A) POS público con link/token por sede, (B) escáner real de cámara reutilizable, (C) responsive del layout España.

---

### A. POS Público por sede

**Ruta**
- Pública sin login: `/pos/:locationSlug/:publicToken` (fuera de `AppLayout`/`ProtectedRoute`, registrada en `src/App.tsx` al mismo nivel que `/login`).
- Nueva página `src/pages/pos-publico/PosPublico.tsx` con su propio `PublicPosLayout` mínimo (header "BASICO POS — <sede>", sin sidebar).
- Si PIN configurado, primero pantalla de PIN antes de mostrar el POS.

**Schema (migración nueva)**

Agregar a `esp_locations`:
- `public_pos_enabled boolean not null default false`
- `public_pos_slug text unique`
- `public_pos_token text` (32+ bytes aleatorios, hex/base64url)
- `public_pos_pin text` (opcional, hash)
- `public_pos_created_at timestamptz`
- `public_pos_last_used_at timestamptz`

RLS: **no** dar acceso anon a `esp_locations`. Todo el flujo público pasa por edge functions con service role.

**Edge functions nuevas** (`verify_jwt = false`, validan token en código):

1. `esp-public-pos-resolve` — POST `{ slug, token, pin? }` → valida y devuelve `{ location: { id, name }, payment_methods, needs_pin }`. Actualiza `public_pos_last_used_at`.
2. `esp-public-pos-search` — POST `{ slug, token, query }` → busca variante por `scan_code | variant_sku | barcode | qr_code`, devuelve `{ product_name, variant_label, color, sku, price, stock_in_location, variant_id }`. Solo campos no sensibles.
3. `esp-public-pos-sale` — POST `{ slug, token, pin?, items, payments, customer_name?, notes? }`. Server-side:
   - Valida sede + token + PIN + `public_pos_enabled`.
   - Resuelve `location_id` **desde el token** (nunca del cliente).
   - Valida stock por sede, precios desde DB (no del cliente).
   - Ejecuta la misma lógica atómica que `esp_register_pos_sale` (RPC existente) pasando `source='public_pos'`, `channel='POS'`, `location_id` del token.
   - Devuelve recibo `{ sale_id, total, items, timestamp }`.

Cliente público usa `fetch` a las edge functions con la publishable key (no supabase session). Las funciones **no** aceptan `location_id` del body.

**Configuración por sede**

Nueva pestaña "POS Público" en `src/pages/espana/EspanaConfiguracion.tsx` (o sección dedicada), tabla de sedes con:
- Toggle activar/desactivar
- Slug editable (validar único)
- Ver/copiar link `https://<host>/pos/<slug>/<token>`
- Regenerar token
- PIN opcional
- Último uso

Escrituras vía edge function `esp-public-pos-admin` (protegida con JWT, rol admin/manager) que hace las mutaciones a `esp_locations`. Genera token con `crypto.randomUUID()` + `crypto.getRandomValues` (32 bytes → base64url).

---

### B. Escáner real de cámara

**Nuevo componente** `src/components/espana/MobileQrScanner.tsx`:
- Modal full-screen (Dialog de shadcn en móvil, `w-screen h-screen`).
- Estrategia:
  1. Si `window.BarcodeDetector` existe → usar `getUserMedia({ video: { facingMode: 'environment' } })` + loop `requestAnimationFrame` + `BarcodeDetector.detect()`.
  2. Fallback: instalar `html5-qrcode` (soporta QR + barcodes 1D, iOS Safari OK).
- Pide permisos, muestra error si denegado, cámara trasera por defecto.
- Botones: "Cancelar", "Ingresar código manual" (input + submit).
- Al detectar → `onDetected(text)` y cierra.
- Requiere HTTPS (ya lo tenemos en preview y prod).

**Uso**
- POS público: botón "Escanear" grande → abre `MobileQrScanner` → llama a `esp-public-pos-search`.
- POS normal (`src/pages/espana/EspanaPOS.tsx`): reemplazar el botón/escáner actual por el mismo componente. Cero duplicación.

Instalación: `bun add html5-qrcode` (para fallback iOS).

---

### C. Menú móvil colapsable en España

Actualmente `EspanaLayout.tsx` renderiza aside fijo `md:w-60` con `flex-col md:flex-row`, así que en móvil aparece apilado ocupando pantalla.

Cambios en `src/pages/espana/EspanaLayout.tsx`:
- En móvil (`< md`): ocultar aside, mostrar barra superior compacta con logo módulo + botón hamburguesa (Sheet de shadcn ya usado en el proyecto).
- Sheet se abre con hamburguesa, contiene el mismo `<nav>` de grupos, se cierra al navegar (usar `onClick` en NavLink o efecto sobre `location.pathname`).
- En desktop (`md+`): comportamiento actual sin cambios.
- Header general de `AppLayout` sigue arriba; añadir el hamburguesa **dentro** de EspanaLayout para no tocar módulos ajenos.

POS público usa su propio layout minimal, sin sidebar.

---

### Seguridad — checklist

- Sin token → 404/`Link no válido`.
- Token incorrecto → mismo error genérico, sin distinguir.
- `public_pos_enabled=false` → mismo error.
- `location_id` de venta siempre desde el token en el servidor.
- Precios y stock validados server-side.
- Venta atómica reutilizando la RPC existente (no permitir stock negativo).
- No `GRANT` a `anon` sobre tablas ESP; todo por edge functions.
- Público no puede llegar a `/espana/*` (siguen en `ProtectedRoute`).

---

### Detalles técnicos

**Archivos nuevos**
- `supabase/migrations/<ts>_esp_public_pos.sql` — columnas + índices únicos.
- `supabase/functions/esp-public-pos-resolve/index.ts`
- `supabase/functions/esp-public-pos-search/index.ts`
- `supabase/functions/esp-public-pos-sale/index.ts`
- `supabase/functions/esp-public-pos-admin/index.ts`
- `src/pages/pos-publico/PosPublico.tsx`
- `src/pages/pos-publico/PublicPosLayout.tsx`
- `src/components/espana/MobileQrScanner.tsx`
- `src/components/espana/EspanaPublicPosConfig.tsx`

**Archivos editados**
- `src/App.tsx` — ruta pública `/pos/:slug/:token`.
- `src/pages/espana/EspanaLayout.tsx` — responsive con Sheet + hamburguesa.
- `src/pages/espana/EspanaPOS.tsx` — usar `MobileQrScanner`.
- `src/pages/espana/EspanaConfiguracion.tsx` — pestaña "POS Público".
- `src/integrations/supabase/types.ts` — regenerado por migración.
- `package.json` — `html5-qrcode`.

**No se toca**: BASICO CORE, WooCommerce (Woo global ni España), Blanks/DTF, Fabricación ES, pedidos Woo, ventas históricas, inventario fuera del flujo POS.

---

### Validación (Pop Up Ibiza)

1. Config → activar POS público Pop Up Ibiza → copiar link.
2. Abrir link en móvil incógnito → sin login, carga sede fija, sin selector, sin sidebar admin.
3. Escanear → abre cámara trasera → detecta `scan_code` → agrega al carrito.
4. Confirmar venta → stock Pop Up Ibiza -1, `esp_sales` con `source=public_pos` y `location_id=Pop Up Ibiza`, movimiento `sale_pos` creado.
5. Otras sedes intactas. WooCommerce y CORE intactos.
6. Cambiar token → link viejo deja de funcionar.

### Preguntas rápidas antes de construir

Ninguna bloqueante; asumo:
- Formato de link: `https://<host>/pos/<slug>/<token>` (limpio y compartible).
- PIN opcional, off por defecto.
- Métodos de pago: usar los ya activos globalmente en `esp_payment_methods`.

Si prefieres `/espana/pos-publico/...` o PIN obligatorio, dímelo y ajusto antes de implementar.
