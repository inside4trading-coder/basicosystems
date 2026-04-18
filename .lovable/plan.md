

## Plan: Refactor de clasificación de status de órdenes

Tengo todo lo necesario. Procedo con el mapeo exacto que confirmaste.

### Archivo nuevo: `src/config/orderStatuses.ts`

Constantes públicas idénticas a la spec original (16 etiquetas válidas, 4 excluidas, 7 quick access). Adicionalmente:

```ts
// Mapa slug-BD → etiqueta canónica (basado en tu confirmación)
export const SLUG_TO_CANONICAL: Record<string, string> = {
  "processing":          "Pago confirmado automáticamente: pedido en proceso",
  "pick-up-listo-par":   "Pick-Up Listo para entrega – Pago efectivo",
  "pedido-pick-up-re":   "Pick-Up Recibido – Pago en efectivo",
  "el-pedido-esta-si":   "El pedido esta siendo procesado",
  "pedido-recibido-p":   "Pedido recibido – Por cobrar",
  "recordartorio-de-":   "Recordartorio de calificación",
  "tu-pedido-ha-sido":   "Tu pedido ha sido enviado",
  "pedido-listo-para":   "Pedido listo para entrega/despacho",
  "tu-pago-fue-confi":   "Pago confirmado: pedido listo para procesar",
  "pending":             "Pending payment",
  "completed":           "Pedido recibido por POS – Pago por confirmar",
  "on-hold":             "On hold",
  "ml-pago-por-confi":   "ML – Pago por confirmar",
  "pedido-pending-pa":   "Pago por confirmar",
  "draft":               "Draft",
  // Excluidos de revenue
  "cancelled":           "Cancelled",
  "refunded":            "Refunded",
  "failed":              "Failed",
  "pago-pendiente-po":   "ERROR EN PAGO: Pago pendiente por confirmar",
};

export const toCanonical = (raw: string) => SLUG_TO_CANONICAL[raw] ?? raw;
```

Helpers `isValidOrder`, `isExcludedFromRevenue`, `isQuickAccess` con la firma exacta de la spec, normalizando internamente vía `toCanonical`.

**Nota sobre "En fabricación"**: el slug no está confirmado. Lo dejo en la lista canónica pero no en `SLUG_TO_CANONICAL`. Cuando aparezca en BD, se añade en una línea.

### `src/hooks/useDashboardData.ts`

- Eliminar `const EXCLUDED = new Set(...)`.
- Filtro `paid` para **conteos** (orders, productsSold, dailyOrders): `isValidOrder(o.order_status)` + filtros existentes de USD>0 / VES roto.
- Para **sumas de revenue** (revenue, dailyRevenue, revenueByState, top productos USD, categorías USD): además excluir si `isExcludedFromRevenue(o.order_status)`.
- Mismo tratamiento al `prevPaid`.

### `src/pages/Pedidos.tsx`

- Reordenar `STATUS_OPTIONS` para que los 7 quick-access aparezcan primero (no se ocultan los demás). Uso `isQuickAccess(toCanonical(value))` para el ordenamiento estable.
- Conservar `statusClass`/`statusLabel` (presentación, fuera de scope).

### `src/pages/Dashboard.tsx`

- Bloque que itera `data.statuses`: ordenar primero los slugs cuyo canonical pertenece a `QUICK_ACCESS_STATUSES`, resto después. Sin ocultar nada.

### Lo que NO se toca

- `CustomerOrdersDialog.tsx`, `woo-sync`, BD, lógica de presentación de badges (statusClass/statusLabel) — fuera de scope per la spec ("no refactorizar lo no relacionado").

### Entregables al finalizar

1. Lista de archivos cambiados con resumen por archivo.
2. Cómo se aplicó cada grupo (1, 2, 3).
3. Conflictos previos detectados (ya identificados: el `EXCLUDED` Set en useDashboardData y los `STATUS_OPTIONS` duplicados en 3 archivos como presentación).

