# Comprobante PDF por operario (Nómina)

Convertir el botón "Comprobante" del detalle de nómina en una descarga de PDF auditable por operario, sin tocar backend, cálculos ni otros módulos.

## Qué cambia para el usuario

- En Basico Core → Nómina → detalle de una nómina, el botón "Comprobante" de cada operario descarga directamente un PDF.
- Se mantiene la vista previa en pantalla actual, ahora con un botón "Descargar PDF" además de "Imprimir".
- El PDF incluye cabecera, tabla de trabajos, resumen por proceso, ajustes, totales y espacio para firmas.
- Nombre del archivo: `BASICO-NOMINA-{codigo}-{operario}.pdf`.

## Contenido del PDF

Cabecera: "BASICO CORE — Comprobante de Nómina", código de nómina, período, fecha de pago, estado, operario, cantidad de procesos, subtotal, ajustes y total USD.

Tabla de detalle, una fila por trabajo vinculado:
Fecha escaneo · OP · Unidad / QR · Producto · Variante / talla · Proceso · Tarifa · Monto.

Resumen por proceso agrupado (por ejemplo: `Costura x56 — USD 35.79`), con subtotal por proceso.

Lista de ajustes (tipo, monto, motivo) si existen.

Bloque de firmas al final: "Firma operario: ______" y "Firma responsable: ______".

Cualquier dato ausente se muestra como "—"; nunca bloquea la generación.

## Detalles técnicos

- Nuevo archivo `src/lib/corePayrollReceiptPdf.ts` con jsPDF (ya usado en `coreProductionOrderPdf.ts` y `coreDispatchPdf.ts`), siguiendo el mismo patrón: A4 mm, helvetica, paginación con helper `ensure()`, `doc.save(...)`.
- Tipos de entrada: cabecera de nómina (`payroll_code`, `period_start`, `period_end`, `payment_date`, `status`), línea de operario (`operator_name_snapshot`, `total_processes`, `subtotal_amount`, `adjustments_amount`, `total_amount`, `currency`), filas de trabajo y ajustes. Todos los montos se pasan tal cual desde los datos ya cargados; el PDF no recalcula nada (solo suma agrupada para el resumen por proceso, que es presentación).
- En `RunDetailDialog` (`src/pages/core/CorePayroll.tsx`) el botón "Comprobante" llamará al generador con `printEntries`/`printAdj` filtrados por línea; se conserva el diálogo de vista previa y se le añade el botón de descarga.
- `core_production_work_entries` no guarda nombre de producto ni variante, solo `core_product_id`/`core_variant_id` y `production_order_id`. En `RunDetailDialog.load()` se ampliará el `select` existente de `core_payroll_work_entry_links` para traer, por relación, el nombre de producto, la etiqueta de variante/talla y el código de OP (lectura adicional en el mismo query o un query complementario por IDs). Si la relación no devuelve dato, la celda queda en "—".
- Fecha de escaneo: `work_entry.created_at` formateado con `formatDMY` (mismo criterio que la vista previa actual).
- Nombre de archivo saneado: solo alfanuméricos y guiones para el nombre del operario.

## Validación

Generar el comprobante de NM-000004 para Estrella De Pedro y confirmar que el total muestra USD 35.79 y que las filas corresponden a sus trabajos vinculados. Typecheck sin errores.
