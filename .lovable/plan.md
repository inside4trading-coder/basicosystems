
# Plan: Conectar `fundacionbasico.com` a Fuerza Venezuela

## Objetivo
Cuando alguien entre a `fundacionbasico.com` (o `www.fundacionbasico.com`), debe ver directamente la landing pública de **Fuerza Venezuela**, sin tocar el HUB privado ni los demás módulos.

---

## Parte 1 — Cambios en la app (código)

Hoy `/` muestra `Landing` (la landing corporativa de BASICO) y `/fuerza-venezuela` muestra la página pública del fondo. Necesitamos que en el dominio nuevo la raíz `/` muestre Fuerza Venezuela, pero en el dominio principal del HUB siga mostrando la Landing actual.

Cambios:

1. **`src/App.tsx`** — detectar el host:
   - Si `window.location.hostname` es `fundacionbasico.com` o `www.fundacionbasico.com`:
     - `/` → `<FuerzaVenezuela />`
     - `/fuerza-venezuela` → `<Navigate to="/" replace />` (alias / redirect)
     - El resto de rutas privadas del HUB siguen montadas pero quedan protegidas por `ProtectedRoute` (no se exponen visualmente; cualquier intento de entrar desde ese dominio sigue requiriendo login, no hay riesgo de fuga de datos).
   - Si el host es cualquier otro (`*.lovable.app`, dominio del HUB, localhost):
     - `/` → `<Landing />` (sin cambios)
     - `/fuerza-venezuela` → `<FuerzaVenezuela />` (sin cambios)

2. **SEO de Fuerza Venezuela** (`src/pages/FuerzaVenezuela.tsx`): asegurar `<title>`, `meta description`, OG y canonical apuntando a `https://fundacionbasico.com/`.

3. **`index.html`**: revisar que no haya tags estáticos que sobrescriban el SEO específico de Fuerza Venezuela cuando se sirve desde el dominio nuevo.

No se tocan: HUB, login, ventas, inventario, fabricación, WooCommerce, RRPP, Crew, Sublime, Core, España, ni el módulo privado `/fondo-transparente`.

---

## Parte 2 — Conectar el dominio en Lovable

Pasos que harás tú en la UI de Lovable (no se hace por código):

1. **Project Settings → Domains → Connect Domain**.
2. Añadir **`fundacionbasico.com`** → marcar como **Primary**.
3. Añadir **`www.fundacionbasico.com`** como segundo dominio (Lovable redirige automáticamente al Primary).
4. Esperar verificación (TXT) y emisión de SSL automática (puede tardar hasta 72 h, normalmente minutos).

---

## Parte 3 — Registros DNS en BanaHosting

Antes de crearlos, **elimina cualquier registro A, AAAA o CNAME existente** para `@` y `www` que apunte a la IP vieja de BanaHosting, o se quedará el hosting actual respondiendo.

| Tipo  | Host / Name | Value / Target          | TTL  | Notas                              |
|-------|-------------|-------------------------|------|------------------------------------|
| A     | `@`         | `185.158.133.1`         | 3600 | Raíz `fundacionbasico.com`         |
| A     | `www`       | `185.158.133.1`         | 3600 | Subdominio `www`                   |
| TXT   | `_lovable`  | (el valor exacto que muestre la UI de Lovable al añadir el dominio, formato `lovable_verify=XXXX`) | 3600 | Verificación de propiedad |

Notas importantes:
- **No usar CNAME** en `@`; debe ser A.
- Si BanaHosting tiene activado **Cloudflare/proxy**, hay que desactivar el "nube naranja" o usar el modo proxy en Lovable (Connect Domain → Advanced → "Domain uses Cloudflare or a similar proxy"). Si BanaHosting no es proxy, ignorar.
- **MX, SPF, DKIM, DMARC**: si usas correo `@fundacionbasico.com`, **no toques** esos registros (déjalos como están en BanaHosting).
- Eliminar registros viejos `A @ → IP_BanaHosting` y `A www → IP_BanaHosting`.

---

## Parte 4 — Verificación

1. Esperar propagación DNS (chequear en https://dnschecker.org).
2. En Lovable, el estado del dominio pasará por: *Verifying → Setting up → Active*.
3. Probar:
   - `https://fundacionbasico.com/` → debe abrir Fuerza Venezuela.
   - `https://www.fundacionbasico.com/` → debe redirigir a `https://fundacionbasico.com/`.
   - `https://fundacionbasico.com/fuerza-venezuela` → debe redirigir a `/`.
   - El HUB sigue accesible solo por la URL antigua de Lovable / dominio interno, y `/fondo-transparente` sigue protegido por login.

---

## Detalles técnicos

- El switch por hostname se hace al montar `<App />`, leyendo `window.location.hostname` una sola vez (no reactivo, no hay cambios de host en runtime).
- `ProtectedRoute` y RLS siguen siendo la barrera real de seguridad para el HUB; el hostname switch es solo presentación.
- No se requieren cambios en Supabase, edge functions, ni storage.
- Publicación: tras aprobar el plan e implementar, **debes hacer Publish** para que el cambio de routing por hostname llegue al dominio nuevo.
