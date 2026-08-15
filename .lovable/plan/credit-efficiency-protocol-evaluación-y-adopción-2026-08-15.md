# CREDIT EFFICIENCY PROTOCOL — evaluación y adopción

No se modifica código de la aplicación. Esta propuesta solo define cómo trabajamos y qué se guarda en memoria permanente.

## Qué puedo aplicar directamente (sin fricción)

- Exploración dirigida: empezar por el módulo/archivo que nombres y ampliar solo ante dependencia real.
- Superficie mínima de cambio: sin refactors, renombres, cleanup ni reformateos fuera de alcance.
- Reutilizar antes de crear (componentes, hooks, edge functions, tablas, tipos).
- No usar herramientas caras por defecto: nada de web search, imagegen, videogen ni browser automation salvo necesidad real.
- Tratar tu diagnóstico/plan como contexto válido y ejecutar directo; solo señalo contradicciones concretas con el código.
- Sin ciclos de prueba/error: ante un fallo, primero evidencia (error, log, request, stack) y luego un arreglo dirigido.
- Guardrails duros: auth, pagos, inventario, producción, datos históricos, integraciones y migraciones no se tocan si no son parte de la tarea.
- Aviso previo cuando una tarea sea claramente costosa, con alternativa de alcance reducido.
- Aviso cuando un cambio sea trivial y puedas hacerlo tú a mano sin Build.
- Resumen final compacto: Modificado / Resultado / Verificación / No tocado / Pendiente.

## Cómo estamos trabajando hoy (observación honesta)

Ya trabajamos bastante cerca de este protocolo: tus mensajes suelen venir en formato "BLOQUE/PARCHE AHORRO" con alcance cerrado, y la ejecución es normalmente quirúrgica. Los desvíos reales que veo:

- Diagnósticos amplios sobre módulos grandes (el caso de Basico Studio) que consumen varias lecturas. Es evitable pidiendo el diagnóstico acotado a los archivos sospechosos.
- Verificaciones amplias cuando bastaba una consulta puntual a la base o un typecheck.
- Memoria de proyecto desactualizada: el índice actual describe módulos antiguos (Trello en Planning, cuando hoy es Notion) y no menciona Basico Core, España, Sublime, Crew, RRPP ni Basico Studio. Eso obliga a reexplorar contexto que debería estar escrito.

## Riesgos / conflictos del protocolo

- **Regla 2 y 5 llevadas al extremo**: si no exploro dependencias, un cambio "de 2 archivos" puede romper consumidores no vistos. Propuesta: mantengo una lectura de dependencias directas siempre; es barata y evita reintentos caros.
- **Regla 6 (confiar en el diagnóstico entregado)**: si el diagnóstico se apoya en supuestos incorrectos del esquema o de una RPC, ejecutar directo genera migraciones erróneas. Propuesta: verifico solo los hechos de base de datos que la tarea va a modificar.
- **Regla 5 aplicada a cambios de UI complejos**: sin una captura del preview a veces no puedo confirmar un fallo visual. Propuesta: browser solo cuando reportes un bug visual que no se explique leyendo el código.
- **Regla 14 (nada extra)**: puede chocar con requisitos no negociables de la plataforma, como RLS y GRANT en cada tabla nueva. Esos no son trabajo "extra"; los seguiré aplicando siempre.
- **Regla 12 (menos Plan Mode)**: de acuerdo, salvo cambios con impacto en datos históricos o en dinero, donde un plan corto previo sigue siendo más barato que revertir.

## Bloque propuesto para memoria permanente

Se guardaría como regla de proyecto (Core, siempre activa), sin detalles de tareas puntuales:

```text
Modo de trabajo: exploración dirigida al módulo indicado; cambio quirúrgico y mínimo;
reutilizar antes de crear; nada de refactor/cleanup/mejoras no pedidos.
Herramientas caras (web, imagen, video, browser) solo si son imprescindibles.
El diagnóstico o plan del usuario se ejecuta directo; solo se señalan contradicciones con el código.
Ante un fallo: evidencia primero (log/error/request), luego un arreglo dirigido. Sin prueba y error.
No tocar auth, pagos, inventario, producción, datos históricos, integraciones ni migraciones
fuera del alcance de la tarea.
Avisar antes de tareas costosas y cuando un cambio sea trivial de hacer a mano.
Cerrar cada build con: Modificado / Resultado / Verificación / No tocado / Pendiente.
```

Además propongo actualizar el mapa de módulos en memoria (hoy desactualizado) con una línea por módulo: Dashboard, Pedidos, CRM, Campañas, Planning (Notion), Basico Core, España, Sublime, Crew, RRPP, Administración, Basico Studio, Configuración. Eso es lo que más créditos ahorra a futuro, porque evita reexplorar la estructura en cada conversación.

## Qué haría al aprobar esto

1. Guardar el bloque de protocolo en memoria de proyecto (Core).
2. Actualizar/crear la memoria del mapa de módulos e integraciones vigentes.
3. Corregir la entrada obsoleta de Planning (Trello → Notion).

Ningún archivo de la aplicación se modifica.
