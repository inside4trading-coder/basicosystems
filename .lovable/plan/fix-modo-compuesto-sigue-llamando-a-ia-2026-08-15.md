# Fix: modo compuesto sigue llamando a IA

## Qué está pasando (verificado en el código)

En `StudioWizard.tsx` el botón Generar exige `views.frente.file` y en `EstudioVisual.tsx` `handleGenerate` corta con "Sube la foto frontal de la prenda" si no hay foto frontal. El PNG recortado vive en un selector aparte, opcional y al final del paso 2.

El bypass compuesto se decide con `Boolean(cutout.file)`. Si el usuario sube su PNG en el selector de foto frontal (el slot obligatorio y visible), `cutout.file` queda vacío, `useComposition` es `false` y el flujo entra al camino generativo → `functions.invoke("estudio-generate-image")` → OpenRouter 400.

Es decir: la condición no está rota en sí misma, pero depende de un campo opcional mientras el campo obligatorio es otro, así que en la práctica casi nunca se activa.

## Cambios

### 1. El recorte manda (EstudioVisual.tsx)
- Calcular la decisión de modo antes de cualquier validación de foto frontal.
- `willUseComposedMode = (kind === "transparente" || kind === "dinamico") && hay archivo de recorte`.
- Con modo compuesto no se exige foto frontal ni prompt ni modelo: se sube el PNG a cutouts, se compone (dinámico) o se guarda tal cual (transparente) y se retorna, sin tocar la edge function.
- Fondo dinámico compuesto sigue exigiendo fondo seleccionado; si falta la imagen del fondo, error claro y sin fallback generativo.
- Job insertado igual que hoy: `composition_mode` `composited` / `cutout_ready`, `cutout_path`, `composition_path`, `background_reference_path`, `cost_usd = 0`, `prompt_used = null`, `fidelity_pipeline_version = 1`, `composition_params` solo si es compuesto.

### 2. El PNG recortado deja de estar escondido (StudioWizard.tsx)
- En Fondo transparente y Fondo dinámico, subir el selector de "PNG recortado" al inicio del paso 2, con etiqueta clara de que activa el modo compuesto.
- Banner "Modo compuesto activo — No se llamará a IA. Costo 0." visible junto al recorte y en el paso Generar.
- El botón Generar deja de exigir foto frontal cuando hay recorte: con recorte solo pide fondo (en dinámico). Sin recorte, las reglas actuales quedan igual.

### 3. Log temporal de diagnóstico
Antes de decidir el flujo, un `console.log("BASICO_STUDIO_MODE_DECISION", { kind, hasCutoutFile, cutoutPath, backgroundReferencePath, willUseComposedMode })`.

## Validación
- Caso A: dinámico + PNG → sin `functions.invoke`, `composition_mode = composited`, costo 0, badge Compuesto.
- Caso B: transparente + PNG → sin IA, `cutout_ready`, costo 0, badge Recorte listo.
- Caso C: dinámico sin PNG → flujo generativo actual sin cambios.
- Se verifica en el navegador que en A y B no haya request a la edge function, y typecheck limpio.

## No se toca
Edge function, modelos, prompts, costos, fondos, historial, cards ni rutas.
