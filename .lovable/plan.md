# Informe de auditoría — "Generar desde partidas" (192 necesidades)

Solo lectura. No se ha borrado, revertido ni modificado nada.

## 1. Causa raíz

El proceso sí tiene control anti-duplicados, pero **ese control dejó de funcionar cuando la lista de partidas superó ~350 registros**.

Antes de crear necesidades, el proceso pregunta a la base de datos: "de estas 438 partidas, ¿cuáles ya fueron convertidas antes en una necesidad?". Esa pregunta se envía metiendo los 438 identificadores dentro de la dirección de la consulta, y a partir de cierto tamaño la petición se rechaza. El código **no comprueba si esa consulta falló**: al no recibir respuesta, asume "ninguna partida fue procesada antes" y vuelve a tratar **todo el histórico como demanda nueva**.

Evidencia en las ejecuciones registradas:

| Fecha | Partidas revisadas | "Ya procesadas" detectadas | Necesidades creadas |
|---|---|---|---|
| 12 ago | 123 | 82 | 18 |
| 24 ago | 265 | 166 | 31 |
| 27 ago | 339 | 200 | 54 |
| 28 ago | 348 | 266 | 5 |
| 3 sep | 407 | **0** | 187 |
| 6 sep | 438 | **0** | 191 |

El corte está exactamente entre 348 y 407 partidas: coincide con el límite de tamaño de la petición, no con un cambio de datos.

Confirmación adicional: el mismo fallo afecta a la detección de anulaciones (reversals detectados = 0) y, al intentar volver a enlazar partidas ya enlazadas, la base de datos rechazó los duplicados: de 192 necesidades solo se enlazaron 24 partidas nuevas. Los 350 vínculos históricos siguen intactos y **no hay ningún vínculo huérfano**, lo que descarta que las partidas se hubieran regenerado.

Otras hipótesis descartadas: no usa cantidad original en lugar de saldo (agrupa por partidas no enlazadas), no ignora necesidades convertidas a propósito, no faltan claves de origen, y las partidas no fueron recreadas.

## 2. Qué ejecuta el botón

- Pantalla: `src/pages/core/CoreProductionNeeds.tsx` → `runGeneration(false)`
- Llama a la función de servidor `core-generate-production-needs`
- **Lee**: partidas de fabricación (movimientos de venta contabilizados), vínculos partida↔necesidad, control de reposición, productos y variantes Core
- **Escribe**: registro de ejecución, necesidades de producción, vínculos partida↔necesidad, registro de auditoría, y llama al motor de enrutado de reposición (que en esta ejecución escribió 3 eventos de política a las 22:03)
- Regla actual de "unidad que se convierte en necesidad": toda partida de venta contabilizada que **no aparezca** en la lista de ya enlazadas y no esté bloqueada por control de reposición. Al fallar esa lista, la regla degeneró en "toda partida histórica".

## 3. Qué son las "192 abiertas"

Ejecución aislada por: `generation_run_id = 182c7ea6-490f-491e-9dc0-e5616f7d8785`, del 2026-09-06 22:03:27 a 22:05:30 UTC.

- **192** filas tocadas por la ejecución
- **191 insertadas** nuevas
- **1 preexistente actualizada**: `ec8e4675-bece-4e03-9158-3fcf9332b6d7` (Cargo Pant Basico Club, talla S, creada el 3 sep, ya aprobada y con 1 unidad convertida) — su cantidad subió de forma inflada
- Ninguna de las 192 procede de necesidades "reabiertas": todas son de este run

Clasificación:

| Grupo | Nº necesidades | Unidades | Criterio |
|---|---|---|---|
| A. Legítimas | 22 (con partida nueva enlazada) | **26 unidades reales** | Tienen vínculo a partidas que nunca antes se habían convertido |
| B. Duplicadas claras | **170** | 282 | Sin ningún vínculo a partida: corresponden a partidas ya enlazadas a necesidades anteriores |
| C. Dudosas | Las mismas 22 del grupo A, en su **exceso de cantidad: 38 unidades** | 38 | Su cantidad agrega también partidas antiguas ya procesadas |

