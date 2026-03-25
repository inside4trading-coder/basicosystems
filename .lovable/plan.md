

## Plan: Usar cache para todos los filtros del CRM

### Problema actual
Cuando el filtro es "Todos", el CRM hace una llamada en vivo a la API de WooCommerce (`woo-customers` edge function) en cada carga de página. Los demás filtros sí usan `customers_cache`. Esto causa lentitud y dependencia innecesaria de la API externa.

### Solución
Hacer que **todos los filtros** (incluido "Todos") lean desde `customers_cache`. El botón de sincronización (↻) será la única acción que contacte WooCommerce para actualizar el cache.

### Cambios

**1. `src/pages/CRM.tsx`**
- Eliminar `fetchFromWoo()` completamente
- Modificar `fetchCustomers()` para que siempre use `fetchFromCache()`
- En `fetchFromCache()`, cuando `customerType === "all"`, no aplicar filtro de `orders_count` — solo traer todos los clientes paginados
- El botón sync sigue llamando a `woo-customers-sync` como antes

**2. Sin cambios en edge functions ni migraciones**
La lógica de sync ya funciona correctamente guardando en `customers_cache`. Solo necesitamos que el frontend lea siempre desde ahí.

### Resultado
- Primera carga: instantánea desde la base de datos local
- Sync manual (↻): actualiza el cache desde WooCommerce
- Todos los filtros funcionan sobre la misma fuente de datos

