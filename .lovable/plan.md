# Ajuste UI de cards y métricas en Órdenes de Producción

Objetivo: dejar claro qué cards son órdenes, qué cards son unidades de producción activa y qué cards son alerta global de inventario/custodia, sin cambiar backend.

## Cambios en `src/pages/core/CoreProductionOrders.tsx`

### 1. Reagrupar visualmente los cards superiores
Reemplazar la fila única de 7 cards por tres bloques separados con título/separador:

```text
Órdenes                |  Producción activa          |  Inventario / custodia (global)
OP abiertas            |  Unid. faltantes prod.      |  Listas sin ingresar
OP en producción       |  Unid. terminadas prod.     |  Ingresadas a inventario
OP cerradas / canceladas
```

- Cada bloque usa un contenedor visual distinto (borde lateral o fondo sutil) para que no se lean como una sola serie.
- Los cards de Inventario / custodia conservan el icono de alerta y el borde rojo cuando `pendingInventoryUnits > 0`.
- Microcopy bajo los valores de inventario: **"Global de OP cargadas"**.

### 2. Ajustar labels para no mezclar entidades
- Si cuenta OP → label dice "OP ...".
- Si cuenta unidades → label dice "Unid. ...".
- Si cuenta inventario → label dice "Listas sin ingresar" / "Ingresadas a inventario" y vive en el bloque Inventario / custodia.

Labels finales:
- Grupo Órdenes: "OP abiertas", "OP en producción", "OP cerradas / canceladas".
- Grupo Producción activa: "Unid. faltantes prod.", "Unid. terminadas prod.".
- Grupo Inventario / custodia: "Listas sin ingresar", "Ingresadas a inventario".

### 3. Métricas globales vs. dependientes de OP en producción
**Globales (sobre las ~500 últimas OP cargadas):**
- `open_orders`, `prod_orders`, `closed`, `cancelled` (órdenes).
- `pendingInventoryUnits` (unidades `completed`).
- `enteredInventoryUnits` (unidades `entered_inventory`).

**Dependientes del bucket `prod` (OP en producción activa/parcial):**
- `prod_pending_units` = Σ `pending_quantity` de OP en `prod`.
- `prod_completed_units` = Σ `completed_quantity` de OP en `prod`.

### 4. Drawer de detalle por OP
Mostrar explícitamente para la orden seleccionada:
- Total
- Terminadas
- Faltantes
- Listas sin ingresar
- Ingresadas

Renombrar "Terminadas prod." → "Terminadas" y "Faltantes prod." → "Faltantes".
Mantener los bloques de inventario de esa orden (ingresadas / pendientes / estado).

### 5. Tabla de líneas
Renombrar columna "Pend." → "Faltantes" tanto en el header desktop como en el card móvil.

### 6. Verificación
- Ejecutar `bunx tsc --noEmit` o el typecheck del proyecto para confirmar 0 errores.
- No crear migraciones ni tocar backend.
