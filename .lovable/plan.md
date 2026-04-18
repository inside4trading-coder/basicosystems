
El usuario quiere reutilizar el dominio de Brevo (ya configurado para campañas) en lugar de configurar el sistema de emails de Lovable.

## Plan: enviar notificaciones del form vía Brevo Transactional API

Brevo ya está integrado (`BREVO_API_KEY` existente, usado en `brevo-campaigns` y `brevo-sync-contacts`). Tiene endpoint `POST /smtp/email` para emails transaccionales que usa los senders ya verificados en la cuenta.

### Pasos

1. **Crear Edge Function `send-landing-lead-notification`** (`supabase/functions/send-landing-lead-notification/index.ts`):
   - Recibe `{ name, email, brand, interest, message, leadId }`.
   - Llama a `https://api.brevo.com/v3/smtp/email` con `BREVO_API_KEY`.
   - Sender: `{ name: "Basico Landing", email: "crew@basicoclothes.com" }` (sender ya activo en Brevo según `brevo-campaigns`).
   - To: `hola@musacreativo.com`.
   - ReplyTo: el email del lead (para responder directo).
   - Subject: `Nuevo lead desde la landing — {name}`.
   - HTML: tabla limpia con los campos (nombre, email, marca, interés, mensaje) + estilo Basico (rojo #E3001B, Inter, blanco).
   - CORS headers + manejo de errores.
   - `verify_jwt = false` en `supabase/config.toml` (form público).

2. **Modificar `src/pages/Landing.tsx`**:
   - En el `onSubmit`, tras el `insert` exitoso en `landing_leads`, añadir `.select('id').single()`.
   - Invocar `supabase.functions.invoke('send-landing-lead-notification', { body: {...} })` con los datos del form.
   - Errores del envío no bloquean el éxito del form (solo log a consola).

3. **Deploy** de la nueva Edge Function.

### Fuera de alcance
- Confirmación al lead.
- Cambiar el sender (se usa el verificado actual de Brevo).
- Tocar la infra de Lovable Emails.
