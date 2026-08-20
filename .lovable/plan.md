# Portal de Operario — 4 ajustes

## 1. Eliminar el Estampado de Luis Cira en OP-000013-JGM52-TALLAS-001

Confirmado en base de datos: existe una work entry de Estampado ($0.30) de Luis Antonio Cira del 20/08 18:44, con `source = portal_operario` y `payroll_status = pending` (no está en ninguna nómina cerrada).

Se elimina de forma consistente, en este orden:
- borrar la work entry (`core_production_work_entries`)
- borrar el evento de escaneo asociado (`core_production_scan_events`)
- devolver el proceso de la unidad a `pending` (limpiar `completed_at` y `completed_by_operator_id`)
- recalcular contadores/estado de la unidad y de la OP-000013

El Corte de Maria Luisa De Albahaca en esa misma unidad no se toca.

## 2. Permitir registrar aunque haya un proceso anterior pendiente

En la edge function `core-operator-portal` se retira la regla que bloquea con "Hay un proceso anterior pendiente". Los procesos fuera de orden quedan registrables y entran a nómina normalmente.

Se mantienen intactos los demás bloqueos: proceso ya completado, duplicado (idempotencia por `production_unit_process_id`), proceso no habilitado para el perfil, unidad u OP cancelada.

Como aviso suave, el proceso fuera de orden se muestra con una etiqueta "Fuera de orden" en la pantalla de confirmación, pero el botón "Registrar proceso" queda activo.

## 3. Últimos escaneos: 10 de hoy + "Ver todo" de la semana

- Por defecto la tarjeta muestra los últimos 10 escaneos **de hoy**, con el subtítulo del día.
- Botón "Ver todo" que despliega todos los escaneos de la semana de nómina vigente (viernes→jueves), agrupados por día con subtotal por día y total acumulado de la semana; botón "Ver menos" para volver.
- El backend pasa a devolver `recent_today` (todos los de hoy) y `recent_week` (todas las entradas de la semana, ya enriquecidas con producto y variante) en lugar del corte fijo de 20.
- Los montos siguen sujetos al enmascarado de privacidad.

## 4. Recordar la preferencia de mostrar/ocultar montos

La preferencia ya se guarda por operario en `localStorage`; se corrige para que sea realmente persistente:
- se distingue "sin preferencia guardada" (por defecto oculto) de "guardado explícitamente", de modo que un valor guardado en `visible` no se reinicie al recargar, al volver del escaneo ni al reingresar con PIN en el mismo dispositivo;
- la preferencia se conserva al cerrar sesión y se vuelve a aplicar al reingresar el mismo operario;
- el mismo estado se aplica también a los montos de la hoja de escaneo y del listado ampliado del punto 3.

## Detalles técnicos

- Datos (punto 1): operación de borrado puntual sobre `core_production_work_entries`, `core_production_scan_events` y `core_production_unit_processes` por IDs exactos ya identificados.
- `supabase/functions/core-operator-portal/index.ts`: quitar `firstPendingOrder` como causa de bloqueo (dejar solo la marca informativa `out_of_order`), y ampliar `buildDashboard` con `recent_today` / `recent_week` y totales por día. Redespliegue de la función.
- `src/lib/operatorPortal.ts`: tipos nuevos del dashboard y helpers de preferencia de montos con estado tri-estado (sin guardar / visible / oculto).
- `src/components/operario/OperatorDashboard.tsx`: sección "Últimos escaneos" con toggle "Ver todo".
- `src/components/operario/OperatorScanSheet.tsx`: etiqueta "Fuera de orden" y respeto de la preferencia de montos.
- `src/pages/operario/OperatorPortal.tsx`: carga/persistencia de la preferencia.

### Verificación
- Consulta de comprobación de que la unidad OP-000013-JGM52-TALLAS-001 queda solo con el Corte y su proceso de Estampado en `pending`.
- Prueba en `/operario`: registrar un proceso fuera de orden, ver los 10 de hoy, abrir "Ver todo" con el acumulado semanal, alternar montos y recargar para confirmar que la preferencia se mantiene.
- Typecheck con `tsgo`.
