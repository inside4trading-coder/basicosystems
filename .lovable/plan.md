# Materia Prima 2.0 — Documento de arquitectura (solo diseño)

## 1. Resumen ejecutivo

Qué construimos: convertir el módulo Materia Prima de CORE (hoy catálogo puro) en un control de inventario real de materiales, con stock teórico, movimientos, descuento automático al completar el proceso **Corte**, cierre físico diario, alertas por diferencia y disponibilidad proyectada para OP.

Problema que resuelve: hoy no existe stock de materia prima en la base (verificado: `core_raw_materials` solo tiene `code, name, category_id, unit_of_measure_id, unit_cost, currency, supplier, status, notes`, sin ninguna columna de existencias). El consumo real de tela no se registra en ningún lado y la merma solo se descubre contando a mano.

Qué NO construimos todavía: requisiciones automáticas de compra, proyección productiva ("con 20 kg haces 50 franelas"), lotes/rollos individuales trazables, y bloqueo duro de producción por falta de material.

## 2. Módulo propuesto

Reorganizar `/core/materia-prima` como submódulo con pestañas, sin borrar nada de lo actual:

```text
Materia Prima
├── Dashboard            (nuevo)
├── Inventario disponible(nuevo: stock teórico / comprometido / disponible)
├── Catálogo             (la pantalla actual, renombrada)
├── Carga masiva         (la actual de templates de carga)
├── Movimientos          (nuevo: kardex)
├── Cierre diario        (nuevo)
├── Alertas              (nuevo)
└── Requisiciones        (futuro, oculto en fase 1-4)
```

La pantalla actual pasa a llamarse "Catálogo de materia prima"; la ruta actual sigue funcionando y redirige a la pestaña Catálogo.

## 3. Fuente de verdad del consumo

No se crea receta paralela. La estructura de costos ya es la receta:

- `core_cost_structures` es la estructura por producto o por variante (tiene `variant_id`, `sku`, `woo_product_id`, `woo_variation_id`, `status`).
- `core_cost_structure_items` ya trae `raw_material_id`, `section`, `unit_of_measure`, `quantity`, `unit_cost`, `subtotal`.
- Datos reales hoy: `raw_material` 429 líneas (todas con `raw_material_id`), `packaging` 325 (todas con `raw_material_id`), `labor` 589 y `variable_cost`/`other` 6 sin material vinculado.

Regla para distinguir consumo financiero vs consumo físico: una línea descuenta stock solo si cumple **todas**:
1. `raw_material_id` no nulo,
2. `deducts_stock = true` (columna nueva, default true para `section in ('raw_material','packaging')`),
3. `physical_quantity_per_unit` > 0 (columna nueva; si es nula se usa `quantity`),
4. `physical_uom_id` resuelto (columna nueva; si es nula se usa la UoM del material).

Se añade también `consumption_process` (default `Corte`) en la línea, para que mercería/empaque puedan descontarse en Costura o al ingresar a inventario en vez de en Corte.

Estructura activa por unidad: se resuelve variante primero (`core_cost_structures.variant_id`), luego producto padre, igual que hace hoy `resolve_core_variant_unit_cost_with_source`. Reutilizamos esa misma cascada para no inventar otra.

## 4. Flujo de descuento por Corte

1. Operario escanea QR de la unidad en el proceso Corte (portal de operario o escaneo admin).
2. La RPC de completar proceso marca `core_production_unit_processes.status='completed'` (hoy existen 109 Corte completados) y crea el `core_production_scan_event`.
3. Al final de esa misma transacción se llama `core_consume_raw_materials_for_unit(unit_id, process_name)`.
4. La RPC resuelve producto/variante efectiva de la unidad, busca la estructura de costos activa y filtra las líneas descontables cuyo `consumption_process` = el proceso completado.
5. Convierte cantidad (factor de conversión gr↔kg, m↔yd) y genera un `core_raw_material_movements` de tipo `production_consumption` por línea, con `unit_cost` snapshot.
6. Un trigger sobre movimientos actualiza `core_raw_material_stock.qty_on_hand`.
7. Auditoría en `core_audit_logs`.

