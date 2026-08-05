# Estudio Visual: foto de modelo real + video de campaña

Permitir adjuntar la foto de una persona real junto a la foto de la prenda, para que la imagen generada muestre a ese modelo llevando esa prenda, y desde ahí lanzar el video de campaña. Incluye la corrección del parámetro de dimensiones que hoy no tiene efecto.

## 1. Base de datos (una migración nueva, aditiva, aplicada por mí)

- `estudio_image_jobs`: nuevas columnas `model_photo_path` (texto, opcional) y `uses_model_reference` (booleano, por defecto falso) para poder etiquetar el resultado como síntesis.
- `estudio_prompt_presets`: normalizar el valor de dimensiones de `1080x1350 / 1080x1080 / 1080x1920` a `4:5 / 1:1 / 9:16` (relación de aspecto, que es lo que la API sí entiende).
- `estudio_motion_presets`: insertar tres presets de campaña con persona:
  - Caminata hacia cámara
  - Giro de cuerpo completo
  - Apertura desde el detalle de la prenda al plano entero

  Cada prompt insiste en mantener rostro y prenda sin alterarse durante todo el clip.
- Sin cambios de RLS: las tablas ya usan `has_role(admin|manager)`.

## 2. Pantalla (`src/pages/EstudioVisual.tsx`)

- Nuevo bloque **"Modelo de referencia (opcional)"** junto a "Vistas de la prenda", reutilizando `ViewPhotoPicker` y `uploadEstudioSourcePhoto` (bucket `estudio-visual`).
- Solo visible cuando el estilo elegido es de tipo `modelo`; con otros estilos se oculta.
- Nota fija en el bloque: subir únicamente fotos de personas que dieron su consentimiento para este uso.
- El desplegable "Dimensiones" pasa a mostrar relaciones de aspecto (4:5 vertical, 1:1 cuadrado, 9:16 story) y se envía como tal.
- Etiquetado: las imágenes generadas con foto de modelo llevan el distintivo **"Modelo sintetizado a partir de una foto de referencia"** en la tarjeta de resultado y en el historial, con la misma disciplina que "Inferido por IA".

## 3. Generación de imagen (`supabase/functions/estudio-generate-image`, redesplegada por mí)

- `input_references` pasa a admitir dos imágenes, prenda primero y modelo después; sin foto de modelo el comportamiento actual queda idéntico.
- Cuando hay foto de modelo, se concatena al prompt del preset la instrucción que nombra las referencias por posición: la primera es la prenda, la segunda es la persona, que debe reproducirse sin alterar (rostro, tono de piel, tipo de cuerpo, cabello) y vestirse con la prenda respetando corte, color, textura y todo detalle de diseño o texto.
- Validación previa contra `GET /api/v1/images/models`: si el modelo elegido publica `input_references.max < 2`, se devuelve un error legible (`json(200, { error })`, el patrón del módulo) en vez de dejar que OpenRouter responda 400.
- **Corrección del bug de dimensiones**: se deja de mandar `size` (que ningún modelo del catálogo publica) y se manda `aspect_ratio`; además `resolution` solo cuando el modelo lo publica en el catálogo.
- Se persisten `model_photo_path` y `uses_model_reference` en el job.

## 4. Video

El flujo de dos pasos no cambia: primero se genera y revisa la foto, y recién ahí `MotionPanel` lanza el video desde esa imagen vía `frame_images` / `first_frame`. `estudio-generate-video` no se toca. Los nuevos presets de movimiento aparecen automáticamente en el desplegable de movimiento.

No se implementa reference-to-video (mandar prenda y modelo directo al modelo de video): queda para después.

## Detalles técnicos

- Tablas `estudio_*` siempre vía `estudioDb`; sin sub-navegación (lo administrable sigue en el diálogo de lápiz de `DropdownWithManageDialog`); sin tocar `core_products` ni `esp_products`.
- El catálogo de referencias máximas se lee desde la Edge Function (`/api/v1/images/models`) con caché en memoria, igual que hace `estudio-list-models`.
- Verificación antes de cerrar: `npm run typecheck`, `npm run build` y ESLint sobre los archivos tocados.
- Al terminar informo la migración aplicada y las funciones desplegadas.
