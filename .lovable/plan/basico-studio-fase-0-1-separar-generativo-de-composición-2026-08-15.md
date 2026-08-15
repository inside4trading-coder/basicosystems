# Basico Studio — Fase 0/1: separar Generativo de Composición

Objetivo: dejar de vender como "transparente real" lo que hoy es una imagen recreada por IA, y dejar montada la estructura para composición real por capas. Sin tocar cards, historial, modelos, costos, rutas ni resultados anteriores.

## De dónde sale el recorte en esta fase

No hay segmentación automática todavía. En Fase 0/1 el `cutout_path` entra de una sola forma: el usuario sube (opcional) un **PNG ya recortado con transparencia** en el paso de fotos del asistente. Si lo sube, el sistema compone de verdad. Si no lo sube, sigue el flujo generativo actual, marcado como tal. La segmentación automática queda para Fase 2.

## 1. Base de datos (una migración aditiva)

Sobre `estudio_image_jobs` (ya tiene `source_photo_path`, que se reutiliza como `source_image_path`):

- `mask_path` text null
- `cutout_path` text null
- `background_reference_path` text null
- `composition_path` text null
- `composition_mode` text not null default `'generative'` con check en (`generative`, `cutout_ready`, `composited`)
- `fidelity_pipeline_version` int not null default `1`

Sin cambios de RLS ni de grants: la tabla ya está gobernada por `has_role(admin|manager)`. Los jobs existentes quedan en `generative`, que es exactamente lo que fueron.

## 2. Lenguaje de confianza

- Se elimina la promesa de "PNG transparente real" del texto de Fondo transparente. Pasa a: "Generativo: el modelo intenta aislar la prenda; puede alterar detalles."
- Si el usuario sube el PNG recortado, ese texto se reemplaza por "Recorte listo: se usa tu capa de prenda sin recrearla."
- El sufijo de prompt de transparente se sigue usando solo en modo generativo.

## 3. Asistente (`StudioWizard.tsx`, `EstudioVisual.tsx`)

- Nuevo campo opcional **"PNG recortado de la prenda (opcional)"** en el paso de fotos, visible en Fondo transparente y Fondo dinámico. Acepta solo `image/png`. Se sube al bucket `estudio-visual` (carpeta `cutouts/`) reutilizando el patrón de `uploadEstudioSourcePhoto`.
- Fondo transparente con cutout: no se llama al modelo. El PNG subido se registra como resultado del job con `composition_mode = 'cutout_ready'`, costo 0.
- Fondo dinámico con cutout: no se llama al modelo. Se compone en el navegador con Canvas (extendiendo `src/lib/estudioCompositing.ts`): imagen de fondo del preset como capa base al formato elegido, prenda recortada centrada encima con escala controlada, y sombra de contacto simple (elipse difuminada bajo la prenda). El PNG resultante se sube y se guarda en `composition_path` con `composition_mode = 'composited'`, costo 0.
- Sin cutout: el flujo actual no cambia (misma edge function, mismo prompt, mismo costo) y el job queda `generative` con el aviso correspondiente.

## 4. Edge function `estudio-generate-image`

Cambio mínimo: persistir `background_reference_path` y `composition_mode = 'generative'` y `fidelity_pipeline_version = 1` en el job. Nada más — no se toca la lógica de modelos, tamaños ni costos.

## 5. UI de resultados (`StudioResults.tsx`)

Badge pequeño por resultado, junto al estado actual:

- **Generativo** — "puede alterar detalles de la prenda"
- **Recorte listo** — PNG entregado tal cual se subió
- **Compuesto** — "usa recorte/capa de la prenda sobre fondo real"

Se lee de `composition_mode`; los resultados viejos muestran Generativo.

## 6. Validación

- El job guarda `source_photo_path` siempre.
- Con PNG recortado: guarda `cutout_path`; en dinámico guarda además `composition_path` y no llama al modelo.
- Sin PNG recortado: cae a `generative` y muestra el aviso.
- El flujo actual sigue funcionando igual.
- `npm run typecheck` en 0 errores.

## Pendiente para Fase 2

Segmentación automática (máscara real desde la foto original, `mask_path`), integración de luz y color entre prenda y fondo, sombra proyectada según la dirección de luz del fondo, y composición en backend para lotes/carrusel.

## Detalles técnicos

Tablas `estudio_*` siempre vía `estudioDb`. La composición vive en `src/lib/estudioCompositing.ts` (ya usa Canvas y `drawCover`), sin dependencias nuevas. Storage sigue en el bucket `estudio-visual`.
