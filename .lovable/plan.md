## Objetivo

Dejar el módulo de Administración completamente en blanco (sin obligaciones, sin pagos programados, sin historial) para poder cargar la información correcta desde cero.

## Qué se borrará

Se eliminarán **todos los registros** de las siguientes tablas del backend:

1. **`admin_instances`** — todas las cuotas/pagos que aparecen en el calendario y la lista (pendientes, pagados, vencidos, etc.).
2. **`admin_obligations`** — todas las obligaciones recurrentes configuradas (alquiler, servicios, impuestos, etc.).
3. **`admin_audit_log`** — historial de cambios asociado, para que no queden referencias huérfanas.

## Qué NO se tocará

- **`admin_config`**: categorías, métodos de pago, responsables y demás listas de configuración se conservan.
- Archivos de comprobantes ya subidos al storage `admin-payments` permanecerán en el bucket (no se borran automáticamente; si los quieres eliminar también, dímelo).
- Ningún otro módulo (Crew, CRM, Pedidos, Planning, etc.) se ve afectado.

## Resultado esperado

Al entrar a `/administracion`:
- Calendario completamente vacío.
- Lista de obligaciones vacía.
- KPIs en cero.
- Listo para crear las obligaciones correctas desde cero.

## Detalles técnicos

Operación de borrado vía SQL en orden seguro:

```sql
DELETE FROM admin_audit_log;
DELETE FROM admin_instances;
DELETE FROM admin_obligations;
```

**Importante:** esta acción es irreversible. Una vez aprobado, los datos no se pueden recuperar.

¿Apruebas para proceder?