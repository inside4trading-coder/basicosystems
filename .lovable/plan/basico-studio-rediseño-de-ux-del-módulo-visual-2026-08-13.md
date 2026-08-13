# BASICO STUDIO — rediseño de UX del módulo visual

Solo UI/UX en el frontend. No se toca la Edge Function `estudio-generate-image`, ni modelos, costos, almacenamiento ni el historial existente: se sigue llamando exactamente la misma función con los mismos parámetros.

## 1. Nombre y encabezado

- Título: **BASICO STUDIO** (con el mismo lenguaje visual rojo/negro de la marca).
- Subtítulo: "Crea imágenes de producto listas para catálogo, campañas y redes."
- En el menú lateral el ítem pasa de "Estudio Visual" a "BASICO STUDIO". La ruta `/estudio-visual` no cambia.

## 2. Pantalla principal: 5 cards de acción

La pantalla arranca con las cards (1 columna en móvil, 2–3 en desktop). No hay botón superior de "Nueva generación" (hoy tampoco existe; el formulario largo actual deja de mostrarse de entrada).

| Card | Estado | Qué hace |
|---|---|---|
| Foto para catálogo | Disponible | Estilo `Fondo blanco — default` |
| Fondo transparente | Disponible | Mismo estilo base + instrucción de PNG con fondo transparente |
| Fondo dinámico | Disponible | Estilos tipo mockup/lifestyle; permite individual o carrusel x4 |
| Video corto | En construcción | Card gris, badge "En construcción", no clicable |
| Mockup con modelo | En construcción | Card gris, badge "En construcción", no clicable |

Nota: hoy no existe un estilo guardado de "fondo transparente". Se resuelve sin tocar base de datos: la card usa el estilo de fondo blanco y añade a esa generación puntual la instrucción de recorte y fondo transparente (el prompt por generación ya es editable y ya se envía como `promptOverride`).

## 3. Wizard de generación

Al pulsar una card disponible se abre un panel guiado (diálogo a pantalla completa en móvil):

1. **Tipo** — ya fijado por la card, se muestra como resumen arriba.
2. **Prenda** — foto frontal obligatoria; opcionales espalda, detalle, tres cuartos y foto de referencia de modelo (los mismos inputs de hoy).
3. **Formato** — Instagram 4:5, Story 9:16, Cuadrado 1:1, Web 16:9.
4. **Generar** — resumen: tipo, formato, individual o carrusel, cantidad de salidas y costo estimado si el modelo lo publica.

Bloque **Avanzado** plegado (accordion) con lo técnico actual: modelo de IA, prompt editable, plantilla de Instagram y ajustes de movimiento. Los diálogos de administración (lápiz) siguen igual.

## 4. Fondo dinámico: individual o carrusel x4

Selector visual de modo de salida dentro del wizard de esa card:

- **Imagen individual** → 1 generación (comportamiento actual).
- **Carrusel de 4 imágenes** → 4 llamadas a la misma función con 4 variaciones de escena (por ejemplo: estudio con textura, exterior urbano, fondo de color de marca, detalle macro), cada una anexada al prompt. Se muestran los 4 estilos como preview antes de generar y el botón final dice "Generar carrusel".
- El resultado queda etiquetado **"Carrusel · 4 imágenes"** y se muestra como carrusel horizontal.

## 5. Resultados recientes

"Videos recientes" y "Generaciones recientes" se unifican en **Resultados recientes**, en galería de cards. Cada card muestra: preview, estado (listo / procesando / fallido), tipo (Foto catálogo · Fondo transparente · Fondo dinámico), Individual o Carrusel · 4 imágenes, fecha, costo y acciones: Descargar, Descargar todo (solo carrusel), Duplicar, Usar como referencia, Ver prompt.

Los fallidos se muestran en card compacta con el motivo, botón Reintentar y botón Ver error, sin hueco de imagen vacío.

El agrupado en sets se hace en el cliente por `session_id`/fecha de los trabajos ya guardados; no se agregan columnas.

## 6. Descargas ordenadas

Nomenclatura `BASICO-STUDIO-0001-01.png`:

- `0001` = número correlativo de generación, llevado en el navegador (`localStorage`) y asignado al crear cada set; los sets previos al cambio se numeran por su posición en el historial.
- `01..04` = orden dentro del set.

Botón **"Descargar todo"** en carruseles: descarga las 4 en secuencia y en orden (no se agrega dependencia de zip). Texto de apoyo: "Las imágenes se descargan en orden para carrusel."

## 7. Herramientas laterales

- **Preset de marca BASICO** — sección secundaria que reutiliza la plantilla de marca existente (logo, colores, posición) con la descripción pedida.
- **Duplicar generación** — recarga en el wizard el tipo, formato y prompt de un resultado anterior para crear variantes rápido.

## 8. Filtros y buscador

Chips: Todos, Listos, Procesando, Fallidos, Carrusel, Individual, Foto catálogo, Fondo transparente, Fondo dinámico. Buscador: "Buscar resultados, prendas o códigos…" (filtra por código BASICO-STUDIO, tipo y fecha, en cliente).

## 9. Móvil

Cards a 1 columna, botones grandes, wizard paso a paso a pantalla completa, resultados en galería vertical, sin tablas anchas, "Descargar todo" siempre visible en carrusel.

## Detalles técnicos

- Archivos previstos: `src/pages/EstudioVisual.tsx` (se adelgaza a orquestador), nuevos componentes en `src/components/estudio/`: `StudioActionCards.tsx`, `StudioWizard.tsx`, `StudioResults.tsx`, `StudioResultCard.tsx`, `StudioFilters.tsx`; helpers en `src/lib/estudioNaming.ts` (correlativo + nombres de archivo).
- Se reutilizan tal cual `estudioStorage`, `estudioCompositing`, `estudioModels`, `MotionPanel`, `DropdownWithManageDialog`, `ImageLightbox` y los tabs de configuración.
- Sin migraciones, sin cambios en Edge Functions, sin nuevos modelos ni cambios de costo.
- Verificación final: `tsgo` (typecheck) en 0 errores y revisión visual en móvil y desktop.
