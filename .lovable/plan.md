# basicosystems.lovable.app inaccesible desde algunas redes — diagnóstico de red/hosting

El modo incógnito descarta caché y service worker. El resultado de PageSpeed (`net::ERR_TIMED_OUT` desde los servidores de Google) confirma que el problema no es la app: hay redes desde las que el servidor de Lovable no responde.

## Evidencia recogida

- Desde el entorno de Lovable: `https://basicosystems.lovable.app` responde **200** en 0.09–0.19s.
- Por IPv4 (`185.41.148.2`) → 200. Por IPv6 (`2a07:8240::1`) → 200. Ambos caminos funcionan desde aquí.
- Desde los servidores de Google (PageSpeed, red externa): **timeout total**, no llega ni el HTML.
- La vista previa externa devuelve 302 al login de Lovable: eso es comportamiento normal, no un fallo.

Diagnóstico: la app y el build están bien. El fallo está en la entrega de red del hosting hacia ciertos orígenes/regiones (probable ruta o nodo de borde), o en un bloqueo de red del lado de los equipos que fallan.

## Plan de acción

1. **Comprobar la configuración de publicación** (pública vs privada). Si estuviera privada, los equipos sin sesión de Lovable verían login en vez del sitio. Se revisa y, si aplica y lo apruebas, se pasa a pública.
2. **Republicar el proyecto** para forzar un despliegue nuevo y que se regenere la distribución en el borde. Es la acción con más probabilidad de corregir un nodo de borde en mal estado, y no toca código ni datos.
3. **Reverificar** tras la republicación: respuesta por IPv4 e IPv6, y nueva ejecución de PageSpeed desde red externa (esa prueba la haces tú, sirve como testigo independiente).
4. **Si sigue fallando desde fuera**: es un incidente de hosting de Lovable, no del proyecto. Se documenta la evidencia (IPs, códigos, timeouts, hora) para reportar a soporte de Lovable, y mientras tanto se puede usar `fundacionbasico.com` / `www.fundacionbasico.com` como acceso alternativo si esos sí responden en los equipos afectados.
5. **Datos que necesito de un equipo que falla** para cerrar el caso: qué error exacto muestra el navegador, si falla también con datos móviles, y si `fundacionbasico.com` abre o no.

## Fuera de alcance

No se toca código de la aplicación: ni Woo, ni inventario, ni QR, ni nómina, ni partidas, ni OP, ni base de datos. Sólo ajuste de publicación, republicación y verificación.
