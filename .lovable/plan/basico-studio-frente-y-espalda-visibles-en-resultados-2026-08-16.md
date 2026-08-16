# Basico Studio — Frente y espalda visibles en resultados

## Qué está pasando realmente

La generación multi-vista ya funciona: al subir frente y espalda se hacen dos llamadas separadas a la función de generación, una por vista, con el mismo fondo, formato, modelo y prompt, y cada trabajo guarda su `source_photo_path`, su `view_type` y su `image_model`.

El fallo está solo en la galería. Cuando el set no es carrusel, la card de resultados muestra únicamente la primera imagen del grupo; la segunda (espalda) se genera y se guarda, pero nunca se pinta. Los botones de descarga sí listan las dos, por eso la sensación de que "se perdió" una imagen.

No hace falta cambiar el flujo de generación, ni la base de datos, ni la función de servidor.

## Cambios

### 1. Card de resultados con galería por vista
En la card de un set con varias imágenes (aunque sea "Individual"):
- miniaturas por vista arriba (Frente / Espalda / Detalle / Tres cuartos) y la imagen seleccionada en grande;
- badge pequeño sobre la imagen activa: "Vista: Frente", "Vista: Espalda", etc.;
- el subtítulo pasa a decir, por ejemplo, "Foto catálogo · 2 vistas" en vez de solo "Individual";
- orden fijo: Frente, Espalda, Detalle, Otro (tres cuartos).

### 2. Descargas por vista
Los botones de descarga se etiquetan con la vista en lugar de un número, y el nombre de archivo añade el sufijo de vista manteniendo el correlativo actual (`BASICO-STUDIO-0039-01-frente.png`).

### 3. Detalle del resultado
"Ver prompt" pasa a mostrar por cada vista: vista, imagen fuente usada, modelo, fondo, formato y prompt, e indica si fue generación individual, multi-vista o carrusel.

### 4. Carrusel
Sin cambios de comportamiento: sigue generando cuatro escenas del frente. Si además hay vistas opcionales cargadas, el orden de la galería respeta Frente, Espalda, Detalle, Otro.

## Detalles técnicos

- `src/components/estudio/StudioResults.tsx`: galería interna con selección de vista, badge de vista, subtítulo con número de vistas, botones de descarga por vista.
- `src/lib/estudioNaming.ts`: etiquetas de vista y sufijo de vista en el nombre de archivo.
- `src/pages/EstudioVisual.tsx`: pasar la vista al descargar y ampliar el contenido del diálogo "Ver prompt" con fuente, modelo, fondo y formato.
- Sin migraciones, sin tocar la Edge Function, sin cambios de modelos, prompts, costos ni cards de inicio.
- Verificación: `tsgo` en 0 errores y prueba visual con un set de frente + espalda existente.
