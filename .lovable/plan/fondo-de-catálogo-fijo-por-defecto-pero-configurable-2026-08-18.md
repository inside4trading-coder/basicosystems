# Fondo de catálogo fijo por defecto, pero configurable

## Qué se busca
En "Foto para catálogo" el gris del fondo cambia entre generaciones porque hoy lo decide el modelo. La solución es que el color lo controle Basico Studio: gris `#F7F7F7` por defecto, cambiable por generación, y exacto cuando hay recorte (composición local en canvas).

## Comportamiento final
- Default: `#F7F7F7` en toda generación de catálogo.
- Override en el asistente: selector de color + input HEX + botón "Restaurar gris BASICO".
- Override por notas: si en "Detalles clave de la prenda" aparece algo tipo `usar fondo #EFEFEF` / `background color #EFEFEF`, se detecta el HEX.
- Prioridad: color elegido en UI > color detectado en notas > `#F7F7F7`.
- Con recorte PNG: se compone localmente sobre un lienzo del color exacto, sin llamar al modelo (costo 0). El color queda garantizado.
- Sin recorte (generativo): el color se inyecta en el prompt como `Use catalog background color: #XXXXXX` y la UI avisa: "Generativo: el fondo puede variar. Para color exacto usa recorte/fondo transparente."

## Cambios técnicos
1. `src/lib/estudioCompositing.ts`: nueva función `composeCutoutOnSolidColor(cutoutUrl, hexColor, aspect)` que pinta el lienzo del color y dibuja el recorte con la misma sombra de contacto que ya usa la composición sobre fondo.
2. `src/lib/estudioPrompts.ts`: constante `DEFAULT_CATALOG_BG = "#F7F7F7"`, helper `extractBackgroundColorFromNotes(notes)` (regex de HEX de 3/6 dígitos junto a "fondo"/"background") y helper para anexar la línea `Use catalog background color: ...` al prompt.
3. Nuevo `src/components/estudio/CatalogBackgroundField.tsx`: bloque compacto "Color de fondo de catálogo" con `<input type="color">`, input HEX validado, botón restaurar y la nota explicativa. Solo visible cuando el tipo es catálogo.
4. `src/components/estudio/StudioWizard.tsx`: habilita el campo de recorte también para catálogo, renderiza el nuevo bloque y recibe props `catalogBgColor` / `onCatalogBgColorChange`. Muestra el aviso de variación cuando es catálogo sin recorte.
5. `src/pages/EstudioVisual.tsx`: estado del color (persistente al navegar el asistente), resolución de prioridad UI/notas/default, rama de composición extendida a catálogo con recorte (usa la nueva función y guarda el job `completed` con costo 0), y envío del color al prompt en la rama generativa.
6. `supabase/functions/estudio-generate-image/index.ts`: acepta `catalogBackgroundColor` y `backgroundColorSource`, los guarda en el job y anexa la instrucción al `prompt_used`.
7. Migración: `ALTER TABLE public.estudio_image_jobs ADD COLUMN IF NOT EXISTS catalog_background_color text, ADD COLUMN IF NOT EXISTS background_color_source text;` (nullable, sin backfill: los registros previos quedan intactos).

## Metadata guardada por generación
`catalog_background_color`, `background_color_source` (`default` | `ui` | `notes`) y el `composition_mode` que ya existe (`composited` cuando hubo recorte). Se muestran en "Ver detalles" del resultado.

## No se toca
Modelos, fondos dinámicos, prompts base de otros tipos, resultados/historial anteriores, storage ni el flujo de Seedream. El color nunca queda fijo de forma irreversible: es un default editable por generación.

## Verificación
Typecheck y prueba manual: sin elegir color → `#F7F7F7`; eligiendo `#EFEFEF` → ese; notas con `usar fondo #DDDDDD` y sin color UI → `#DDDDDD`; con recorte el pixel de fondo es exacto; sin recorte aparece el aviso.
