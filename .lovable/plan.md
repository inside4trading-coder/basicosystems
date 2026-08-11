# Agregar a inventario: preview fresco obligatorio y trazabilidad visible

## Estado actual (verificado en el código)

- En Escaneo, "Agregar a inventario" sí crea la entrada preparada automáticamente cuando no existe, y luego confirma (modo `manual_confirm`).
- Al crear la entrada, la función consulta el stock real de WooCommerce, pero **si esa consulta falla cae silenciosamente al stock cacheado** (`woo_stock_quantity` local) y devuelve la entrada como válida. Ese es el hueco: se puede confirmar sobre un stock que nunca se leyó de Woo.
- Al confirmar sí se re-lee Woo, se bloquea si el stock cambió y, tras el PUT, se vuelve a leer para verificar. Esa parte ya cumple.
- El banner de éxito hoy no dice si la entrada fue generada en el momento o reutilizada, ni a qué hora se consultó Woo.

## Cambios

### 1. Backend (`core-woo-stock-write`)

- Crear/refrescar entrada preparada: si no hay credenciales Woo o el GET de stock falla, **no crear ni devolver entrada válida**. Responder error 502 con el mensaje: "No se pudo consultar el stock actual de WooCommerce. No se ingresó la prenda."
- Guardar en `request_payload` de la entrada:
  - `preview_generated_at`
  - `woo_stock_checked_before_at`
  - `preview_source`: `generated_on_confirm` | `regenerated` | `reused_valid_preview`
- En `confirm`, guardar además `woo_stock_checked_before_at` (re-lectura previa al PUT) y `woo_stock_checked_after_at` (verificación posterior), más `confirmed_at` (ya existe como columna).
- Devolver en `verification` los campos nuevos: `preview_source`, `woo_stock_checked_before_at`, `woo_stock_checked_after_at`, `confirmed_at`.
- Sin cambios de esquema: todo va dentro del JSON `request_payload` ya existente.

### 2. Frontend

- `src/components/core/UnitInventorySection.tsx` (Escaneo): al pulsar "Agregar a inventario" sin entrada previa, pasar el flag de origen y propagar `preview_source` al resultado. Si la creación de la entrada falla por Woo, mostrar el error exacto y no confirmar. Si la entrada existe pero está desactualizada, se mantiene el bloqueo actual con "Actualizar stock esperado".
- `src/components/core/InventoryWriteResult.tsx`: en el banner verde agregar las líneas:
  - Entrada preparada: generada ahora / reutilizada vigente / actualizada
  - Stock Woo consultado: fecha y hora
  - Stock anterior / Agregado / Stock esperado / Stock final real / Verificación
  - Las mismas líneas se incluyen en el texto de "Copiar reporte" y en el bloque rojo de discrepancia.
- `src/pages/core/CoreInventory.tsx`: mismo banner enriquecido (usa el componente compartido, cambio automático).

## No se toca

OP, QR, procesos, nómina, partidas, costos, despachos, generación de unidades.

## Validación

Unidad sin entrada preparada → "Agregar a inventario" genera preview fresco con lectura Woo, confirma, re-verifica y muestra "Entrada preparada: generada ahora". Woo caído → error y sin ingreso. Discrepancia → alerta roja con reporte copiable. Typecheck 0 errores.
