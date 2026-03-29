

## Plan: Tabla de contactos con seleccion manual en el Segment Builder

### Problema actual
1. El Segment Builder calcula 63 contactos correctamente, pero al sincronizar con Brevo, la Edge Function `brevo-sync-contacts` ignora los filtros del segmento y sincroniza TODOS los clientes de `customers_cache` (la funcion solo entiende `segmentFilter.type === "all"` o `"orders_count"`, no el formato de condiciones actual)
2. No hay forma de ver que contactos coinciden ni de agregar emails manualmente

### Solucion

**1. Mostrar tabla de contactos que coinciden**
- Despues del contador "63 contactos coinciden", mostrar una tabla con los contactos resultantes (email, nombre, orders_count, total_spent, ciudad)
- Llamar a `campaign-audience` con `count_only: false` cuando el usuario quiera ver los contactos
- Boton "Ver contactos" que carga y muestra la tabla
- Checkboxes para seleccionar/deseleccionar contactos individuales
- Select all / deselect all

**2. Agregar emails manuales**
- Input con boton "Agregar email" debajo de la tabla
- Los emails manuales se agregan a la lista de contactos seleccionados
- Se muestran en la tabla con un badge "Manual"

**3. Arreglar `brevo-sync-contacts` para respetar los filtros**
- En vez de que `brevo-sync-contacts` re-consulte `customers_cache` con su propia logica rota, enviarle directamente la lista de emails seleccionados desde el frontend
- El wizard llama a `campaign-audience` (sin count_only) para obtener los contactos, luego pasa esos contactos + los manuales a `brevo-sync-contacts`
- Modificar `brevo-sync-contacts` para aceptar un array `contacts` directo ademas del `segmentFilter`

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/campaigns/SegmentBuilder.tsx` | Agregar tabla de contactos, checkboxes, input de email manual. Exponer contactos seleccionados via callback |
| `src/pages/CampaignWizard.tsx` | Pasar contactos seleccionados a `brevo-sync-contacts` en vez de solo el filtro |
| `supabase/functions/brevo-sync-contacts/index.ts` | Aceptar array `contacts` directo; si viene, usarlo en vez de consultar DB |

### Flujo resultante

```text
1. Usuario configura condiciones → contador muestra "63 contactos"
2. Click "Ver contactos" → tabla con 63 filas (todos seleccionados por defecto)
3. Usuario puede deseleccionar algunos o agregar emails manuales
4. Click "Sincronizar con Brevo" → envia solo los contactos seleccionados
5. Brevo recibe exactamente esos contactos, sin re-consultar la DB
```

