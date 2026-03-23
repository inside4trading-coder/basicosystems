

# Plan: Configurar secrets y diseñar tablas

## Paso 1 — Configurar secrets

Necesitamos añadir 5 secrets al proyecto usando la herramienta `add_secret`. Se pedirán uno a uno al usuario:

1. **WC_CONSUMER_KEY** — Clave de consumidor de WooCommerce (se obtiene en WooCommerce → Ajustes → REST API)
2. **WC_CONSUMER_SECRET** — Secreto de consumidor de WooCommerce (mismo lugar)
3. **TRELLO_API_KEY** — Se obtiene en https://trello.com/power-ups/admin → API Key
4. **TRELLO_TOKEN** — Se genera desde la página de API Key de Trello (enlace "Token")
5. **TRELLO_WORKSPACE_ID** — ID del workspace de Trello (visible en la URL del workspace)

Brevo se dejará para más adelante, según lo indicado.

## Paso 2 — Explorar las APIs con Edge Functions temporales

Una vez configurados los secrets, crearemos dos edge functions de exploración para inspeccionar la estructura real de los datos:

- **woo-explore**: Llama a `GET /wp-json/wc/v3/orders?per_page=1`, `GET /wp-json/wc/v3/customers?per_page=1` y `GET /wp-json/wc/v3/products?per_page=1` para ver los campos disponibles.
- **trello-explore**: Llama a `GET /1/members/me/boards` y `GET /1/boards/{id}/lists` con cards para ver la estructura de tableros, listas y tarjetas.

Ejecutaremos estas funciones con `curl` para obtener las respuestas reales.

## Paso 3 — Crear tablas de base de datos

Con los datos reales de las APIs, diseñaremos las migraciones SQL para:

| Tabla | Propósito |
|-------|-----------|
| `profiles` | Usuarios del hub con roles (admin/manager/partner), linked a auth.users |
| `customers_cache` | Cache de clientes WooCommerce con campos de segmentación |
| `segments` | Filtros guardados para campañas |
| `campaigns` | Campañas de email enviadas |
| `campaign_stats` | Métricas de cada campaña |

Las columnas exactas se definirán según los campos reales que devuelvan las APIs de WooCommerce y Trello.

## Paso 4 — RLS policies

Se crearán políticas de seguridad por fila basadas en roles usando una función `has_role` con `SECURITY DEFINER`, junto con una tabla `user_roles` separada.

---

**Orden de ejecución**: Secrets → Edge functions de exploración → Analizar respuestas → Crear migraciones → RLS policies.

