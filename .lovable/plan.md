# Diagnóstico y fix: el sitio publicado no carga en algunas computadoras

## Lo que ya se verificó (solo lectura, desde fuera)

- `https://basicosystems.lovable.app`, `https://fundacionbasico.com` y `https://www.fundacionbasico.com` responden **200 OK** con el HTML correcto.
- El JS y el CSS que pide ese HTML (`/assets/index-BZ4F7yMQ.js`, `/assets/index-Bo374MRD.css`) también responden **200**.

Conclusión: el hosting y los dominios están bien. La caída de `basicoclothes.com` (hosting impago) no tiene relación: es otro servidor y solo afecta las llamadas a WooCommerce dentro del panel, no la carga del sitio.

El patrón "carga en unas computadoras y en otras no" con el servidor sano apunta a **caché local del navegador**: un Service Worker viejo (versión anterior de `sw.js`) instalado en esas máquinas sigue sirviendo archivos que ya no existen en el deploy actual, y la app queda en blanco. Las vistas previas externas fallan por la misma razón (mismo origen `*.lovable.app`).

## Qué se va a hacer

1. **Kill-switch del Service Worker**
   Reescribir `public/sw.js` como worker de desinstalación: en `install` hace `skipWaiting`, en `activate` borra **todas** las cachés y hace `clients.claim()`, y no intercepta ningún `fetch`. Cualquier navegador con el SW viejo lo reemplaza en la primera visita y queda limpio.

2. **Dejar de registrar el SW**
   En `src/main.tsx`, quitar el registro y dejar solo la limpieza: en todos los contextos se desregistran los SW existentes y se borran las cachés (`caches.keys()` → `caches.delete`). Se pierde la instalabilidad PWA del panel, que hoy es la causa del problema y no un requisito operativo; el acceso directo del portal de operario se revisa aparte si lo quieres conservar.

3. **Recuperación inmediata para las máquinas ya afectadas**
   Instrucción para el usuario: en la computadora que no carga, abrir el sitio y hacer recarga forzada (Cmd/Ctrl + Shift + R). Si sigue en blanco: DevTools → Application → Service Workers → Unregister + Clear storage. Después del deploy con el kill-switch esto deja de ser necesario para el resto.

4. **Publicar**
   El fix solo surte efecto una vez publicado, porque el `sw.js` viejo vive en el dominio publicado, no en la vista previa.

## Detalles técnicos

- Archivos tocados: `public/sw.js` y `src/main.tsx`. Nada más.
- No se toca backend, Woo, inventario, nómina, OP, QR ni datos.
- Verificación: build OK, typecheck 0 errores, y tras publicar, confirmar en una máquina afectada que la app carga y que en DevTools ya no aparece ningún Service Worker activo.

## Pendiente de tu confirmación

Si quieres mantener el acceso directo instalable (PWA) del portal de operario, se puede volver a introducir después con un SW versionado que nunca cachee HTML, en un bloque separado.
