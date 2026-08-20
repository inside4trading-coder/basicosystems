# Portal de Operario: acceso directo instalable

Objetivo: que el trabajador agregue "BASICO Operario" a la pantalla de inicio y abra directo `/operario`.

## Qué se hace

1. **Manifest propio del portal** — nuevo `public/manifest-operario.webmanifest`: name "BASICO Operario", short_name "Operario", `start_url: /operario`, `scope: /operario`, `display: standalone`, theme `#000000`, background `#ffffff`, iconos 192/512 (se reutilizan los iconos BASICO ya existentes en `public/`). El manifest actual del sistema (`manifest.webmanifest`, start_url `/`) queda intacto.

2. **Cambio de manifest solo en /operario** — en la página del portal se intercambia el `<link rel="manifest">` por el de operario mientras la ruta está activa y se restaura al salir. Así el resto del panel sigue instalándose como BASICO SYSTEM.

3. **Bloque "Instalar acceso directo" en /operario** — tarjeta visible en el portal (pantalla de selección de operario y dashboard) con el título, el texto pedido y el botón. Se captura `beforeinstallprompt`; al tocar el botón se lanza `prompt()` y, si acepta, el bloque pasa a "Acceso directo instalado".

4. **iPhone / Android sin prompt** — si no hay evento disponible, el botón abre instrucciones manuales según el dispositivo: Safari (compartir → Agregar a pantalla de inicio → Agregar) y Chrome Android (menú → Agregar a pantalla principal / Instalar app → Confirmar).

5. **Standalone** — si la app ya corre instalada (`display-mode: standalone` o `navigator.standalone` en iOS) no se muestra el botón; en su lugar un discreto "Acceso directo activo".

6. **Service worker** — se mantiene el `public/sw.js` actual, que ya solo intercepta imágenes/fuentes del mismo origen y nunca toca API, auth ni Supabase. Se le añade una exclusión explícita para `core-operator-portal` y cualquier ruta `/operario` en el fetch handler, de modo que PIN, sesión, dashboard, `lookup_unit` y `register_process` siempre vayan a la red. El portal seguirá requiriendo conexión.

## Notas técnicas

- El SW solo se registra en producción fuera de iframe/preview (`src/main.tsx`, sin cambios de lógica). En la vista previa de Lovable la instalación no se puede probar; hay que validarla en la URL publicada.
- Componente nuevo `src/components/operario/OperatorInstallCard.tsx`; el `InstallAppButton` del sidebar admin no se toca.
- No se tocan escaneo admin, nómina, OP, QR, WooCommerce ni inventario.

## Verificación

Typecheck y revisión del portal en `/operario` (bloque visible, instrucciones por plataforma, ausencia de caché para llamadas del portal).
