## Diagnóstico: los números 44 / 55 / 65 / 34 son "correctos" pero vienen de un backfill histórico

Revisé la tabla `core_production_needs` y los movimientos que las originaron. La aritmética cuadra al detalle, pero **no representan demanda reciente** — son ventas históricas que se cargaron todas juntas al Fondo de Fabricación.

### De dónde salen los números

Para el SKU **JGM43** encontré 199 movimientos `sale_generated` posted en el Fondo de Fabricación, todos con el **mismo timestamp** `2026-06-04 10:02:11`, provenientes de **197 pedidos distintos** de WooCommerce (algunos con 2 unidades). Es la huella típica de una corrida masiva del proceso del Fondo que "puso al día" todo el histórico de una sola vez.

Por talla:

| Talla | Ventas históricas | Ya convertidas | Pendiente actual | Coincide con la pantalla |
|-------|-------------------|----------------|------------------|---------------------------|
| L     | 45                | 1              | **44**           | ✔ |
| S     | 55                | 0              | **55**           | ✔ |
| M     | 65                | 0              | **65**           | ✔ |
| XL    | 34                | 0              | **34**           | ✔ |

El edge function `core-generate-production-needs` agrupa por variante y suma cada movimiento posted que no haya sido ya "linkeado" a una necesidad anterior. Como esos 199 movimientos no estaban linkeados, los tomó todos → 34 + 44 + 55 + 65 = 198 unidades de demanda "para fabricar".

### Por qué se ve anormal

- No es un error de cálculo: cada unidad corresponde a una venta real ya cobrada en Woo.
- Es anormal en el sentido de que **mezcla meses de historia** con la reposición real que hoy necesita la fábrica. Ese SKU (Jogger I Wonder) probablemente no se va a re-fabricar en esas cantidades — muchas de esas ventas ya se surtieron con inventario existente en su momento.
- El pico se disparó porque el 4-jun-2026 se corrió el Fondo de Fabricación en modo "cargar histórico" y el 3-jul se corrió el generador de necesidades por primera vez sobre esos movimientos.

## Propuesta de arreglo

Necesito tu decisión sobre cómo tratar el histórico. Te propongo tres piezas; se pueden aplicar solas o combinadas.

### 1. Marcar el histórico como "ya atendido" (una sola vez)

Crear una necesidad sintética por variante con `status = 'ignored'` (o `converted_to_order` con nota "backfill histórico") y linkearle todos los movimientos previos al 4-jun-2026 10:02:12. A partir de ahí el generador ya no los volverá a tomar. La pantalla de Necesidades quedaría limpia y el próximo run sólo miraría ventas nuevas.

Auditoría: se registra en `core_audit_logs` con acción `backfill_ignore_historical` para que quede trazado.

### 2. Agregar filtro "desde fecha" al generador

En el edge function `core-generate-production-needs` ya existen los parámetros `period_start` / `period_end` pero la UI no los expone. Añadir en la pantalla de Necesidades un selector "Generar desde…" que llame al function con `period_start = <fecha>`. Así la próxima vez que se cargue un histórico grande, el usuario decide desde cuándo cuenta.

### 3. Guardar una marca "último punto procesado" por variante

Persistir en `core_settings` (o en una tabla nueva `core_production_needs_watermark`) la fecha del último movimiento procesado. El generador arrancaría siempre desde ahí y no volvería a mirar histórico previo, aun si aparecen movimientos "atrasados". Esto es lo más robusto a largo plazo pero implica cambios de esquema.

## Recomendación

Aplicar **#1 ahora mismo** (limpia el ruido actual de JGM43 y de cualquier otro SKU en la misma situación) + **#2** para que tengas control manual la próxima vez que corras un backfill. Dejar #3 para una siguiente iteración si sigue siendo un problema.

## Detalles técnicos

- Backfill (#1): `INSERT` una `core_production_needs` por variante afectada con `need_type='sale_generated'`, `status='ignored'`, `quantity_needed = SUM(qty histórica)`, `notes = 'Backfill histórico ignorado — no fabricar'`. Luego `INSERT` en `core_production_need_sources` un registro por cada movimiento previo a la fecha de corte. Marcar además como `ignored` las necesidades ya creadas hoy por el run `dba10927-…` (34/44/55/65).
- Filtro UI (#2): en `src/pages/core/CoreProductionNeeds.tsx`, junto al botón "Generar desde ventas", agregar un `DatePicker` opcional y enviarlo como `period_start` en el body del fetch al edge function. Sin fecha, comportamiento actual.
- Fecha de corte sugerida para #1: `2026-06-04 10:03:00+00` (justo después del backfill), o la que tú definas.

## Lo que necesito confirmar antes de implementar

1. ¿Fecha de corte para considerar "histórico" → `2026-06-04 10:03:00`? ¿O prefieres otra?
2. Las necesidades actuales de JGM43 (34/44/55/65) ¿las marco como `ignored` o quieres dejar alguna cantidad "real" para fabricar (p. ej. reposición manual)?
3. ¿Aplicamos #1 a **todos los SKU** cuyos movimientos posted tengan ese mismo timestamp del 4-jun, o sólo a JGM43?
