# Agregar a inventario: preview fresco obligatorio y trazabilidad visible

## Regla clave

Para crear o refrescar una entrada preparada destinada a WooCommerce, nunca usar fallback silencioso al stock cacheado local (`woo_stock_quantity`). Si no se puede leer el stock real de Woo:

- no se crea entrada válida
- no se confirma inventario
- se responde error 502 con el mensaje: "No se pudo consultar el stock actual de WooCommerce. No se ingresó la prenda."

## 1. Backend (`supabase/functions/core-woo-stock-write/index.ts`)

- Crear/refrescar entrada preparada: si faltan credenciales Woo o el GET de stock falla, cortar con 502 y el mensaje exacto. Eliminar la caída silenciosa al stock cacheado.
- Guardar en `request_payload` de la entrada:
  - `preview_generated_at`
  - `woo_stock_checked_before_at`
  - `preview_source`: `generated_on_confirm` | `regenerated` | `reused_valid_preview`
- En `confirm`: guardar `woo_stock_checked_before_at` (re-lectura previa al PUT), `woo_stock_checked_after_at` (verificación posterior) y `confirmed_at`.
- Devolver en `verification`: `preview_source`, `woo_stock_checked_before_at`, `woo_stock_checked_after_at`, `confirmed_at`.
- Se mantiene el bloqueo por entrada desactualizada (TTL 15 min) y por cambio de stock desde el snapshot.
- Sin cambios de esquema: todo dentro del JSON `request_payload` existente.

## 2. Frontend

- `src/components/core/UnitInventorySection.tsx` (Escaneo): al pulsar "Agregar a inventario" sin entrada previa, marcar el origen y propagar `preview_source` al resultado. Si la creación falla por Woo, mostrar el error exacto y no confirmar. Si la entrada existe pero está desactualizada, se mantiene el bloqueo actual con "Actualizar stock esperado".
- `src/components/core/InventoryWriteResult.tsx`: en el banner verde agregar:
  - Entrada preparada: generada ahora / reutilizada vigente / actualizada
  - Stock Woo consultado: fecha y hora
  - Stock anterior / Agregado / Stock esperado / Stock final real / Verificación
  - Las mismas líneas en "Copiar reporte" y en el bloque rojo de discrepancia.
- `src/pages/core/CoreInventory.tsx`: mismo banner enriquecido (usa el componente compartido).

## No se toca

OP, QR, procesos, nómina, partidas, costos, despachos, generación de unidades.

## Validación

Unidad sin entrada preparada → "Agregar a inventario" consulta Woo real, genera preview fresco, confirma, re-verifica el stock final y muestra "Entrada preparada: generada ahora". Woo caído → error 502 y sin ingreso. Discrepancia → alerta roja con reporte copiable. Typecheck 0 errores.
