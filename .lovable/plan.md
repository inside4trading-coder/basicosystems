

## Objetivo

Actualizar la sección **Integraciones** en `/configuracion` para reflejar los servicios realmente conectados al hub y eliminar los que no se usan.

## Estado actual (línea 19-23 de `src/pages/Configuracion.tsx`)

Lista hardcoded:
- WooCommerce ✓ (en uso)
- Trello ✓ (NO se usa — Planning corre sobre Notion vía `notion-planning`)
- Brevo ✗ marcado como desconectado (pero SÍ se usa en Campaigns vía `brevo-campaigns` + `brevo-sync-contacts`)

## Integraciones reales detectadas en el proyecto

| Servicio | Edge function | Módulo | Acción |
|---|---|---|---|
| WooCommerce | `woo-sync`, `woo-orders`, `woo-customers`, `woo-dashboard` | Pedidos, CRM, Dashboard | Mantener |
| Brevo | `brevo-campaigns`, `brevo-sync-contacts` | Campañas | Mantener (corregir a conectado) |
| Notion | `notion-planning` | Planning | **Añadir** |
| Zadarma | `zadarma-sync` | Llamadas | **Añadir** |
| Trello | — | — | **Eliminar** |

## Cambios

**Archivo único**: `src/pages/Configuracion.tsx`

1. **Reemplazar el array `integrations`** (líneas 19-23) con la lista real:
   ```ts
   const integrations = [
     { name: "WooCommerce", description: "basicoclothes.es — Pedidos, CRM, Dashboard", connected: true },
     { name: "Brevo", description: "Email marketing — Campañas", connected: true },
     { name: "Notion", description: "Planning — Calendario editorial", connected: true },
     { name: "Zadarma", description: "Telefonía — Analítica de llamadas", connected: true },
   ];
   ```

2. **Botón "Probar conexión"**: dejarlo visualmente igual (sin lógica nueva — ya existe el patrón). Opcionalmente, hacerlo no-op por ahora (lo deja como botón visual, igual que hoy).

## Fuera de alcance

- No se cambia lógica de sync ni edge functions.
- No se añade un test de conexión real (eso sería un siguiente paso si lo quieres).
- No se toca la sección de Usuarios ni Costos.

## Resultado esperado

La sección Integraciones muestra 4 servicios reales (WooCommerce, Brevo, Notion, Zadarma), todos en verde, y desaparece Trello.

