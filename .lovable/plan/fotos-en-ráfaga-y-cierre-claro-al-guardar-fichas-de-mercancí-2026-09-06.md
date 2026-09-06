# Fotos en ráfaga y cierre claro al guardar (fichas de mercancía)

Aplica a la ficha de producto de Sublime Mercancía y de Mercancía en Tránsito (Basico Core), que comparten los mismos componentes.

## 1. Tomar varias fotos seguidas

Hoy el botón "Cámara" abre la cámara del teléfono y solo permite una foto por vez: hay que repetir el proceso completo por cada toma.

Se añade una **cámara integrada**: al pulsar "Cámara" se abre una vista con la imagen en vivo dentro de la misma pantalla, con:

- Botón de disparo grande; cada toque agrega una foto sin salir de la cámara.
- Contador "3 fotos tomadas" y tira de miniaturas abajo, con opción de quitar una recién tomada.
- Botón para cambiar entre cámara trasera y frontal.
- Botón "Listo" que cierra la cámara y deja todas las fotos en la ficha.
- Si el teléfono o el navegador no permite la cámara en vivo (permiso denegado), se usa automáticamente el comportamiento actual (cámara del sistema, una foto por vez) para no bloquear al usuario.

El botón "Subir" sigue igual: ya permite seleccionar varios archivos a la vez.

Esto aplica tanto a "Fotos referencia / origen" como a "Fotos web / banco de imágenes", en productos nuevos y ya guardados.

## 2. Guardado con confirmación y cierre

Al crear un producto con fotos, la subida ocurre después de guardar y puede tardar; durante ese rato no hay señal visible, por eso parece que "no pasó nada".

- El botón muestra estado de progreso: "Guardando…" y luego "Subiendo fotos 2 de 5", y queda deshabilitado.
- Mientras tanto la ficha no se puede cerrar por accidente.
- Al terminar: aviso verde "Producto guardado" (o "Producto creado con N fotos") y la ficha se cierra sola.
- Si algo falla, la ficha permanece abierta con el mensaje de error, para no perder lo escrito.
- Mismo comportamiento al editar un producto existente.

## Detalle técnico

- Nuevo componente `src/components/sublime/mercancia/CameraCaptureDialog.tsx`: `getUserMedia` con `facingMode`, `<video>` + `canvas.toBlob` a JPEG, acumula `File[]` y los devuelve al cerrar; libera el stream al desmontar; fallback al `input capture` actual si `getUserMedia` falla.
- `PhotoGallery.tsx` y `PendingPhotoPicker` (en `ItemEditorSheet.tsx`) usan ese diálogo en el botón "Cámara" y enrutan el resultado a los mismos manejadores (`handleFiles` / `onAdd`).
- `ItemEditorSheet.submit`: estado `progress {done,total}` para el texto del botón, `onOpenChange` bloqueado mientras `saving`, cierre solo en éxito.

Sin cambios de base de datos ni de reglas de negocio.
