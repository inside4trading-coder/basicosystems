## Cambios al Dashboard de Pedidos

### 1. Aclarar / ajustar la "Tasa de éxito"
- Mantener la fórmula actual: `Completado / (Completado + Cancelado)` — solo cuenta pedidos "decididos".
- Renombrar el KPI a **"Éxito (decididos)"** y agregar tooltip: *"Sobre pedidos finalizados: completados + enviados vs cancelados/fallidos/reembolsados"*.
- Confirmar que el bucket **Completado** sigue incluyendo: `completed`, `tu-pedido-ha-sido` (Enviado), `pedido-pick-up-re`, `recordartorio-de-`. Agregar nota visible "Incluye enviados y entregados" debajo del título del bucket.

### 2. Tabs Dashboard / Pedidos
Convertir la página `Pedidos.tsx` en dos vistas con botones tipo tab arriba del contenido:
- **Dashboard** (por defecto) → muestra `PedidosDashboard`.
- **Pedidos** → muestra la tabla actual con filtros, búsqueda y paginación.

Solo se renderiza una a la vez. El header (título + buscador) se reorganiza para que el buscador aparezca solo en la vista Pedidos.

### 3. Color verde oscuro para "Completado"
- Agregar un tono nuevo `completed` en el mapa `TONE_CLASSES` del dashboard usando `emerald-700` / `emerald-600` (verde oscuro), distinto al `success` (verde claro) usado en "Pago confirmado".
- El bucket "Completado" pasa de `tone: "primary"` (que se ve rojo por el theme) a `tone: "completed"`.
- Aplicar el mismo verde oscuro al KPI "Completados" y al lado "✓ concretado" de la barra VS.

### 4. Link al pedido en WooCommerce
- Cada fila de la tabla principal y de los listados desplegados de cada bucket recibe un ícono `ExternalLink` que abre en nueva pestaña:
  ```
  https://basicoclothes.com/wp-admin/post.php?post={order_id}&action=edit
  ```
- En la tabla principal: ícono pequeño junto al `#order_number`, con `stopPropagation` para que no dispare el expand de la fila.
- En los listados de buckets: ícono al final de cada fila.

### Archivos a tocar
- `src/pages/Pedidos.tsx` — agregar tabs Dashboard/Pedidos, link externo en filas.
- `src/components/pedidos/PedidosDashboard.tsx` — nuevo tono verde oscuro, rename KPI, nota "incluye enviados", link externo en listados de buckets.

### Detalles técnicos
- Usar estado local `view: "dashboard" | "list"` con default `"dashboard"`.
- El componente `OrderExpandedDetails` no se modifica.
- Los colores nuevos van inline con clases Tailwind `bg-emerald-700/15 text-emerald-700 border-emerald-700/40` (verde oscuro consistente con el design system).
