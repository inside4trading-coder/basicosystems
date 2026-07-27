## Diagnóstico

1. **CHECK real** en `core_fabrication_fund_movements`:
   ```
   source IN ('woocommerce','manual','system','reprocess_pending','adjustment')
   ```
2. **Valor único usado hoy** en la tabla: `'woocommerce'`.
3. **Qué inserta la RPC actual**: `source = 'manual_missing_sku_resolution'` → viola el CHECK.
4. **Escrituras parciales**: 0 filas con `cost_snapshot_data->>'manual_missing_sku_resolution' = 'true'`. Nada que limpiar.

## Fix mínimo

Redefinir sólo la RPC `public.core_resolve_missing_sku_pending_item` en una migración nueva (mismo cuerpo actual, único cambio en el INSERT):

- `source` → `'woocommerce'` (valor válido, coherente con los `sale_generated` normales del procesador de Partidas, ya que el pending item proviene de un pedido Woo).
- Toda la trazabilidad "manual missing_sku" queda en `cost_snapshot_data`:
  ```json
  {
    "manual_missing_sku_resolution": true,
    "resolution_action": "replacement_prepare" | "no_restock",
    "pending_item_id": "<uuid>",
    "reason": "missing_sku",
    "unit_cost": <numeric>
  }
  ```
  (Ya se está construyendo así; no se toca.)
- `notes` sigue con el string de auditoría actual.
- No se toca `core_close_missing_sku_pending_item`, ni el trigger `trg_replacement_fund_balance`, ni la actualización manual de `available_amount` para `sale_generated`.
- No se amplía el CHECK constraint.

## Validación

- `replacement_prepare`: INSERT ya no viola CHECK; movimiento queda con `movement_type='sale_generated'`, `fund_bucket='pending_classification'`, `source='woocommerce'`, marcador en `cost_snapshot_data`. Luego se abre `ReplacementApplicationDialog`; pending item sigue abierto.
- `no_restock`: mismo INSERT válido con `fund_bucket='non_restockable'`; pending item pasa a `resolved`; no se abre reemplazo.
- Idempotencia por `(source_order_id, source_order_item_id)` intacta.

## Alcance

- Cero cambios en UI, Woo, OP, inventario, catálogo, Sublime, estructuras de tabla.
- Sin tablas nuevas, sin refactor.
- Un único archivo: nueva migración con `CREATE OR REPLACE FUNCTION public.core_resolve_missing_sku_pending_item(...)`.

## Verificación tras aplicar

- Typecheck: n/a (sólo SQL).
- Probar caso "gora nautica / pedido 34233" en `replacement_prepare` y otra fila en `no_restock`; confirmar por SQL que el movimiento se crea una sola vez con `source='woocommerce'` y `cost_snapshot_data.manual_missing_sku_resolution = true`.
