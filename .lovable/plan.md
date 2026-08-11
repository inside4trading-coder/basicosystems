# Entradas preparadas: revalidación obligatoria contra stock Woo actual

Objetivo: nunca ingresar una unidad a inventario (ni escribir en WooCommerce) usando un stock snapshot viejo. Toda entrada preparada caduca a los 15 minutos y debe actualizarse contra el stock real de Woo antes de confirmar.

Alcance: solo Inventario Core, Escaneo y la capa de escritura Woo. No se tocan OP, QR, procesos, nómina, partidas, costos ni generación de unidades.

## 1. Regla de vencimiento (TTL)

- Constante compartida `INVENTORY_PREVIEW_TTL_MINUTES = 15`.
- Una entrada preparada es **Vigente** si su última actualización tiene menos de 15 minutos; si no, es **Desactualizada**.
- La edad se calcula sobre el momento en que se tomó el stock (se actualiza también al regenerar, no solo al crear).

## 2. Backend (capa segura de escritura Woo)

En `core-woo-stock-write`:

- Nueva acción `regenerate`: recibe el id de la entrada preparada existente, consulta el stock actual en Woo, recalcula `stock_before` y `stock_after_expected = stock actual + delta`, y **actualiza la misma fila** (no crea otra). Se rechaza si la entrada ya está `confirmed`/`success`/`skipped`.
- La acción `preview` deja de invalidar y duplicar filas cuando el stock cambió: actualiza la fila existente con el stock nuevo (misma clave de idempotencia `unit_code::stock_increase`).
- La acción `confirm` valida de forma defensiva antes de escribir:
  - si la entrada supera el TTL → error claro: "Esta entrada fue preparada hace más de 15 minutos. Actualiza el stock esperado antes de confirmar."
  - si el stock leído en vivo no coincide con el snapshot → error: "El stock Woo cambió desde que se preparó esta entrada. Regenera el preview antes de confirmar." (se actualiza la fila con el stock real para que un solo clic de "Actualizar stock esperado" la deje lista).
  - nunca escribe con snapshot viejo: el valor escrito siempre se calcula sobre la lectura en vivo del momento de confirmar.

## 3. /core/inventario — pestaña "Entradas preparadas"

Cada fila muestra: fecha/hora de preparación, edad ("hace X min"), stock antes (snapshot), stock esperado y estado (Vigente / Desactualizada / Error).

Botones:
- Vigente: "Confirmar y escribir en WooCommerce" + "Actualizar stock esperado".
- Desactualizada: confirmar deshabilitado, botón principal "Actualizar stock esperado" con la nota "Consulta WooCommerce ahora y recalcula el stock esperado antes de confirmar."
- Tras actualizar, la fila se refresca en el sitio (misma entrada, sin duplicar) y queda vigente.

## 4. /core/escaneo (sección Inventario de la unidad)

- Sin entrada preparada: botón "Agregar a inventario" (crea entrada fresca y, en modo `manual_confirm`, confirma en el acto porque el stock recién se leyó).
- Con entrada vigente: "Confirmar entrada a inventario" + "Actualizar stock esperado".
- Con entrada desactualizada: confirmar bloqueado, botón principal "Actualizar stock esperado" y el texto "Antes de ingresar a inventario, actualiza el preview para usar el stock Woo actual." Tras actualizar, se habilita confirmar.

## 5. Idempotencia

- Clave `unit_code + stock_increase` intacta; regenerar siempre actualiza la fila existente.
- Si ya fue confirmada/exitosa: no se permite regenerar ni confirmar de nuevo (mensaje de bloqueo).

## Detalles técnicos

- `supabase/functions/core-woo-stock-write/index.ts`: acción `regenerate`, TTL en `confirm`, `preview` actualiza en lugar de invalidar+crear.
- Nuevo `src/lib/coreInventoryPreview.ts`: constante TTL y helpers `isPreviewStale` / `previewAgeLabel`.
- `src/pages/core/CoreInventory.tsx`: columnas de edad/estado, gating del botón confirmar, acción actualizar.
- `src/components/core/UnitInventorySection.tsx`: mismos estados y botones para el flujo de escaneo.
- Sin cambios de esquema: se reutilizan `core_woo_write_logs` (`created_at`/`updated_at`, `stock_before`, `stock_after_expected`, `woo_product_id`, `woo_variation_id`, `idempotency_key`).
- Verificación: typecheck y revisión de la pestaña en el preview.