Idempotencia: índice único parcial sobre `(production_unit_id, process_name, raw_material_id)` en movimientos de tipo `production_consumption`. Un segundo escaneo no descuenta.

Sin receta: no se bloquea. Se completa el Corte igual y se crea alerta `missing_recipe` con material/producto involucrado.

## 5. Cierre físico diario

Pantalla del trabajador (`/core/materia-prima/cierre` o dentro del portal de operario):
- Lista solo materiales con `requires_daily_count = true` o consumidos ese día o con alerta abierta.
- Por material: nombre, unidad, un input de cantidad física, foto opcional, nota opcional.
- No muestra esperado, ni consumo, ni diferencia. Tras enviar solo dice "Conteo enviado para revisión".

Pantalla admin/partner:
- Mismo día en columnas: apertura, entradas, consumo teórico, esperado, reportado, diferencia, % diferencia, tolerancia, estado.
- Puede aceptar, ajustar (genera movimiento `adjustment`) o abrir alerta.

## 6. Alertas y tolerancias

Esperado = stock inicial del día + entradas − consumo teórico del día. Diferencia = reportado − esperado.

Tolerancia por material (`tolerance_pct`, `tolerance_abs`, fallback global en `core_settings`). Dentro de tolerancia → conteo `ok` automático. Fuera → alerta `stock_variance` con: material, esperado, reportado, diferencia, tolerancia, fecha, operario, foto/nota, estado (`open`, `in_review`, `adjusted`, `accepted`, `closed`).

Otros tipos de alerta: `missing_recipe`, `uom_mismatch`, `below_min_stock`, `insufficient_for_op`.

Solo admin/partner autorizado resuelve; el ajuste crea siempre un movimiento auditable, nunca edita el stock a mano.

## 7. Disponibilidad para OP

- `qty_committed` = suma de consumo teórico de las unidades de OP abiertas/en producción cuyo Corte aún no está completado.
- `qty_available = qty_on_hand − qty_committed`.
- Al crear una OP se muestra un panel "Materia prima requerida": requerido / disponible / faltante por material. Si falta, aviso ámbar "Materia prima insuficiente para ejecutar esta OP" y la OP **se crea igual**.
- En el dashboard, tabla global de materiales en riesgo.

## 8. Producción ligera / notas manuales

España ya tiene su propio circuito (`esp_material_movements`, `esp_consume_production_note`) y no se toca. Dentro de CORE, las notas manuales/producción ligera usarán la misma RPC de movimientos (`core_register_raw_material_movement`) con `source_type='production_note'`, sin lógica paralela. Si más adelante se quiere unificar CORE y España, sería un bloque aparte.

## 9. Modelo de datos propuesto

Reutilizar sin cambios: `core_units_of_measure`, `core_raw_material_categories`, `core_locations`, `core_production_units`, `core_production_unit_processes`, `core_production_scan_events`, `core_production_orders/lines`, `core_audit_logs`, `core_settings`.

Columnas nuevas en `core_raw_materials`: `min_stock`, `tolerance_pct`, `tolerance_abs`, `requires_daily_count`, `default_location_id`, `is_stock_tracked`.

Columnas nuevas en `core_cost_structure_items`: `deducts_stock`, `physical_quantity_per_unit`, `physical_uom_id`, `consumption_process`.

Tablas nuevas:
- `core_raw_material_stock` (material_id, location_id, qty_on_hand, qty_committed, updated_at) — único por material+ubicación.
- `core_raw_material_movements` (kardex: material_id, location_id, movement_type in `purchase|production_consumption|adjustment|transfer_in|transfer_out|return`, quantity con signo, uom_id, unit_cost snapshot, production_unit_id, process_name, production_order_id, source_type, source_id, created_by, notes).
- `core_raw_material_daily_counts` (fecha, material_id, location_id, expected_qty, reported_qty, diff, status, operator_id, photo_url, note).
- `core_raw_material_alerts` (tipo, material_id, severidad, payload jsonb, estado, resuelto_por, resolución).
- Opcional fase 5: `core_raw_material_requisitions` + líneas.

