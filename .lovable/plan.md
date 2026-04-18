

## Plan: Eliminar código de Trello y Zadarma SIP/PBX (no usados)

### Contexto
Trello y Zadarma SIP/PBX/WebRTC tienen claves "NA" (placeholder, no funcionales). El resto de secretos (Brevo, WooCommerce, Zadarma KEY/SECRET para historial de llamadas, Notion) sí están sincronizados y deben quedarse.

### Qué se elimina

**Edge Functions (eliminar carpeta + deploy delete):**
- `supabase/functions/trello-explore/`
- `supabase/functions/zadarma-webrtc-key/`

**Frontend:**
- `src/components/llamadas/ZadarmaWebPhone.tsx` (componente del webphone)
- Quitar import + render de `<ZadarmaWebPhone />` donde sea que se monte (probablemente `AppLayout.tsx` o `Llamadas.tsx`).

### Qué se conserva

- `supabase/functions/zadarma-sync/index.ts` → usa `ZADARMA_KEY` y `ZADARMA_SECRET` para análisis histórico de llamadas (per memoria `mem://features/llamadas`: "Zadarma integration is strictly historical analysis, no web dialing"). Este se queda intacto.
- Secretos `ZADARMA_KEY` / `ZADARMA_SECRET` → siguen necesarios para `zadarma-sync`.
- Secretos `ZADARMA_SIP_LOGIN`, `ZADARMA_PBX_EXTENSION`, `ZADARMA_PBX_HOST`, `TRELLO_*` → quedan en "NA" en el panel de secretos. No los borro porque la herramienta de secretos no los expone para borrar; quedan inertes al no haber código que los lea.

### Verificación previa que haré antes de tocar nada

1. `code--search_files` por `ZadarmaWebPhone` → confirmar dónde se importa/renderiza.
2. `code--search_files` por `trello-explore` y `zadarma-webrtc-key` → confirmar que no haya invocaciones desde el frontend.
3. `code--search_files` por `TRELLO_`, `ZADARMA_SIP`, `ZADARMA_PBX` en `supabase/functions/` → confirmar que solo viven en las funciones a eliminar.

### Archivos que cambiarán

| Archivo | Acción |
|---|---|
| `supabase/functions/trello-explore/index.ts` | Eliminar carpeta + delete edge function |
| `supabase/functions/zadarma-webrtc-key/index.ts` | Eliminar carpeta + delete edge function |
| `src/components/llamadas/ZadarmaWebPhone.tsx` | Eliminar archivo |
| `AppLayout.tsx` o `Llamadas.tsx` (a confirmar) | Quitar import + JSX `<ZadarmaWebPhone />` |

### Lo que NO se toca

- `zadarma-sync` y toda la pantalla de Llamadas (analytics histórico).
- Memoria del proyecto (la regla "Zadarma = solo histórico" ya está vigente y este cambio la refuerza).
- Otras integraciones (Brevo, Woo, Notion).

### Entregable
Lista final de archivos eliminados/modificados y confirmación de que el build sigue limpio (sin imports rotos).

