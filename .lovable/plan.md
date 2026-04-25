# Por qué los costes salen siempre en $0.00

## Causa raíz (confirmada con datos)

Revisé las 17 llamadas en `calls_cache`:
- `total_cost = 0` y `max_cost = 0` para todas, incluso las contestadas con duración > 0.
- Inspeccionando `raw_data` de las llamadas contestadas, el payload de Zadarma se ve así:

```json
{
  "sip": "100",
  "clid": "Vendedor 1 basico (100)",
  "call_id": "1776517648.11580",
  "seconds": 7,
  "callstart": "2026-04-18 15:07:28",
  "destination": 34627596999,
  "disposition": "answered",
  "is_recorded": "false",
  "pbx_call_id": "out_2d7f..."
}
```

**No existe ningún campo `cost`, `bill_cost`, `price`, etc.** El edge function `zadarma-sync` lee `Number(s.cost || s.bill_cost || 0)` → siempre 0.

El motivo es que estamos llamando al endpoint `statistics/pbx` con `version=2`, que devuelve el **detalle de llamadas de la centralita PBX** pero **no incluye facturación**. En la API de Zadarma, los costes viven en un endpoint distinto: `statistics` (estadísticas de SIP/cuenta), que devuelve por cada llamada saliente campos como `cost` y `billsec`.

El frontend (`useCallsData.ts` y la tabla en `Llamadas.tsx`) ya lee correctamente `cost` — el bug está 100% en el lado de sincronización.

## Solución propuesta

Modificar `supabase/functions/zadarma-sync/index.ts` para enriquecer cada llamada con su coste real.

### Paso 1 — Llamar también al endpoint de facturación

Después de obtener `stats` desde `statistics/pbx`, hacer una segunda llamada paralela a:

```
GET /v1/statistics/?start=...&end=...&type=all
```

Este endpoint devuelve un array donde cada elemento tiene (entre otros): `id` (call_id de la PBX), `sip`, `clid`, `destination`, `seconds`, **`cost`**, **`billsec`**, `disposition`.

### Paso 2 — Construir un mapa de costes

Indexar los resultados por `call_id` y, como fallback, por la combinación `(pbx_call_id || sip + callstart + destination)` por si algún registro de PBX no matchea por id directo.

### Paso 3 — Mergear en el upsert

En el `.map(...)` actual, sustituir:

```ts
cost: Number(s.cost || s.bill_cost || 0),
```

por una búsqueda en el mapa de costes:

```ts
cost: costMap[callId] ?? costMap[pbxCallId] ?? 0,
```

### Paso 4 — Re-sincronizar histórico

Tras desplegar, ejecutar manualmente el botón "Sincronizar" en `/llamadas` para el rango deseado para que las 17 llamadas existentes reciban sus costes (el upsert por `call_id` los actualizará in place).

## Notas técnicas

- Si Zadarma devuelve costes en EUR (no USD), el label `$` en `Llamadas.tsx` (líneas 290 y 338) puede quedarse o cambiarse a `€` — confirmar moneda real con la primera respuesta y ajustar el símbolo.
- El endpoint `statistics/` también respeta zona horaria y formato `YYYY-MM-DD HH:MM:SS`, por lo que reutilizamos `formatForZadarma()` y la firma HMAC ya existente.
- No requiere cambios en frontend, tipos ni base de datos. Sólo edge function.

## Archivos a modificar

- `supabase/functions/zadarma-sync/index.ts` — añadir fetch del endpoint `statistics/`, construir `costMap`, aplicar en el map final.

## Verificación

1. Tras el deploy, pulsar "Sincronizar" en `/llamadas` con un rango que incluya llamadas contestadas.
2. Confirmar en DB: `SELECT call_id, talk_duration, cost FROM calls_cache WHERE cost > 0 LIMIT 5;`
3. Confirmar en UI que la columna "Coste" muestra valores > 0 para llamadas contestadas con duración.
