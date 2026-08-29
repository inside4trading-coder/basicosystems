# Ticket para soporte de Lovable — basicosystems.lovable.app inaccesible desde redes externas

Publicar de nuevo no resolvió. La app está sana: el problema es de conectividad/entrega del hosting hacia ciertas redes. Abajo está el texto listo para el ticket.

## Evidencia recogida (29 ago 2026, 18:08 UTC)

- Publicación: `is_published: true`, visibilidad efectiva `public`.
- Dominios `fundacionbasico.com` y `www.fundacionbasico.com`: `active / connected`, y responden 200 desde `185.158.133.1`.
- `basicosystems.lovable.app` resuelve a `185.41.148.1`, `185.41.148.2` (IPv4) y `2a07:8240::1`, `2a07:8240::2` (IPv6).
- Desde la infraestructura de Lovable: 200 por las cuatro IPs, en 0.06–0.19s.
- Desde el navegador del usuario (incluido incógnito, sin caché ni service worker): `ERR_CONNECTION_TIMED_OUT`.
- Desde los servidores de Google (PageSpeed Insights, red independiente): `net::ERR_TIMED_OUT`, la página nunca carga.
- El fallo es por equipo/red: en unas computadoras abre y en otras no. Republicar no lo cambió.

Conclusión: el origen sirve correctamente, pero el borde/red que atiende `*.lovable.app` no es alcanzable desde varias redes externas, incluida la de Google. No es caché, no es el código, no es visibilidad de publicación, no es DNS del cliente.

## Texto para el ticket (copiar y pegar)

Asunto: basicosystems.lovable.app no es alcanzable desde varias redes externas (ERR_CONNECTION_TIMED_OUT)

Proyecto: Basico Hub v1.1
URL publicada: https://basicosystems.lovable.app
Dominios personalizados: fundacionbasico.com y www.fundacionbasico.com (ambos activos)
Fecha del reporte: 29 de agosto de 2026, 18:08 UTC

Problema:
El sitio publicado no carga desde varias computadoras y redes. El navegador muestra "ERR_CONNECTION_TIMED_OUT" (la conexión nunca se establece; no hay respuesta HTTP, no es un error de la aplicación).

Qué ya descartamos:
1. No es caché ni service worker: falla igual en modo incógnito, en equipos que nunca visitaron el sitio.
2. No es la aplicación: el proyecto está publicado y su visibilidad es pública.
3. No es el código ni el build: desde otras redes el mismo sitio devuelve HTTP 200 en menos de 0,2 s.
4. No es un problema puntual de nuestra red: Google PageSpeed Insights, ejecutado desde la infraestructura de Google, también falla con "net::ERR_TIMED_OUT" al analizar https://basicosystems.lovable.app.
5. Republicar el proyecto no cambió nada; el fallo persiste.

Detalle técnico:
- basicosystems.lovable.app resuelve a 185.41.148.1 y 185.41.148.2 (IPv4) y 2a07:8240::1 y 2a07:8240::2 (IPv6).
- Desde redes donde sí funciona, las cuatro direcciones devuelven HTTP 200.
- Desde las redes afectadas, la conexión TCP hacia esas direcciones expira sin respuesta.
- Nuestros dominios personalizados apuntan a 185.158.133.1 y responden HTTP 200.

Impacto:
Es un panel operativo interno. El equipo no puede acceder al sistema desde varias oficinas y equipos, lo que bloquea la operación diaria.

Solicitud:
Revisar el enrutamiento/nodo de borde que atiende *.lovable.app hacia esas redes, ya que el origen sirve correctamente pero el destino no es alcanzable desde múltiples orígenes externos, incluida la red de Google.

## Fuera de alcance

No se modifica código de la aplicación. Este bloque es solo diagnóstico y documentación para soporte.
