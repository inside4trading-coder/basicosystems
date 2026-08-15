# Diagnóstico técnico — Basico Studio Visual (pérdida de fidelidad de la prenda)

## Hallazgos

1. **No existe pipeline de composición.** Hoy hay un único paso: subir foto → llamar a un modelo generativo texto+referencia → guardar lo que devuelva el modelo. No hay etapas de aislamiento, máscara, fondo, sombra ni integración.
2. **La prenda viaja como "referencia", no como asset bloqueado.** En `supabase/functions/estudio-generate-image/index.ts` la foto original se descarga del bucket, se convierte a base64 y se manda dentro de `input_references` junto al prompt a `https://openrouter.ai/api/v1/images`. Ese endpoint es de *generación*: devuelve una imagen nueva (`data[0].b64_json`) creada desde cero por el modelo. Nada obliga al modelo a copiar píxeles.
3. **No hay segmentación ni recorte real.** Ninguna búsqueda en el proyecto encuentra segmentación, matting, alpha o recorte. El "Fondo transparente" es solo un texto agregado al prompt (`TRANSPARENT_SUFFIX` en `src/pages/EstudioVisual.tsx`): se le *pide* al modelo que recorte, no se recorta.
4. **No existe máscara del producto.** No se genera, no se guarda y no se envía ninguna máscara. La tabla `estudio_image_jobs` no tiene columna de máscara ni de recorte.
5. **No hay composición real.** El único código de composición del proyecto, `src/lib/estudioCompositing.ts` (canvas: cover + logo), **no está importado en ninguna parte** — es código muerto y, aun así, solo recorta al formato de Instagram y estampa el logo; no compone prenda sobre fondo.
6. **Fondo dinámico también es prompt.** El fondo elegido se manda como una referencia adicional (`backgroundReferencePath`) al mismo endpoint de generación: el modelo *reinterpreta* prenda y fondo juntos en una imagen nueva.
7. **La proporción fuerza reencuadre generativo.** Se envía `aspect_ratio` (4:5, 1:1, 9:16) al modelo, así que además de repintar la prenda, el modelo la reescala y reencuadra a su criterio.
8. **Las vistas "inferidas" son alucinación por diseño.** Cuando el usuario marca espalda/detalle/tres cuartos sin subir foto, se manda la foto frontal con `isInferred: true` y se le pide al modelo que invente la vista. Eso es incompatible con Product Lock salvo que se prohíba explícitamente.

## Causa raíz

El pipeline es **generativo de extremo a extremo**: la única salida posible del endpoint usado es una imagen sintetizada. La prenda original nunca aparece en el resultado final — ni un solo píxel. Toda la fidelidad depende de que el modelo "adivine" bien la tipografía, los números, el retrato y las proporciones. No es un problema de prompt: es que el pipeline no tiene ninguna etapa donde los píxeles originales se preserven.

## Archivos implicados

- `supabase/functions/estudio-generate-image/index.ts` — corazón del problema: llamada a `/v1/images` con `input_references`, `aspect_ratio` y prompt.
- `src/pages/EstudioVisual.tsx` — orquesta la subida, arma los prompts (`TRANSPARENT_SUFFIX`, `CAROUSEL_SCENES`), decide vistas inferidas y llama a la función.
- `src/components/estudio/StudioWizard.tsx` — pasos, selección de fondo, formato y modelo.
- `src/lib/estudioStorage.ts` — sube la original a `originales/`, resuelve signed URLs (la original sí se conserva en el bucket, pero solo como insumo del modelo).
- `src/lib/estudioBackgrounds.ts` + tablas `estudio_backgrounds` / `estudio_background_prompts` — fondos como referencia textual/visual, no como capa de composición.
- `src/lib/estudioCompositing.ts` — composición canvas existente pero **sin uso**.
- `src/components/estudio/config/*` (Prompt, Backgrounds, Models) — configuración del modo generativo actual.

## Flujo actual (resumido)

```text
foto prenda -> bucket originales/
      -> edge function estudio-generate-image
      -> base64 + prompt + (foto modelo) + (imagen de fondo) + aspect_ratio
      -> OpenRouter /v1/images  [GENERACIÓN COMPLETA]
      -> imagen nueva b64 -> bucket <jobId>/generado.png
      -> UI muestra resultado
```
La prenda se recrea en el paso del modelo. Ahí se pierden tipografías, números, retratos y proporciones.

