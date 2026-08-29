# basicosystems.lovable.app inaccesible desde algunas redes — diagnóstico de red/hosting

El modo incógnito descarta caché y service worker. El resultado de PageSpeed (`net::ERR_TIMED_OUT` desde los servidores de Google) confirma que el problema no es la app: hay redes desde las que el servidor de Lovable no responde.

## Evidencia recogida

- Desde el entorno de Lovable: `https://basicosystems.lovable.app` responde **200** en 0.09–0.19s.
- Por IPv4 (`185.41.148.2`) → 200. Por IPv6 (`2a07:8240::1`) → 200. Ambos caminos funcionan desde aquí.
- Desde los servidores de Google (PageSpeed, red externa): **timeout total**, no llega ni el HTML.
- La vista previa externa devuelve 302 al login de Lovable: eso es comportamiento normal, no un fallo.

Diagnóstico: la app y el build están bien. El fallo está en la entrega de red del hosting hacia ciertos orígenes/regiones (probable ruta o nodo de borde), o en un bloqueo de red del lado de los equipos que fallan.

## Plan de acción

1. **Configuración confirmada**: el proyecto está publicado y su visibilidad efectiva es pública. No es un bloqueo de sesión o permisos.
2. **Dominios confirmados**: `fundacionbasico.com` y `www.fundacionbasico.com` figuran activos y conectados. Probarlos desde el mismo equipo afectado permite separar un fallo exclusivo del subdominio `lovable.app` de un fallo general del hosting.
3. **Republicar el proyecto** para forzar un despliegue nuevo y que se regenere la distribución en el borde. Es la única acción segura disponible desde el proyecto; no toca código ni datos.
4. **Reverificar** tras la republicación: respuesta por IPv4 e IPv6 y nueva ejecución de PageSpeed desde red externa.
5. **Si sigue fallando desde fuera**: escalar a soporte de Lovable como incidente de conectividad/CDN, adjuntando el `ERR_CONNECTION_TIMED_OUT` local y el `net::ERR_TIMED_OUT` independiente de PageSpeed, junto con fecha, hora y URL. Mientras tanto, usar el dominio personalizado si responde en esas redes.

## Fuera de alcance

No se toca código de la aplicación: ni Woo, ni inventario, ni QR, ni nómina, ni partidas, ni OP, ni base de datos. Sólo republicación y verificación.
