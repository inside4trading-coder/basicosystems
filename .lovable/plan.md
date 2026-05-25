## RRPP por marca + flujo unificado a prueba de flojos

Reestructurar el módulo RRPP para que opere por marca (Básico Venezuela, Sublime, Básico España/Europa), con metas y métricas independientes, y unir Pipeline + Colaboraciones en una sola pestaña que guíe paso a paso de pedido → envío → publicación.

### 1. Selector global de marca

Tabs grandes arriba del módulo (junto al título RRPP), persistidos en URL (`?brand=basico_ve|sublime|basico_es`) y en `localStorage` para que la próxima vez abra donde quedaste.

```
┌─ RRPP ──────────────────────────────────────────────┐
│  [ Básico VE ] [ Sublime ] [ Básico ES / Europa ]   │
│  ┌─ Dashboard │ Contactos ───────────────────────┐  │
```

Todo lo que se ve debajo (dashboard, lista de contactos, metas, métricas, formulario de alta) queda scopeado a esa marca. España = guía para todo internacional/worldwide.

### 2. Modelo de datos (cambios mínimos, retrocompatibles)

**`rrpp_contacts`** → agregar columna `brand text NOT NULL DEFAULT 'basico_ve'` con CHECK in (`basico_ve`,`sublime`,`basico_es`). Backfill existentes a `basico_ve`. Índice por brand.

**`rrpp_collaborations`** → agregar campos del nuevo flujo:
- `order_details text` (datos del pedido: productos, talles, observación)
- `shipping_name`, `shipping_address`, `shipping_city`, `shipping_country`, `shipping_phone` (datos de envío)
- `tracking_number text` (gateway de la fábrica)
- `shipped_at timestamptz` (cuando se marcó como enviado)
- `published_at timestamptz` (cuando se marcó como publicado)
- `post_url text` (URL del post publicado)

`brand` se hereda del contacto (no se duplica).

**Nueva tabla `rrpp_brand_goals`** para metas mensuales editables por marca:
- `brand text`, `year int`, `month int`, `captaciones int`, `activaciones int`, `colaboraciones int`
- PK compuesta (brand, year, month)
- Defaults precargados según tu doc: BV 10/8, BES 10/8, SUB 6/4 (colaboraciones lo mantenemos heredando de activaciones por ahora)
- Reemplaza el `localStorage` actual de metas

### 3. Flujo unificado: pestaña "Relación" (reemplaza Pipeline + Colaboraciones)

El contacto YA fue clasificado por RRPP fuera del sistema. Al crearlo en el hub se asume comprometido. La nueva pestaña muestra una colaboración activa con stepper guiado (puede haber varias en historial; la activa arriba, el resto colapsado abajo).

**Stepper visual (4 pasos)**
```
[1 Pedido] ─── [2 Envío] ─── [3 Publicación] ─── [4 ✓ Exitosa]
```

- **Paso 1 — Pedido**: productos + datos de envío (nombre, dirección, ciudad, país, teléfono). Botón "Marcar como enviado".
- **Paso 2 — Envío**: al marcar enviado, aparece campo obligatorio **Número de guía** + se autocompleta `shipped_at`. Cualquier miembro del equipo (admin/manager/rrpp/marketing) lo puede completar. Estado del contacto pasa a `producto_enviado` automáticamente.
- **Paso 3 — Publicación**: aparecen campos red + URL del post + fecha. Botón "Marcar contenido publicado". Estado pasa a `colaboracion_en_curso`.
- **Paso 4 — Exitosa**: confirmación + opcional cupón/ingresos. Estado pasa a `colaboracion_exitosa`.

Pestañas anteriores Pipeline e Interacciones siguen existiendo, pero la antigua "Colaboraciones" desaparece y se fusiona en "Relación". Tabs finales del perfil:
`Datos generales · Redes sociales · Relación · Interacciones · Notas privadas`

Cualquier paso puede saltarse con "Cerrar como no colaboró / descartado" desde un menú secundario (mantiene los terminales actuales).

### 4. Metas y métricas por marca

**Card "Metas del mes"** ahora lee/escribe `rrpp_brand_goals` con scope a la marca activa. 3 barras: Captaciones, Activaciones, Colaboraciones exitosas.

**Dashboard scopeado** — todo el cálculo (`StatCard`s, breakdowns, tendencia, top reach) filtra `contacts.brand === brandActiva`. Switcher de marca en el header. Si se elige el tab de una marca sin datos, muestra estado vacío.

**Defaults precargados** vía seed al ejecutar la migración:

```
basico_ve  → captaciones 10, activaciones 8, colaboraciones 7
sublime    → captaciones  6, activaciones 4, colaboraciones 3
basico_es  → captaciones 10, activaciones 8, colaboraciones 7
```

Admin las edita inline igual que hoy.

### 5. Alta de contacto

`AddContactSheet` toma la marca del selector global automáticamente (se muestra como chip "Se agrega a: Básico VE" para evitar errores). Permitido cambiarla en el form si el usuario quiere.

### 6. Filtros / vista lista

La lista de contactos ya filtra por marca activa. Filtros existentes (tipo, estado, responsable, ciudad) se mantienen. Buscador igual. En tarjeta de contacto se agrega un mini-badge de marca cuando el usuario esté con filtro "todas" (futuro, opcional).

### Detalles técnicos

**Archivos a editar**
- `supabase/migrations/...` nueva migración (schema + seed metas)
- `src/types/rrpp.ts` — añadir `brand`, campos nuevos de `Collaboration`, tipo `RRPPBrand`
- `src/hooks/useRRPPData.ts` — filtros por brand, helpers para metas
- `src/pages/RRPP.tsx` — selector global de marca, filtrado por brand
- `src/pages/RRPPProfile.tsx` — quitar tab "collaborations", reemplazar pipeline tab por "relacion"
- `src/components/rrpp/RRPPDashboard.tsx` — leer `brand`, metas desde tabla, scope de cálculos
- `src/components/rrpp/AddContactSheet.tsx` — inyectar marca activa
- `src/components/rrpp/RRPPCollaborations.tsx` → renombrar/refactor a `RRPPRelacion.tsx` con stepper

**Archivos a crear**
- `src/components/rrpp/BrandSwitcher.tsx`
- `src/components/rrpp/RRPPRelacion.tsx` (stepper + lista de colaboraciones)
- `src/hooks/useRRPPBrand.ts` (estado URL+localStorage)
- `src/hooks/useRRPPGoals.ts` (CRUD `rrpp_brand_goals` por brand+mes)

**Compatibilidad**
- Datos existentes se migran a `basico_ve` automáticamente.
- El `localStorage` de metas se ignora (no se borra); nuevas metas viven en DB.
- RLS de las nuevas tablas: misma policy que el resto del módulo (admin/rrpp/marketing).

### Lo que NO entra en este plan
- Rol "fábrica" separado (decidiste: cualquier miembro del equipo).
- Permitir múltiples marcas por contacto (uno solo por contacto; si lo quieren duplicar, crean otro registro).
- Métricas custom configurables por marca (queda fuera; las 3 metas base alcanzan).

¿Avanzo a implementarlo así?
