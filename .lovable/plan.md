
# Fondo Transparente / Fuerza Venezuela — Fase 1

Construcción por fases. Esta es **Fase 1**: cimientos completos + lo mínimo operativo end-to-end (registrar aportes, confirmar/rechazar, y página pública leyendo datos reales). Conciliación, carga masiva CSV, egresos, auditoría enriquecida y export quedan para Fases 2 y 3.

Acceso privado: **admin + manager**. Página pública `/fuerza-venezuela`: abierta e indexable. Tasa VES→USD: **manual por aporte** (sin API externa).

---

## 1. Base de datos (nuevas tablas, aisladas)

Prefijo `fondo_` para no tocar nada existente.

- **`fondo_aportes`** — donaciones reportadas
  - Datos donante: `nombre_donante`, `nombre_publico`, `es_anonimo`, `email_contacto` (privado)
  - Movimiento: `metodo` (`pago_movil`/`binance`/`zelle`), `moneda_original` (`VES`/`USD`/`USDT`), `monto_original`, `tasa_usada`, `equivalente_usd`
  - Referencias: `referencia_privada`, `referencia_publica_enmascarada`, `comprobante_privado_url`
  - Fechas: `fecha_reportada`, `fecha_confirmada`, `created_at`, `updated_at`
  - Estado: `por_verificar` / `coincidencia_encontrada` / `confirmado` / `rechazado` / `duplicado` / `monto_incorrecto`
  - Notas: `nota_publica`, `nota_interna`
  - Auditoría inline: `verificado_por`, `fecha_verificacion`, `created_by`

- **`fondo_movimientos_cargados`** (Fase 2, creada vacía ahora) — movimientos bancarios importados por CSV

- **`fondo_egresos`** (Fase 3, creada vacía ahora) — gastos

- **`fondo_audit_log`** — registro de cambios (usuario, acción, tabla, record_id, valor_anterior jsonb, valor_nuevo jsonb)

- **`fondo_configuracion`** — singleton: textos públicos, título, disclaimer, tasa sugerida del día (opcional, no obliga)

### Seguridad
- RLS activado en todas
- Privadas (`fondo_aportes` con datos sensibles, `fondo_movimientos_cargados`, `fondo_egresos`, `fondo_audit_log`, `fondo_configuracion` escritura): solo `admin` y `manager`
- Lectura pública anónima vía **vistas seguras** (`fondo_public_aportes`, `fondo_public_egresos`, `fondo_public_totales`) que solo exponen columnas seguras y filas con estado apto (confirmados / ejecutados / por verificar para el contador). Sin emails, sin referencias completas, sin comprobantes privados.
- GRANTs explícitos: `authenticated` (admin/manager via RLS) + `anon` solo sobre las vistas públicas
- Storage buckets:
  - `fondo-comprobantes-privados` (privado, solo admin/manager)
  - `fondo-comprobantes-publicos` (público, versiones censuradas)

### RPCs (`SECURITY DEFINER`)
- `fondo_confirmar_aporte(id, tasa, equivalente_usd, nota_publica)` — valida rol, cambia estado, registra auditoría
- `fondo_rechazar_aporte(id, motivo, nuevo_estado)` — para rechazado/duplicado/monto_incorrecto
- `fondo_confirmar_lote(ids[])` — confirma varios con coincidencia exacta (Fase 2; en Fase 1 dejamos el RPC creado pero solo confirma de uno en uno hasta tener conciliación)

---

## 2. Rutas y navegación

- **Privado** (dentro de AppLayout/sidebar):
  - `/fondo-transparente` → layout con tabs/subnav
    - Dashboard (Fase 1 ✅)
    - Aportes reportados (Fase 1 ✅)
    - Conciliación (Fase 2 — placeholder "Próximamente")
    - Carga masiva (Fase 2 — placeholder)
    - Egresos (Fase 3 — placeholder)
    - Auditoría (Fase 1 ✅ lectura básica)
    - Configuración pública (Fase 1 ✅ editar título/disclaimer)
- **Público**: `/fuerza-venezuela` (Fase 1 ✅) — ruta fuera de `ProtectedRoute`, sin sidebar
- Sidebar: nuevo ítem "Fondo Transparente" visible solo para admin/manager
- `role_routes`: añadir `/fondo-transparente` a admin y manager

---

## 3. UI Fase 1

### Privado `/fondo-transparente`
- **Dashboard**: 6 cards (total confirmado USD, por verificar, gastos ejecutados [0 en F1], saldo disponible, # confirmados, # pendientes) + última actualización
- **Aportes reportados**: tabla con filtros (estado, método, moneda, fecha, monto), botón "Nuevo aporte" (sheet con formulario completo), acciones por fila: Confirmar (dialog con tasa/USD), Rechazar, Marcar duplicado, Marcar monto incorrecto, editar notas
- **Configuración pública**: form simple para título, subtítulo, disclaimer, tasa sugerida
- **Auditoría**: tabla read-only con últimos 200 eventos

### Público `/fuerza-venezuela`
- Diseño sobrio b/n, mobile-first, tipografía editorial consistente con el HUB
- Hero: "fuerza venezuela" + subtítulo + última actualización
- 4 cards de totales (leyendo `fondo_public_totales`)
- Tabla "ingresos confirmados" (de `fondo_public_aportes` filtrando confirmados)
- Tabla "aportes por verificar" (mínima: fecha, método, monto)
- Tabla "egresos ejecutados" (vacía en F1)
- Disclaimer legal al pie
- SEO: `<title>`, meta description, OG tags, H1 único, JSON-LD `Organization`
- Sin login, sin sidebar, sin acciones

---

## 4. Detalles técnicos

- Hook `useFondoData` con React Query: aportes, totales, config
- Enmascaramiento de referencias hecho en SQL dentro de la vista (`****` + últimos 4)
- Sin tocar: `esp_*`, `core_*`, `orders`, WooCommerce, inventario, fabricación, caja, RRPP, Crew
- Tipos TS regenerados después de la migración
- Sitemap: añadir `/fuerza-venezuela`

---

## 5. Entregable Fase 1

Al terminar Fase 1, el equipo puede:
1. Crear aportes manualmente (mientras llegan reportes por WhatsApp/form externo)
2. Confirmar/rechazar cada uno con tasa manual
3. Ver totales en dashboard
4. Compartir `/fuerza-venezuela` públicamente con datos reales

**Fase 2** (siguiente turno tras aprobar F1): conciliación + carga masiva CSV + confirmación por lote.
**Fase 3**: egresos completos con comprobantes + export CSV + auditoría enriquecida.

¿Apruebas Fase 1 para empezar la migración?
