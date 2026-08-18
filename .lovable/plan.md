# Detalles clave de la prenda en Basico Studio

Añadir un bloque opcional de notas por prenda en el asistente de generación, que se inyecta en el prompt final y queda guardado con la generación.

## Cómo se ve

Nuevo bloque dentro del asistente (antes del paso Generar, siempre visible sea cual sea el tipo):

- Título: **Detalles clave de la prenda (opcional)**
- Textarea: "Notas adicionales para esta prenda", con placeholder de ejemplo (estampado no bordado, costuras blancas, tela ripstop, texto exacto, altura del estampado, artwork centrado).
- Chips clicables que insertan texto en el textarea (se agregan como línea nueva, sin duplicar si ya está): Estampado, no bordado · Bordado, no estampado · Costuras blancas · Costuras en contraste · Mantener altura del estampado · Mantener texto exacto · Tela gruesa · Tela ligera · Preservar gramaje · Preservar simetría visual · Preservar caída natural · No eliminar imperfecciones reales.
- Ayuda debajo: "Estas notas ayudan a que la IA respete mejor corte, tela, costuras, textos, artwork y detalles importantes de la prenda."
- Estética actual del wizard (tarjeta con borde redondeado, chips tipo outline, sin recargar la pantalla).

## Comportamiento

- Vacío: todo funciona igual que hoy.
- Con texto: se concatena al prompt del tipo elegido como

  ```text
  <prompt base del tipo/fondo>

  Additional garment notes:
  <texto del usuario>
  ```

- Aplica a Foto para catálogo, Fondo transparente y Fondo dinámico (los tipos que hoy generan). Video corto y Mockup con modelo siguen en construcción: el bloque ya queda disponible y su valor se usará en cuanto se activen.
- En modo Composición (PNG recortado) no hay llamada al modelo: las notas no alteran la imagen, pero igual se guardan como contexto de la generación.
- El texto no se pierde al cambiar de paso ni al cambiar de tipo dentro del asistente; se limpia al cerrar el asistente.
- Al duplicar o reintentar una generación, se recuperan las notas de esa generación.

## Persistencia y auditoría

- Nueva columna `garment_notes` en la tabla de generaciones, escrita en cada job.
- El prompt guardado (`prompt_used`) sigue conteniendo el texto completo enviado al modelo, ya con la sección "Additional garment notes:", así que "Ver prompt" del resultado muestra el contexto usado. Además se muestra un bloque "Detalles de la prenda" en el detalle del resultado cuando existan notas.

## Detalles técnicos

- Migración: `ALTER TABLE public.estudio_image_jobs ADD COLUMN garment_notes text` (nullable; sin cambios de RLS ni grants).
- `src/components/estudio/GarmentNotesBlock.tsx` (nuevo): textarea + chips, controlado por props `value` / `onChange`.
- `src/components/estudio/StudioWizard.tsx`: props `garmentNotes` y `onGarmentNotesChange`; renderiza el bloque dentro del paso Formato/antes de Generar. Sin cambios en las reglas de bloqueo del botón Generar.
- `src/pages/EstudioVisual.tsx`: estado `garmentNotes`; helper que arma `prompt + "\n\nAdditional garment notes:\n" + notas` (solo si hay notas) y lo manda como `promptOverride`; se guarda `garment_notes` tanto en el insert de composición como en el flujo de Edge Function.
- `supabase/functions/estudio-generate-image/index.ts`: acepta `garmentNotes` y lo persiste en la columna nueva al crear el job (el prompt ya llega ensamblado desde el cliente, así que la lógica de prompt no cambia).
- `src/components/estudio/StudioResults.tsx`: mostrar las notas en el detalle/ver prompt y pasarlas al duplicar/reintentar.
- Verificación: typecheck y prueba visual del bloque en el asistente (generación real no se dispara para no gastar créditos).

## No se toca

Modelos habilitados, storage, fondos dinámicos, prompts base existentes, historial ni el resto de módulos.
