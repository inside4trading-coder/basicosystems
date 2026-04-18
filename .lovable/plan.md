
## Problema

Las llamadas salientes sí están grabadas en Zadarma, pero el endpoint `statistics/pbx` v2 **no devuelve la URL de grabación** para llamadas outgoing. Por eso `recording_url` queda vacío. En la BD vemos que todas tienen `pbx_call_id` (ej. `out_ad70c8bf…`), que es el identificador necesario para pedir el enlace.

Zadarma expone un endpoint específico: **`GET /v1/pbx/record/request/?pbx_call_id=<id>`** que devuelve un link temporal a la grabación (mp3).

## Solución

En `supabase/functions/zadarma-sync/index.ts`, después de mapear las llamadas, para las que cumplan:
- `direction === "outgoing"`
- `pbx_call_id` empieza con `out_`
- `talk_duration > 0` (sólo contestadas tienen audio)
- `recording_url` vacío

…hacer una llamada paralela limitada (concurrencia 5) a `pbx/record/request/` y guardar el link en `recording_url` + `is_recorded = true`. Las incoming, que sí traen `recording`, siguen igual.

### Cambios

1. **`zadarmaRequest`**: ya sirve, sólo se invocará con el nuevo método.
2. **Nueva función** `fetchRecordingUrl(pbxCallId, key, secret)` que:
   - Llama a `pbx/record/request/` con `pbx_call_id` y `lifetime=5184000` (60 días).
   - Devuelve `data.link` o `null` si falla (sin lanzar — para no romper el sync entero).
3. **Bucle de enriquecimiento** tras `calls.map(...)` y antes del upsert: procesar en lotes de 5 concurrentes para respetar el rate limit de Zadarma (~10 req/s).
4. **Misma lógica para incoming sin URL** (algunas también la requieren bajo demanda) — pasar el filtro a "cualquier llamada answered sin recording_url y con pbx_call_id".
5. **Caché**: si una llamada ya tiene `recording_url` en BD, no re-pedirla. Para esto, antes del enriquecimiento hacer un `select call_id, recording_url from calls_cache where call_id in (...)` y saltar las que ya tengan link.

### Archivos a tocar

- `supabase/functions/zadarma-sync/index.ts` — añadir `fetchRecordingUrl` + bloque de enriquecimiento.

Sin migraciones, sin cambios en frontend. El reproductor existente en `Llamadas.tsx` ya consume `recording_url`, así que en cuanto se rellene, el botón "Reproducir" funcionará para outgoing.

## Resultado esperado

Tras un re-sync (manual o el próximo automático), las 8 llamadas outgoing answered tendrán `recording_url` poblado y se podrán reproducir desde el módulo Llamadas.
