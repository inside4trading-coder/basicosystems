## Validación BLOQUE 1 — Basico Core

Revisé la app y la base de datos. El bloque está casi completo. Solo hay dos ajustes menores antes de avanzar al BLOQUE 2.

### Checklist

| # | Item | Estado |
|---|------|--------|
| 1 | Módulo llamado "Basico Core" en UI (sidebar, layout, placeholders) | ✅ |
| 1b | Campo `module_name` en BD aún dice "BASICO CORE" | ⚠️ corregir |
| 2 | Icono `Factory` (fábrica) en sidebar y header del módulo | ✅ |
| 3 | Navegación interna con TODOS los submódulos futuros (4 grupos, 14 rutas) | ✅ |
| 4 | Solo Configuración Core funcional | ✅ |
| 5 | Resto de secciones como placeholder "Próximamente" | ✅ |
| 6 | Tablas `core_settings`, `core_locations`, `core_woocommerce_status_rules`, `core_role_definitions`, `core_audit_logs` | ✅ |
| 7 | Estados WooCommerce clasificados: confirmado (10), pendiente (5), excluido (4) | ✅ |
| 8 | SKU = `CORE` + 6 dígitos | ✅ |
| 9 | Etiqueta QR 57 × 40 mm | ✅ |
| 10 | Sede principal = Pop Up Sublime Barquicenter (`is_main=true`) | ✅ |
| 11 | "Stock en tránsito" como ubicación tipo `transito` | ✅ |
| 12 | Roles Core: admin, manager, administracion, responsable, operario | ✅ |
| 13 | Auditoría: tabla `core_audit_logs` + helper `logCoreAudit` invocado desde todos los hooks de settings/locations/roles/status | ✅ |

### Cambios a aplicar

1. **Actualizar `core_settings.module_name`** de `"BASICO CORE"` → `"Basico Core"` (migración / update).
2. **Marca "BASICO SYSTEMS" → "BASICO SYSTEM"**. Encontrado en:
   - `index.html` (title + og + twitter + meta description: 6 ocurrencias, ya estaban mezcladas: "Basico Systems" y "Basico System")
   - `src/components/AppLayout.tsx` (header superior)
   - `src/pages/Login.tsx`
   - `src/pages/Landing.tsx` (varias ocurrencias del hero/footer)
   
   Reemplazo global de `Basico Systems` → `Basico System` (y `BASICO SYSTEMS` → `BASICO SYSTEM` si aparece en mayúsculas).

### Detalles técnicos

- El update de `module_name` se hará vía migración `UPDATE public.core_settings SET module_name = 'Basico Core' WHERE module_name = 'BASICO CORE';`.
- El resto son ediciones de texto en componentes React/HTML, sin cambios de lógica.

Tras aplicar estos dos ajustes, BLOQUE 1 queda 100 % validado y listo para BLOQUE 2 (Materia Prima).