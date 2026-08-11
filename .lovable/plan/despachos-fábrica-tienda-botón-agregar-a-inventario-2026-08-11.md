# Despachos fábrica → tienda + botón "Agregar a inventario"

Cierra el vacío entre prenda terminada en fábrica y prenda recibida en tienda, sin tocar WooCommerce, Partidas, Nómina, costos, OP, QR ni la lógica de escaneo de procesos.

## Parte 1 — Botón "Agregar a inventario" (/core/escaneo)

En la sección Inventario de la unidad, cuando todos los procesos estén completos:

- Botón principal único: **Agregar a inventario** (ya no "Generar preview" / "Regenerar preview" / "Abrir inventario" como acción principal).
- Si no existe entrada preparada, se crea; si ya existe una en estado `preview`, se reutiliza (no se regenera, no se duplica).
- Idempotencia mantenida por unidad + `stock_increase` (comportamiento actual del backend).
- Enlace secundario discreto: "Ver entrada preparada" (abre /core/inventario).
- Se muestra el estado operativo actual de la unidad (lista para inventario, en despacho, enviada, recibida, ingresada).

## Parte 2 — Nueva pantalla /core/despachos

Menú Basico Core → grupo Operación → "Despachos".

Tabs: Borradores · Cerrados · Enviados · Recibidos · Diferencias · Todos.
Cada fila: número DSP, estado, destino, total unidades, fecha, acciones.

Acciones por estado:
- Borrador: abrir, escanear/agregar unidades, cerrar, cancelar.
- Cerrado: PDF Fábrica, PDF Tienda, Imprimir ambos, Marcar como enviado.
- Enviado: confirmar recepción / escanear recepción / reportar diferencias.
- Recibido: ver detalle, descargar PDFs.

### Crear despacho
Campos: sede destino (de `core_locations`), responsable fábrica, fecha salida estimada, observaciones, transportista (opcional), orden de producción asociada (opcional).

Luego se escanean unidades una por una. Cada unidad agregada muestra unit_code, producto, SKU, talla, OP y estado. Solo se aceptan unidades terminadas/listas. Si no lo está: "Esta unidad aún no está lista para despacho." Si ya está en otro despacho activo: aviso con el número DSP donde está.

Contadores en vivo: total prendas, productos únicos, tallas, OP incluidas.

### Cerrar despacho
Valida ≥1 unidad y que todas estén listas. Asigna número definitivo `DSP-000001` (secuencia), estado `closed`, guarda fecha/hora y usuario. Bloquea edición. NO toca inventario ni Woo.

### Enviar y recibir
- "Marcar como enviado" → `sent`, unidades en tránsito.
- En tienda: abrir por número DSP → confirmar todo recibido, o escanear unidad por unidad, o reportar diferencias.
- Todo coincide → `received`, unidades pasan a recibidas/ingresadas en la sede destino.
- Faltantes/sobrantes → `received_with_differences`, se guardan diferencias y observación, y solo lo recibido se marca ingresado.

## Parte 3 — PDFs

Al cerrar se habilitan dos PDFs con el mismo número DSP (jsPDF, mismo patrón que el PDF de Orden de Producción):

1. **Despacho Fábrica → Tienda**: número, fecha/hora cierre, sede destino, responsable, total prendas, OP asociadas, resumen agrupado por producto/SKU/talla, detalle de unit_codes, espacio de firma de salida.
2. **Recepción de Mercancía**: número, sede destino, fecha/hora salida, total esperado, resumen agrupado, detalle de unit_codes con casilla de chequeo, espacio "recibido conforme", espacio diferencias, responsable tienda, firma y fecha.

## Parte 4 — Inventario y duplicados

- Cerrar y enviar NO suman stock. Solo confirmar recepción marca las unidades como ingresadas a la sede destino (según lo acordado: control por estado de unidad, sin tabla nueva de stock por sede; el inventario por sede se obtiene contando unidades).
- Recepción NO llama a WooCommerce; el ingreso a Woo sigue el flujo actual de Escaneo/Inventario.
- Una unidad no puede estar en dos despachos activos (índice único parcial).
- Una unidad recibida no se puede recibir dos veces; una unidad ya ingresada no vuelve a ingresar.

## Detalles técnicos

Migración (nuevas tablas, con GRANT + RLS coherente con Core: lectura/escritura para usuarios autenticados, all para service_role):

- `core_dispatches`: id, dispatch_number (único, null en borrador), status, destination_location_id, destination_location_name, factory_responsible, carrier_name, production_order_id, expected_departure_date, notes, closed_at, sent_at, received_at, received_by_name, created_by, created_at, updated_at (+ trigger updated_at).
- `core_dispatch_units`: id, dispatch_id, unit_id, unit_code, production_order_id, product_name, sku, size, status (`in_dispatch` / `received` / `missing` / `extra`), received_at, difference_note, created_at.
- Índice único parcial sobre `unit_id` para despachos en estados activos (draft/closed/sent).
- Secuencia + función `core_next_dispatch_number()` para `DSP-000001`.
- Función `core_close_dispatch(dispatch_id)` y `core_receive_dispatch(dispatch_id, received_unit_ids[], note)` en SECURITY DEFINER para cierre/recepción atómicos, incluyendo el cambio de estado de las unidades.
- Estados operativos de unidad en `core_production_units.status`: se añaden `in_dispatch`, `sent_to_store`, `received_in_store`; se conservan los actuales (`completed`, `entered_inventory`) sin alterar la lógica de procesos.

Archivos:
- Nuevos: `src/pages/core/CoreDispatches.tsx`, `src/components/core/dispatches/*` (diálogo nuevo despacho, escáner de unidades, detalle, recepción), `src/lib/coreDispatchPdf.ts`, `src/hooks/useCoreDispatches.ts`.
- Modificados: `src/App.tsx` (ruta /core/despachos), `src/pages/core/CoreLayout.tsx` (menú Operación), `src/components/core/UnitInventorySection.tsx` (botón "Agregar a inventario" + estado de unidad).

Al final: typecheck con 0 errores.
