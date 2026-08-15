# Botón "Guardar como prompt base" en Fondo dinámico

Añadir, dentro del wizard de Fondo dinámico y justo debajo del textarea "Prompt para esta generación", un botón que persista el texto actual como prompt permanente de la combinación **fondo seleccionado + modelo seleccionado**.

## Cambios

### 1. `src/components/estudio/StudioWizard.tsx`

- Añadir props:
  - `onSavePromptBase?: () => void` — guarda el texto actual como prompt base.
  - `hasPromptBase?: boolean` — indica si ya existe un prompt guardado para la combinación activa.
- Renderizar el botón solo cuando `kind === "dinamico"`, debajo del textarea "Prompt para esta generación" y su hint "Aplica solo a esta generación".
- Etiqueta:
  - `Guardar como prompt base` si `!hasPromptBase`.
  - `Actualizar prompt base` si `hasPromptBase`.
- Estado del botón: deshabilitado mientras `!backgroundId`, `!imageModel`, `!promptText.trim()` o `onSavePromptBase` no esté definido; mostrar spinner si se está guardando.

### 2. `src/pages/EstudioVisual.tsx`

- Implementar `handleSavePromptBase` que:
  1. Valide `backgroundId` e `imageModel`.
  2. Llame a `saveStudioBackgroundPrompts(backgroundId, { [imageModel]: promptText })`.
  3. Tras guardar, recargue `backgroundPrompts` vía `loadStudioBackgroundPrompts()` y actualice el estado.
  4. Muestre el toast `Prompt base guardado`.
- Pasar al `StudioWizard`:
  - `onSavePromptBase={handleSavePromptBase}`
  - `hasPromptBase={resolvedBackgroundPrompt !== null}`

### 3. Comportamiento observado tras guardar

- El aviso amarillo "Este fondo no tiene prompt configurado para el modelo elegido" desaparece inmediatamente.
- El botón **Generar** pasa a estar habilitado (ya que `resolvedBackgroundPrompt` ya no es `null`).
- El textarea conserva el texto guardado; el usuario puede seguir editándolo y volver a pulsar "Actualizar prompt base".

## Qué NO se toca

- No se crea ninguna tabla nueva.
- No se modifica la Edge Function `estudio-generate-image`.
- No se cambia la lógica de resolución de prompts (`resolveBackgroundPrompt`).
- No se alteran los otros tipos de generación (catálogo, transparente).
- No se toca `BackgroundsTab.tsx` ni la administración de fondos.

## Verificación

- Typecheck sin errores.
- En el wizard de Fondo dinámico:
  - sin prompt base guardado aparece "Guardar como prompt base";
  - tras guardar cambia a "Actualizar prompt base";
  - el aviso de prompt no configurado desaparece;
  - el botón Generar se habilita.
