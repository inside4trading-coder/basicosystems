## Problema

En el Pipeline, cuando un contacto está en "Nuevo", aparece el mensaje **"Registra el primer movimiento — Agrega una interacción o cambia el estado a Contactado cuando inicies la conversación."** Este mensaje solo menciona interacciones, ignorando que registrar una **colaboración** (envío de producto, post realizado) también es un movimiento válido y de hecho un avance mucho mayor en la relación.

Además, cuando se registra una colaboración desde la pestaña Colaboraciones, el estado del Pipeline **no se actualiza automáticamente**, por lo que un contacto puede tener producto enviado y post publicado pero seguir mostrándose como "Nuevo" en el Pipeline. Eso es lo que el usuario percibe como "las colaboraciones no salen en pipeline".

## Solución

### 1. Auto-avance del Pipeline al guardar una colaboración
En `RRPPCollaborations.tsx → handleSave`, después de insertar/actualizar la colaboración, calcular el estado mínimo que debería tener el contacto y hacer un update en `rrpp_contacts.relationship_status` solo si el nuevo estado es **mayor** que el actual (no retroceder, no pisar estados terminales como `colaboracion_exitosa`, `no_colaboro`, `descartado`).

Reglas (de menor a mayor):
- `send_date` con algún valor → mínimo `producto_enviado`
- `received = true` → mínimo `producto_enviado`
- `collab_done = true` → mínimo `colaboracion_en_curso`
- (los terminales como `colaboracion_exitosa` se siguen marcando manualmente desde el Pipeline)

Ranking usado para comparar: `nuevo(0) < contactado(1) < producto_enviado(2) < colaboracion_en_curso(3)`. Si el actual es terminal, no se modifica. Si el calculado ≤ actual, no se modifica. Se registra en el audit log el cambio automático con motivo "auto: colaboración registrada".

Tras guardar, refrescar también el contacto padre para que el badge de estado en el header y en el stepper se actualicen. Como `RRPPCollaborations` no tiene callback al padre actualmente, se añade un prop opcional `onPipelineChanged?: () => void` y se llama desde `RRPPProfile.tsx` pasándole `load` (la función que recarga el contacto).

### 2. Mensaje del Pipeline en estado "Nuevo"
En `RRPPPipeline.tsx`, ampliar el bloque de "Registra el primer movimiento" para mencionar las tres vías válidas:

> "Agrega una interacción, registra una colaboración o cambia manualmente el estado cuando inicies el contacto."

Así queda claro que registrar una colaboración cuenta como primer movimiento.

## Archivos a modificar

- `src/components/rrpp/RRPPCollaborations.tsx` — añadir lógica de auto-avance del estado, prop `onPipelineChanged`, lectura previa del estado actual del contacto.
- `src/pages/RRPPProfile.tsx` — pasar `onPipelineChanged={load}` al render de `<RRPPCollaborations />`.
- `src/components/rrpp/RRPPPipeline.tsx` — actualizar el copy del bloque "Registra el primer movimiento".

Sin cambios de base de datos ni de tipos.