RPCs / Edge Functions:
- `core_register_raw_material_movement(...)` — entrada única de todo movimiento (valida UoM, actualiza stock).
- `core_consume_raw_materials_for_unit(unit_id, process_name)` — descuento idempotente por Corte.
- `core_recompute_raw_material_committed()` — recalcula comprometido por OP abiertas.
- `core_submit_raw_material_count(...)` — conteo del operario (no devuelve esperado ni diferencia).
- `core_resolve_raw_material_alert(alert_id, action, qty_ajuste)` — acepta o ajusta.
- `core_raw_material_daily_summary(date)` — resumen diario.
- Edge Function solo si el portal de operario necesita entrada sin sesión Supabase: se extiende `core-operator-portal` con acción `submit_material_count`, autorizada por sesión de operario, nunca devolviendo esperado.

Solo frontend: pestañas, dashboard, filtros, gráficos, exportes CSV, panel de disponibilidad al crear OP.

Storage: bucket privado para fotos de conteo.

## 10. Riesgos

- Doble descuento por doble escaneo → índice único de idempotencia + RPC única de escritura.
- Unidad sin estructura de costos activa → alerta `missing_recipe`, no bloqueo.
- Cambio de variante después del corte (ya existe `inventory_variant_override`) → el consumo queda ligado a la variante del momento del corte; opcionalmente alerta si el override cambia el material.
- Merma no modelada → toda diferencia sale como variance hasta que se defina un % de merma esperado por material.
- UoM mal configurada (hay 12 UoM, incluidas `$`, `N/A`, `SA`, que no son físicas) → requiere limpieza previa y `is_stock_tracked=false` para las no físicas; alerta `uom_mismatch`.
- Permisos partner: todo permiso debe validarse también en RPC/Edge, no solo en UI, reutilizando el patrón de `supabase/functions/_shared/authz.ts` y `role_routes`, con acciones `core.raw_materials.*`.
- Costos históricos: los movimientos guardan snapshot de costo para que un cambio de precio no reescriba el pasado.

Permisos propuestos, tal como los pediste: `core.raw_materials.view`, `.catalog.manage`, `.stock.view`, `.stock.adjust`, `.count.create`, `.count.review`, `.alerts.view`, `.alerts.resolve`.

## 11. Fases recomendadas

- Fase 1 — Stock y movimientos: columnas nuevas en materiales, tablas de stock y kardex, RPC de movimiento, pestañas Inventario y Movimientos, entradas manuales y ajustes.
- Fase 2 — Descuento por Corte: marcado `deducts_stock` en estructuras de costos, RPC de consumo idempotente, enganche en el escaneo, alerta de receta faltante.
- Fase 3 — Cierre diario y alertas: pantalla operario ciega, cálculo de esperado, tolerancias, tabla de alertas y resolución admin.
- Fase 4 — Dashboard, comprometido y disponibilidad para OP: aviso no bloqueante al crear OP, resumen diario de consumo.
- Fase 5 — Futuro: requisiciones sugeridas y proyección productiva.

## 12. Preguntas pendientes

1. ¿Una sola ubicación de materia prima (fábrica) o varias desde el inicio? Afecta si el stock es por material o por material+ubicación.
2. ¿El empaque (325 líneas `packaging`) debe descontarse en Corte o al ingresar la unidad a inventario?
3. Tolerancia por defecto: ¿un % global (p. ej. 3%) o se define material por material desde el inicio?
4. ¿El conteo físico lo hace el operario desde el portal móvil, o un encargado desde el panel admin?
