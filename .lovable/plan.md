## Problema

Hoy los botones **Importar** y **Exportar** dentro de Materia Prima navegan a `/core/templates-carga` y dejan al usuario en la lista de templates, sin un punto de acción claro para cargar el CSV. Hay que recorrer la fila del template "Materia Prima — Base" y reconocer los iconos pequeños (subida / descarga) para continuar.

## Solución

Hacer que Importar/Exportar de Materia Prima abran directamente el flujo correspondiente, usando el template activo de Materia Prima, sin pasar por la tabla.

### Comportamiento nuevo

**Botón "Importar" en Materia Prima**
1. Busca el template activo más reciente con `data_type = raw_material` y `direction in ('import','both')`.
2. Si existe: abre directamente el diálogo de importación (mismo `ImporterDialog` que ya existe) con ese template.
3. Si no existe ninguno: muestra un toast indicando que debe crear/activar un template y ofrece un botón "Ir a Templates de Carga".

**Botón "Exportar" en Materia Prima**
1. Mismo lookup, pero filtra por `direction in ('export','both')`.
2. Si existe: abre un mini-menú con dos opciones — "Descargar formato base (CSV vacío)" y "Exportar datos actuales" — y ejecuta la elegida.
3. Si no existe: toast con redirección a Templates de Carga.

**En Templates de Carga (mejora menor de descubribilidad)**
- Añadir un banner/CTA superior cuando se llega con el query param `?focus=raw_material` (opcional, para el caso "fallback"), que resalte la fila del template Materia Prima.
- Añadir labels visibles "Importar CSV" / "Exportar datos" junto a los iconos de acción (hoy solo tienen `title`), o agruparlos en un botón "Acciones" con menú, para que sean más reconocibles.

### Detalles técnicos

- `src/pages/core/CoreRawMaterials.tsx`:
  - Quitar `navigate("/core/templates-carga")` de ambos botones.
  - Añadir estado `importerTemplate` y `exporterTemplate`.
  - Reutilizar los componentes `ImporterDialog` y las utilidades `downloadBase` / `exportCurrent` ya existentes en `CoreImportTemplates.tsx`. Para evitar duplicación, extraer `ImporterDialog`, `downloadBase`, `exportCurrent` y los helpers (`downloadCsv`, `slug`, constantes) a un nuevo archivo compartido: `src/pages/core/import-templates/` (o `src/lib/coreImport.tsx`).
  - `CoreImportTemplates.tsx` pasa a importar desde el archivo compartido.
- Añadir auditoría: registrar `action = "open_import_from_raw_materials"` y `"open_export_from_raw_materials"` para rastrear el origen.
- Mantener intactos los flujos actuales en `/core/templates-carga` (lista, editor de campos, historial).

### Riesgos / no incluidos

- No se cambia el esquema de BD ni el template "Materia Prima — Base".
- No se modifica el comportamiento del importador en sí (preview, validación, auto-creación de categorías/unidades, auditoría) — solo el punto de entrada.
- Si más adelante hay varios templates de Materia Prima activos, se usa el más reciente; podemos añadir un selector en una iteración posterior si hace falta.
