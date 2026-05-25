
# BASICO CORE — Bloque 1

Construir el esqueleto del módulo CORE con **Configuración Core 100% funcional** y el resto de submódulos como placeholders. Sin lógica de producción, QR real, escaneo, nómina ni inventario.

## 1. Navegación y rutas

- Añadir entrada **"BASICO CORE"** en `AppSidebar.tsx` (icono `Factory`, ruta `/core`), protegida por `canAccessRoute`.
- Nuevo layout `CoreLayout` con sub-navegación lateral interna (segundo nivel) o tabs verticales, con secciones:
  - Dashboard Core — `/core`
  - Configuración Core — `/core/configuracion`
  - Placeholders ("Próximamente"): Materia Prima, Templates de Carga, Estructuras de Costos, Templates de Costos / Producción, Productos Core, Partidas de Fabricación, Necesidades de Producción, Órdenes de Producción, QR / Ficha Viajera, Escaneo, Nómina, Inventario, Reportes.
- Registrar todas las rutas en `App.tsx` bajo `ProtectedRoute` + `AppLayout`.
- Agregar las nuevas rutas a `role_routes` (admin y manager por defecto).

## 2. Dashboard Core (`/core`)

Grid de 7 cards en estado vacío (valor `0` o `—`), sin queries reales todavía:

- Órdenes activas
- Prendas en producción
- Prendas listas para inventario
- Nómina semanal pendiente
- Partida de fabricación disponible
- Productos no restockeables vendidos
- Última sincronización WooCommerce

Header con título, subtítulo y badge de "Módulo activo" leído desde `core_settings`.

## 3. Configuración Core (`/core/configuracion`)

Página con tabs:

- **A. General** — formulario sobre `core_settings` (singleton key/value o fila única).
- **B. SKU** — prefijo, dígitos, último número, preview del próximo SKU. Solo configuración, sin generar nada.
- **C. Etiquetas QR** — ancho/alto mm y switches de qué incluir.
- **D. Sedes / Ubicaciones** — tabla CRUD sobre `core_locations`.
- **E. Estados WooCommerce** — tabla CRUD sobre `core_woocommerce_status_rules` con filtros por grupo y badges.
- **F. Roles Core** — vista de solo lectura de `core_role_definitions` (lista con permisos descritos). Sin asignación de usuarios aún.

Toda escritura registra fila en `core_audit_logs`.

## 4. Tablas Supabase (migración única)

Todas con `id uuid pk`, `created_at`, `updated_at`, `created_by`, `updated_by`, RLS habilitada, trigger `set_updated_at`.

- **`core_settings`** — fila única: `module_name`, `description`, `status`, `main_location_id` (fk a `core_locations`), `allow_stock_in_transit bool`, `update_woocommerce_inventory bool`, `multi_location_mode text` ("preparado"/"no_activo"), `sku_prefix text`, `sku_digits int`, `sku_last_number int`, `qr_width_mm numeric`, `qr_height_mm numeric`, `qr_include_qr bool`, `qr_include_human_code bool`, `qr_include_sku bool`, `qr_include_size bool`, `qr_include_production_order bool`, `qr_include_unit_number bool`.
- **`core_locations`** — `name`, `type` ('sede'|'transito'|'futura'), `is_main bool`, `status` ('activa'|'inactiva'), `notes`.
- **`core_woocommerce_status_rules`** — `slug unique`, `canonical_name`, `group` ('confirmado'|'pendiente'|'excluido'), `enters_production bool`, `monitored bool`, `excluded bool`, `active bool`.
- **`core_role_definitions`** — `key unique` ('admin'|'manager'|'administracion'|'responsable'|'operario'), `display_name`, `description`, `permissions jsonb`, `sort_order int`.
- **`core_audit_logs`** — `table_name`, `record_id uuid null`, `action`, `field_changed`, `old_value`, `new_value`, `performed_by text`.

**RLS:** todas con policy `admin_manager_all` (ALL) usando `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')`. `core_role_definitions` y `core_woocommerce_status_rules` adicionalmente legibles por cualquier `authenticated` (SELECT) para que futuros responsables/operarios puedan consultarlas.

## 5. Seed inicial (vía insert)

- `core_locations`: `Pop Up Sublime Barquicenter` (sede, principal, activa) y `Stock en tránsito` (tránsito, activa).
- `core_settings`: fila única con valores especificados (sede principal apuntando a Pop Up Sublime Barquicenter, SKU prefix `CORE`, dígitos `6`, last_number `0`, QR 57×40 con todos los includes en `true`).
- `core_woocommerce_status_rules`: 19 filas listadas (10 confirmados → `enters_production=true`, 5 pendientes → `monitored=true`, 4 excluidos → `excluded=true`, todos `active=true`).
- `core_role_definitions`: 5 roles con descripciones y `permissions` jsonb resumiendo capacidades.

## 6. Audit logging

Helper `logCoreAudit({ table, recordId, action, field, oldValue, newValue })` en `src/lib/coreAudit.ts` que inserta en `core_audit_logs` con `performed_by` = email del usuario actual. Llamado tras cada update/insert en Configuración.

## 7. Diseño

- Hub layout siguiendo patrón existente (cards, badges, tablas shadcn).
- Tokens del design system (rojo `#E3001B`, negro `#0A0A0A`, Inter). Sin colores hardcodeados.
- Submódulos placeholder: card centrada con icono, título y "Próximamente — disponible en bloque futuro".

## Detalles técnicos

```text
src/pages/core/
  CoreLayout.tsx
  CoreDashboard.tsx
  CoreConfiguracion.tsx
  CorePlaceholder.tsx       // reutilizable para 13 secciones
src/components/core/
  CoreSidebar.tsx
  config/
    GeneralTab.tsx
    SkuTab.tsx
    QrLabelTab.tsx
    LocationsTab.tsx
    WooStatusRulesTab.tsx
    RolesTab.tsx
src/hooks/useCoreSettings.ts
src/hooks/useCoreLocations.ts
src/hooks/useCoreStatusRules.ts
src/hooks/useCoreRoles.ts
src/lib/coreAudit.ts
src/lib/coreSku.ts          // pure: nextSku(prefix, digits, lastNumber)
```

Rutas en `App.tsx`:

```text
/core                       -> CoreDashboard
/core/configuracion         -> CoreConfiguracion
/core/materia-prima         -> CorePlaceholder ("Materia Prima")
/core/templates-carga       -> CorePlaceholder
/core/estructuras-costos    -> CorePlaceholder
/core/templates-costos      -> CorePlaceholder
/core/productos             -> CorePlaceholder
/core/partidas-fabricacion  -> CorePlaceholder
/core/necesidades           -> CorePlaceholder
/core/ordenes-produccion    -> CorePlaceholder
/core/qr                    -> CorePlaceholder
/core/escaneo               -> CorePlaceholder
/core/nomina                -> CorePlaceholder
/core/inventario            -> CorePlaceholder
/core/reportes              -> CorePlaceholder
```

## Fuera de alcance (bloques futuros)

Materia prima, costos, productos, OPs, QR real, escaneo, nómina, inventario, reportes, asignación de usuarios a roles operario/responsable, edge functions de sync.

## Resultado verificable

1. `/core` visible en sidebar para admin/manager.
2. Dashboard Core renderiza 7 cards vacías.
3. `/core/configuracion` permite editar las 6 áreas y persistir cambios.
4. Tablas creadas con RLS y seed cargado (2 sedes, 19 reglas Woo, 5 roles, 1 settings).
5. Cada cambio en Configuración aparece en `core_audit_logs`.
6. 13 placeholders accesibles desde la sub-navegación.
