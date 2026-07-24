## Objetivo

En las filas de Necesidades con acción `suggest_replacement` (badge "Reemplazo sugerido"), agregar un botón **"Definir política"** junto a "Aplicar reemplazo" y "Marcar revisado", que abra el mismo diálogo ya existente para configurar la política (No restock / Reemplazar por otra prenda / Salida).

## Cambios

Único archivo: `src/components/core/woocore/PolicyEventsAttentionPanel.tsx`

1. Importar `NoRestockConfigDialog` y agregar estado local `policyEvent`.
2. En el bloque de acciones del row (dentro del `if (r.action === "suggest_replacement")`), añadir un segundo botón:
   - `<Button size="sm" variant="outline" onClick={() => setPolicyEvent(r)}>Definir política</Button>`
3. Al pie del componente, renderizar `<NoRestockConfigDialog>` cuando `policyEvent` esté seteado, pasando:
   - `initialCtx` con `{ core_product_id, core_sku, core_name, woo_product_id, ... }` derivado del row (mismo formato usado en Mapa Woo/Core).
   - `onDone` invalida las queries de necesidades y cierra el diálogo.

## Notas

- Reutiliza el diálogo existente que ya soporta las tres opciones (No restock, Reemplazar por otra prenda del catálogo de fabricación, Salida) y ya valida candidatos bloqueados.
- No se toca lógica de backend ni RPC.
- Mantiene "Aplicar reemplazo" para el caso en que ya se acepta el reemplazo sugerido tal cual.
