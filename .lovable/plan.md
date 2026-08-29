# Acceso intermitente a basicosystems.lovable.app — nuevo diagnóstico

Tienes razón: si falla también en incógnito, la caché y el service worker no son la causa. Descarto el plan anterior (kill switch) y cambio el enfoque a diagnóstico de red/entrega.

## Lo verificado ahora

- `https://basicosystems.lovable.app` responde **200** en 0.13s desde fuera.
- La vista previa externa responde **302** (redirección a login de Lovable: es normal, las previews exigen sesión Lovable).
- No hay error de servidor ni de dominio.

Conclusión: el sitio está sano en origen. El fallo ocurre entre el equipo del usuario y el servidor, o es un bloqueo de sesión/permiso, no de la app.

## Hipótesis a descartar, en orden

1. **Red/DNS local del equipo**: DNS corporativo o del ISP que no resuelve `*.lovable.app`, o red que bloquea el dominio (firewall, filtrado de contenido, antivirus con inspección TLS).
2. **IPv6**: el servidor responde por IPv6; equipos con IPv6 mal configurado pueden quedarse colgados sin error claro.
3. **Confusión preview vs publicado**: las vistas previas externas siempre piden login de Lovable; sólo el link publicado es abierto. Puede que en los equipos "que no abren" se esté probando el link de preview.
4. **Visibilidad de publicación**: si la publicación está en modo privado, el sitio pide iniciar sesión en Lovable y sólo entra quien es miembro del workspace. Esto explicaría exactamente "abre en unas computadoras y en otras no".

## Pasos del plan

1. Revisar la configuración de visibilidad de publicación del proyecto (pública vs privada). Si está privada, esa es la causa más probable del patrón por computadora, y se corrige cambiándola a pública (con tu aprobación).
2. Confirmar contigo qué URL exacta se usa en los equipos que fallan y qué se ve: pantalla en blanco, error del navegador, o pantalla de login de Lovable.
3. Si la visibilidad ya es pública, pedir en un equipo que falla:
   - abrir `https://basicosystems.lovable.app` y decir el mensaje exacto de error;
   - probar desde datos móviles / otra red;
   - probar `ping basicosystems.lovable.app` para ver si resuelve DNS.
4. Según el resultado, cerrar con la causa concreta (red del cliente, DNS, o visibilidad) — no se toca código de la app.

## Fuera de alcance

No se modifica ningún módulo: ni Woo, ni inventario, ni QR, ni nómina, ni partidas, ni OP. Este bloque es sólo diagnóstico y, como mucho, un cambio de ajuste de publicación.
