# Fondo dinámico — selector de fondos con prompt por fondo + modelo

Evolución del flujo actual de Basico Studio. No se reconstruye el módulo ni se toca Foto para catálogo, Fondo transparente, formatos, navegación ni resultados recientes.

## Lo que ya existe (verificado)

- Pantalla `src/pages/EstudioVisual.tsx`: orquesta todo (estado de tipo, formato, modo, prompt, modelo) y llama a la Edge Function `estudio-generate-image`.
- Modal único `src/components/estudio/StudioWizard.tsx` con pasos 1 Tipo, 2 Prenda, 3 Formato, 4 Generar + acordeón "Avanzado" (Modelo de IA, "Prompt para esta generación", y los botones Estilos de fotografía / Modelos habilitados / Preset de marca).
- Cards de entrada: `StudioActionCards.tsx` (catálogo, transparente, dinámico + dos en construcción).
- Modelos: tabla `estudio_enabled_models` (5 modelos de imagen activos hoy: Gemini 2.5 Flash Image, Gemini 3 Pro Image, Nano Banana 2, GPT-5 Image, GPT-5 Image Mini), leída por `src/lib/estudioModels.ts` y administrada en `config/ModelsTab.tsx`, que además consulta el catálogo vivo de OpenRouter vía la función `estudio-list-models`. Ese es el único source of truth de modelos y es el que consumirán los fondos.
- Prompts: tabla `estudio_prompt_presets` (estilos por `photo_type`). Hoy "Fondo dinámico" resuelve el preset `mockup` y su texto se precarga en el textarea "Prompt para esta generación", que se manda como `promptOverride`.
- Imágenes: bucket privado `estudio-visual` (`src/lib/estudioStorage.ts`, subida + signed URLs). La Edge Function baja las referencias del bucket en base64 y las manda a OpenRouter como `input_references` (prenda primero, modelo después).
- Un solo proveedor real: OpenRouter con el secret `OPENROUTER_API_KEY`.

## Cambios propuestos

### 1. Nueva persistencia (migración, aditiva)

Dos tablas nuevas, nada destructivo, mismas políticas RLS que el resto de `estudio_*` (admin/manager) más GRANTs:

- `estudio_backgrounds`: `id`, `name`, `slug`, `cover_path`, `reference_path`, `is_active`, `sort_order`, timestamps.
- `estudio_background_prompts`: `id`, `background_id` (FK cascade), `model_id`, `prompt_text`, timestamps, con **UNIQUE (background_id, model_id)** para que no haya duplicados por combinación.

Seed: los 4 fondos (Asfalto POV, Concreto Crudo, Línea Industrial, Parking Grid) con `sort_order` 1–4 y `is_active = true`. **No se crea ninguna fila de prompt**: todas las combinaciones fondo+modelo nacen vacías, sin defaults ni fallback.

Las 4 imágenes adjuntas se suben sin modificar al bucket privado `estudio-visual`, en la carpeta `fondos/`, y se usan a la vez como `cover_path` y `reference_path` de su fondo (campos separados, aunque de inicio apunten al mismo archivo): asfalto con zapatos → Asfalto POV, concreto liso → Concreto Crudo, línea amarilla diagonal → Línea Industrial, varias líneas amarillas → Parking Grid. El recorte 1:1 es solo visual en la card (`aspect-square` + `object-cover`); no se altera ni recorta el archivo original y no se usan placeholders.

### 2. Paso "Fondo" dentro del modal existente

En `StudioWizard.tsx`, solo cuando `kind === "dinamico"`, se inserta un paso entre Tipo y Prenda usando el mismo componente `Step` y el mismo lenguaje visual:

- Grid compacta de cards (2 col. móvil / 3 col. desktop) con imagen cuadrada, nombre, hover y estado seleccionado con check discreto. Sin descripciones.
- Quinta card `+ Agregar fondo`.
- Solo se listan los fondos `is_active`, ordenados por `sort_order`.

El resto de los pasos y de los tipos queda intacto.

### 3. Alta y edición de fondos

Se reutiliza `ManageDialogButton` (patrón ya usado para Estilos/Modelos/Marca) con un nuevo contenido `config/BackgroundsTab.tsx`:

- Lista administrativa con activos e inactivos.
- Formulario compacto: Nombre, preview + cambiar portada, preview + cambiar referencia, Activo/Inactivo, Orden.
- "Prompts por modelo" en **tabs por modelo** (uno por cada modelo de imagen habilitado, leídos de `estudio_enabled_models`), un textarea por tab, todos vacíos al inicio. Al agregarse un modelo nuevo en el futuro aparece automáticamente.
- Una única acción **Guardar cambios** (upsert por `(background_id, model_id)`; un textarea vacío no crea fila).

### 4. Resolución fondo + modelo → prompt

En `EstudioVisual.tsx`:

- Al abrir el wizard en modo dinámico se cargan los fondos y sus prompts.
- `resolveBackgroundPrompt(backgroundId, modelId)` devuelve exactamente esa combinación o `null`. Sin fallback entre modelos ni al preset genérico.
- Si es `null`: botón **Generar** deshabilitado y aviso discreto — "Falta configurar el prompt de {Fondo} para {Modelo}."
- Al generar: el prompt enviado es `prompt del preset (fondo+modelo)` + la instrucción extra que el usuario haya escrito en "Prompt para esta generación", que **no** modifica el preset guardado. En catálogo y transparente el textarea sigue comportándose exactamente como hoy (precargado con el estilo).
- La imagen de referencia del fondo se manda como referencia adicional a la Edge Function. Esto requiere un cambio mínimo y aditivo en `estudio-generate-image`: aceptar `backgroundReferencePath` opcional y añadirlo a `input_references` tras la prenda, con la nota de posición en el prompt. Nada más cambia en esa función.
- El resumen del paso Generar añade la línea `Fondo: {nombre}` solo para dinámico, con el mismo diseño actual.

### 5. Modelos habilitados con estado de conexión

Se amplía `config/ModelsTab.tsx` (no se reescribe): además del switch actual, cada fila muestra nombre, proveedor (derivado del prefijo `vendor/` del `model_id`, que es lo único disponible), habilitado, y un badge de estado de conexión con botón "Comprobar".

Comprobación real, sin simular: nueva función `estudio-check-model` que hace una llamada mínima al endpoint de OpenRouter con la key del servidor y devuelve `conectado` / `error` con el mensaje. Sin comprobar es el estado inicial (no persistido); nunca se muestra "Conectado" sin una respuesta real. Todos los modelos actuales pasan por OpenRouter, así que la comprobación aplica a todos.

## Qué NO se toca

Navegación lateral, `StudioActionCards`, `StudioResults`, naming/descargas, Preset de marca, motion/video, formatos, tipos catálogo y transparente, tablas y datos existentes, RLS ajena a esta funcionalidad.

## Secuencia de implementación

1. Migración de las dos tablas + RLS + GRANTs + seed de los 4 fondos (sin prompts) y subida de las 4 imágenes al bucket.
2. Capa de datos `src/lib/estudioBackgrounds.ts` (leer fondos, leer/guardar prompts).
3. Paso "Fondo" en el wizard + estado en `EstudioVisual.tsx` + línea en el resumen.
4. Validación de prompt faltante (Generar deshabilitado + aviso).
5. `BackgroundsTab.tsx` (crear/editar, tabs de prompts por modelo).
6. Cambio aditivo en `estudio-generate-image` + envío de la referencia del fondo.
7. Estado de conexión en `ModelsTab` + función `estudio-check-model`.
8. Verificación: typecheck y revisión visual del modal en móvil y desktop.