187 de las 192 apuntan a variantes que ya tenían necesidad histórica (muchas ya `converted_to_order` en agosto). Ejemplos verificados: "Sakura Drift Club" talla M (convertida a OP el 5 ago), TRACKPANT WORLDWIDE talla L (convertida 5 ago y 27 ago), Stillz Tribute XL (convertida 9 ago).

Nota: la ejecución del **3 de septiembre** sufrió exactamente el mismo fallo (187 creadas); esas ya fueron marcadas como `ignored` (214 en total), lo que confirma que es la segunda vez que ocurre.

## 4. ¿Se alteraron las partidas originales?

**NO.**

Evidencia:
- 0 movimientos de partidas creados o tocados entre 22:00 y 22:10
- Los 350 vínculos partida↔necesidad son únicos por partida; la ejecución solo pudo añadir 24 nuevos, los demás fueron rechazados
- Auditoría del rango: únicamente 191 `auto_create_from_movements` + 1 `auto_update_from_movements`, todos sobre necesidades
- No hubo escrituras en órdenes de producción, inventario, reservas ni saldos de fondo

Tablas afectadas: necesidades de producción (192 filas), vínculos partida↔necesidad (24 filas nuevas legítimas), registro de ejecución (1 fila), auditoría (192 filas), eventos de política de reposición (3 filas).

## 5. Reversión propuesta (NO ejecutar aún)

Todo acotado al identificador de ejecución, nunca por fecha ni por tipo:

1. **Grupo B (170)**: marcar como `ignored` con nota "Anulada: ejecución 182c7ea6 duplicó demanda histórica" — no borrado físico, para conservar trazabilidad. Solo filas del run `182c7ea6…` **sin** vínculo en la tabla de orígenes.
2. **Grupo A/C (22)**: no anular. Ajustar `quantity_needed` y `quantity_pending` a la suma real de sus partidas enlazadas (26 unidades en total, −38 de exceso).
3. **La fila actualizada** `ec8e4675…`: restar exactamente el delta que le sumó esta ejecución, dejando su estado `approved` y su unidad ya convertida intactos.
4. **No tocar** partidas, vínculos, órdenes, inventario ni fondos.
5. Registrar cada cambio en auditoría con el identificador del run.

## 6. Corrección permanente propuesta (NO ejecutar aún)

1. **Fallar en vez de asumir**: si la consulta de "partidas ya procesadas" devuelve error, abortar la ejecución con mensaje claro. Nunca continuar con lista vacía.
2. **Consultar por lotes** de 200 identificadores (o filtrar por rango de fechas en servidor) para no volver a superar el límite de tamaño. Igual para la detección de anulaciones.
3. **Idempotencia garantizada en base de datos**: clave única sobre partida en la tabla de orígenes (ya existe de hecho) y, además, **crear la necesidad y su vínculo en la misma operación atómica**: si el vínculo no se puede insertar porque la partida ya fue procesada, la necesidad no se crea. Esto hace imposible el escenario actual aunque la lectura previa falle.
4. **Saldo pendiente real** como fuente de verdad: cantidad = suma de partidas sin vínculo, nunca cantidad histórica agregada.
5. **Simulación obligatoria**: mostrar el resultado del modo simulación antes de permitir la generación real, con aviso si "ya procesadas = 0" mientras existan vínculos históricos.

Resultado esperado: pulsarlo dos veces seguidas → 0 necesidades nuevas la segunda vez.

## Detalle técnico

- Función: `supabase/functions/core-generate-production-needs/index.ts`, bloques 2 y 3 (`reversedSet`, `linkedSet`): ambos usan `.in(...)` con hasta 5000 identificadores y descartan el error (`const { data } = await ...`).
- Aislamiento del incidente: `core_production_needs.generation_run_id = '182c7ea6-490f-491e-9dc0-e5616f7d8785'`; run en `core_production_need_runs` (`needs_created=191`, `needs_updated=1`, `skipped_existing=0`, `movements_linked=24`, `movements_checked=438`).
- Grupo B = ese run sin fila en `core_production_need_sources`; Grupo A = con fila.

## Estado

Informe entregado. No se ejecutará ninguna reversión ni corrección hasta tu autorización explícita.