## Flujo correcto propuesto (PRODUCT LOCK)

```text
foto prenda (master, inmutable)
  -> segmentación / matting  -> máscara alfa persistida (cutout PNG)
  -> product lock: cutout = capa superior intocable
  -> fondo: preset del catálogo (imagen real) o fondo generado SIN la prenda
  -> composición: colocar cutout sobre fondo (escala/posición determinística por formato)
  -> sombra de contacto: derivada de la máscara (no del modelo)
  -> integración de luz: ajustes de color/curvas sobre el cutout, con límite duro
  -> exportación 4:5 / 1:1 / 9:16 desde el mismo cutout
```
Regla estructural: **el modelo generativo nunca recibe la prenda como entrada de una imagen que va a devolver**. Solo puede producir fondos vacíos.

## Plan de refactor por etapas

**Etapa 1 — Segmentación y máscara (base de todo).**
Nueva edge function `estudio-segment-garment`: recibe la original, produce cutout PNG con alfa + máscara, los guarda en el bucket (`cutouts/<id>.png`, `masks/<id>.png`) y registra la fila en una tabla nueva `estudio_garment_assets` (original_path, cutout_path, mask_path, bbox, estado). Elección de proveedor de matting a definir (ver pregunta abierta). "Fondo transparente" pasa a ser esta etapa: deja de ser un prompt.

**Etapa 2 — Composición determinística en servidor.**
Nueva edge function `estudio-compose`: fondo + cutout + máscara → imagen final. Escalado/encuadre por formato, sombra de contacto derivada de la máscara (desenfoque + offset + opacidad), match de luz acotado. Sin llamadas a modelos generativos.

**Etapa 3 — Fondos sin prenda.**
`estudio_backgrounds` se vuelve la fuente principal (imágenes reales). Para "fondo dinámico" nuevo, la generación produce **solo el escenario vacío**, se guarda como fondo reutilizable y luego entra a la Etapa 2.

**Etapa 4 — Reescritura del wizard.**
`StudioWizard` pasa a: subir prenda → ver cutout aprobado (con control de re-recorte) → elegir fondo → ajustar composición → exportar formatos. Se elimina el prompt libre sobre la prenda y las vistas inferidas (espalda/detalle solo con foto real subida).

**Etapa 5 — Retiro del camino generativo.**
`estudio-generate-image` queda restringido a generar fondos, o se marca legacy. Los presets de prompt de prenda se archivan.

## Riesgos técnicos

- **Calidad del matting**: prendas sobre fondo claro, tejidos con transparencias, pelo/flecos y sombras propias en la foto original producen bordes sucios. Necesita un paso de aprobación/refinado manual del cutout.
- **Realismo**: la composición determinística se ve "pegada" si la luz del fondo no coincide con la de la foto. Mitigación: fondos del catálogo con dirección de luz declarada y match de color acotado; nunca repintar la prenda.
- **Foto con modelo humano**: Product Lock estricto es incompatible con "vestir a una persona" — eso siempre implica generación. Hay que decidir si ese caso queda fuera o se marca explícitamente como modo no-lock.
- **Coste/latencia**: dos servicios (matting + composición) en vez de uno; la composición en servidor requiere una librería de imagen en Deno (resvg/sharp-wasm/canvas) con límites de memoria de edge functions. Alternativa: composición en cliente con Canvas (ya hay base en `estudioCompositing.ts`) y subida del resultado.
- **Migración de datos**: los jobs existentes no tienen cutout ni máscara; la UI de resultados debe convivir con ambos formatos.
- **Vistas espalda/detalle**: al eliminar la inferencia, el usuario debe subir cada vista; cambia el flujo operativo actual.

## Pregunta abierta antes de implementar

Elección del motor de segmentación (API externa de matting vs. modelo local en cliente vs. modelo vía OpenRouter con salida de máscara) y dónde corre la composición (edge function vs. navegador). Lo resolvemos antes de la Etapa 1.
