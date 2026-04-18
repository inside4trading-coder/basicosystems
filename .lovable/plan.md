
## Objetivo
Cuando alguien envíe el formulario de contacto del landing, enviar automáticamente un email a `hola@musacreativo.com` con los datos del lead (además de seguir guardándolo en la BD).

## Pre-requisito: dominio de email
No hay dominio de email configurado. Para enviar emails desde tu propia marca (recomendado), primero hay que configurar un dominio remitente — esto mejora la entregabilidad y evita spam. Te mostraré el botón de configuración al final.

## Plan de implementación

1. **Configurar dominio remitente** (vía botón al final): el usuario elige el dominio (ej. `notify.basicosystems.com`).
2. **Setup de infraestructura de emails** (`setup_email_infra`): crea la cola, tablas, cron, etc.
3. **Scaffold de app emails** (`scaffold_transactional_email`): crea las Edge Functions `send-transactional-email`, `handle-email-unsubscribe`, `handle-email-suppression`.
4. **Crear template** `supabase/functions/_shared/transactional-email-templates/landing-lead-notification.tsx`:
   - Asunto: `Nuevo lead desde la landing — {name}`
   - Props: `name`, `brand`, `email`, `interest`, `message`
   - Estilo: blanco con acento rojo Basico (#E3001B), tipografía Inter
5. **Registrarlo** en `_shared/transactional-email-templates/registry.ts`.
6. **Crear página** `/unsubscribe` (ruta que indique el scaffold) para el unsubscribe link.
7. **Modificar `src/pages/Landing.tsx`** → tras el `insert` exitoso, invocar:
   ```ts
   supabase.functions.invoke('send-transactional-email', {
     body: {
       templateName: 'landing-lead-notification',
       recipientEmail: 'hola@musacreativo.com',
       idempotencyKey: `landing-lead-${insertedId}`,
       templateData: { name, email, brand, interest, message },
     },
   });
   ```
   (Necesitamos `.select('id').single()` en el insert para tener un id único para idempotencia.)
8. **Deploy** de las Edge Functions.

## Notas
- El email al lead (confirmación "Recibido, volvemos en 48h") queda **fuera de alcance** salvo que lo pidas — solo notificamos a `hola@musacreativo.com`.
- Una vez configurado el dominio, todas las respuestas del form llegarán automáticamente al buzón.

<lov-actions>
<lov-open-email-setup>Configurar dominio de email</lov-open-email-setup>
</lov-actions>
