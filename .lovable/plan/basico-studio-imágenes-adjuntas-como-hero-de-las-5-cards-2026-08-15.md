# BASICO STUDIO — imágenes adjuntas como hero de las 5 cards

Solo se toca la presentación de las 5 cards de `/estudio-visual`. Nada de backend, Edge Functions, modelos, costos, storage, historial ni lógica de generación. No se genera ninguna imagen nueva.

## Las imágenes

Las 5 imágenes adjuntas son banners completos: ya traen a la izquierda el logo BASICO en rojo, el título grande y los chips, y a la derecha la prenda o el modelo.

Como la card ya lleva su propio título, descripción y chips, uso **solo la parte derecha de cada imagen (la prenda / el modelo)** como hero, con `object-fit: cover` y encuadre desplazado a la derecha. Así no se duplica el texto ni entra el rojo de los banners, y las cards quedan en azul B Systems como pediste.

Mapeo:

| Card | Imagen |
|---|---|
| Foto para catálogo | fondo blanco |
| Fondo transparente | sin fondo |
| Fondo dinámico | fondo dinámico |
| Video corto | video corto |
| Mockup con modelo | fotomodelo |

Las 5 se suben al CDN del proyecto como assets y se referencian desde la card; no quedan binarios pesados en el código.

## Layout de cada card

- Hero arriba, ~57% de la altura de la card, esquinas internas de 16px, imagen recortada sin deformar.
- Debajo: icono circular (cámara / tijeras / destello / claqueta / persona), micro-label "BASICO STUDIO", título, descripción, chips en mayúsculas y CTA "Empezar →".
- Altura idéntica entre cards de la misma fila.
- Escritorio: 3 columnas arriba y 2 abajo. Móvil: 1 columna.
- Card tipo ventana: fondo blanco frío sobre superficie Mist, borde suave 20px, sombra muy sutil.

## Estados

- **Disponibles** (catálogo, transparente, dinámico): cursor pointer, hover con borde y sombra en Electric Blue, foco visible por teclado. El click sigue abriendo el wizard actual, sin cambios en esa lógica.
- **En construcción** (video corto, mockup con modelo): hero desaturado, badge "EN CONSTRUCCIÓN", chip "PRÓXIMAMENTE", sin CTA, `cursor: not-allowed`, sin hover. Se ven apagadas pero premium, no rotas.

## Detalles técnicos

- Se edita `src/components/estudio/StudioActionCards.tsx` (estructura de datos de las cards + maquetación). Si hace falta ajustar el fondo Mist del contenedor, se toca únicamente el envoltorio en `src/pages/EstudioVisual.tsx`.
- Electric Blue `#0B37FF` e Ink `#0A0D12` se añaden como tokens semánticos en `src/index.css` y `tailwind.config.ts` (por ejemplo `studio-accent` / `studio-ink`), sin alterar el rojo de marca del resto del hub ni el tema global.
- Verificación antes de cerrar: typecheck en 0 errores y revisión visual de la pantalla en escritorio y móvil.
