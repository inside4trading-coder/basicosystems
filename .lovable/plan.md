## Diagnóstico confirmado

OP-000007 (`d50243c2…`, `open`): 30 unidades pedidas, 17 creadas. Falla por colisión de `unit_code` contra el índice único `core_production_units_unit_code_uniq`. La secuencia se calcula por línea, pero el código es `ORDER-SKU-TALLA-###`, y hay líneas distintas con mismo SKU+talla:
- `CORE000003 / XL`: línea `4983488d` (JGM48 XL, ya con `OP-000007-CORE000003-XL-001`) vs línea `0c39a287` (JGM49 XL, 0 unidades).
- `JGM43 / S`: línea `14671018` (ya con `OP-000007-JGM43-S-001`) vs línea `98a83279` (0 unidades).

El frontend solo muestra "non-2xx" porque `functions.invoke` no expone el body del error.

## 1. Backend — `supabase/functions/core-generate-production-units/index.ts`
- Mantener faltantes por línea: `quantity_ordered - unidades_existentes_de_la_línea`.
- Antes del bucle: construir `existingCodes` (set de `unit_code` de la OP) y `seqByCodeKey` (contador por `orderCode|productTag|sizeTag`).
- Al crear cada unidad: `seq = ++contador[clave]`, y avanzar mientras el código ya exista en `existingCodes`.
- Reintento defensivo ante error `23505` (unit_code o qr_token duplicado): marcar el código como ocupado y probar el siguiente, hasta 5 intentos.
- Si aun así falla, responder 500 con error estructurado: `error, production_order_id, line_id, sku, variant_sku, product_name, size, unit_code, created_before_error, reason`.
- Sin cambios en modo repair, política, procesos ni auditoría.

## 2. Frontend — `src/pages/core/CoreQRTravelSheets.tsx`
- En `generate()`: si el error trae `context` (FunctionsHttpError), leer `await error.context.json()` y mostrar en el toast `reason`/`error` + SKU/variante/talla de la línea afectada; fallback al mensaje genérico si no hay body.

## Validación
- Regenerar faltantes en OP-000007 → 13 unidades nuevas, 30/30, sin `unit_code` ni QR duplicados (verificar con consulta).
- Etiquetas/fichas generables; si una línea falla, el toast indica cuál y por qué.
- Typecheck.

Sin tocar Woo, Partidas, Necesidades, inventario, políticas, migraciones ni RPC.
