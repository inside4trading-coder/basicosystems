# Basico Studio: solo 3 modelos Seedream (ByteDance Seed)

## Estado actual verificado

- La tabla interna `estudio_enabled_models` tiene hoy 5 modelos de imagen habilitados (Gemini 2.5 Flash Image, Gemini 3 Pro Image, Gemini 3.1 Flash Image, GPT-5 Image, GPT-5 Image Mini) y 4 de video.
- El modal "Modelos habilitados" (ModelsTab) lista el catálogo vivo de OpenRouter y marca cuáles están guardados como habilitados.
- El selector del wizard usa `imageModelOptions()`, que combina una lista fija de presentación (`IMAGE_MODEL_PRESENTATION`) con lo habilitado en la tabla. Esa lista fija es la causa de que sigan apareciendo modelos que no queremos.

## Qué se va a hacer

1. Registrar los 3 modelos Seedream en el catálogo interno con nombre amigable:
   - `bytedance-seed/seedream-5.0-lite` — ByteDance Seed: Seedream 5.0 Lite
   - `bytedance-seed/seedream-5.0-pro` — ByteDance Seed: Seedream 5.0 Pro
   - `bytedance-seed/seedream-4.5` — ByteDance Seed: Seedream 4.5
2. Dejar esos 3 como los únicos modelos de imagen habilitados; los demás quedan deshabilitados (no se borran, se pueden reactivar desde el modal).
3. Reemplazar la lista fija de presentación por los 3 Seedream, para que el selector del wizard muestre exactamente lo mismo que el modal.
4. Hacer que "Actualizar catálogo" nunca elimine estos 3: si OpenRouter no los devuelve en su listado, igual aparecen en el modal como filas gestionables (ya existe ese mecanismo para modelos guardados; se ajusta para que los Seedream no se marquen como "ya no existe" de forma alarmante y sigan activables).
5. Mantener intacto el flujo de generación: solo cambia el `model_id` que se envía; composición local con PNG recortado sigue sin llamar IA.

## Detalles técnicos

- Migración de datos sobre `estudio_enabled_models`: upsert de los 3 IDs con `kind = 'image'`, `label` amigable, `is_enabled = true`; y `update ... set is_enabled = false` para el resto de `kind = 'image'`.
- `src/lib/estudioModels.ts`: `IMAGE_MODEL_PRESENTATION` pasa a contener solo los 3 Seedream (tiers: Lite = Borrador, 4.5 = Balance, 5.0 Pro = Calidad final). `imageModelOptions` sigue añadiendo extras habilitados manualmente, así que el modal sigue siendo la fuente de verdad.
- `src/components/estudio/config/ModelsTab.tsx`: los modelos guardados que no vengan en el catálogo de OpenRouter se muestran igual y se pueden alternar; se reserva la etiqueta roja "ya no existe" solo para los que no estén en la lista curada.
- Sin cambios en las Edge Functions de generación.

## Verificación

- Consulta a la tabla confirmando 3 habilitados y 0 restantes activos en `image`.
- Modal "Modelos habilitados": los 3 Seedream visibles y alternables.
- Wizard: selector muestra únicamente los 3.
- Typecheck en 0 errores.
