# Estética [B] SYSTEMS aplicada al hub interno

## Qué ya está alineado

El sistema visual del panel ya tiene la base del manual cargada: azul primario #0B37FF, tinta #0A0D12, gris Slate, Mist, el rosa de alerta, radios 12/22, las curvas y tiempos de animación (240 / 160 / 400 ms), y las tres tipografías (Chakra Petch, JetBrains Mono, texto de sistema). También existen las clases de vidrio, títulos de marca, tarjetas de indicador y etiquetas de estado.

El problema no es la paleta: es que **casi nada del panel usa esas piezas**. Las clases de marca están definidas pero prácticamente sin uso, y muchas pantallas escriben colores sueltos (blanco, negro, códigos fijos) en vez de los del sistema.

## Qué falta inyectar (por orden de impacto visual)

1. **La ventana como motivo**
   El manual construye toda su identidad sobre la ventana: barra superior de 38 px, radio 16, tres puntos a la izquierda y una etiqueta técnica a la derecha. Hoy el panel no la usa en ninguna parte. Es el elemento que más cambia la percepción con menos trabajo: aplicarla a las tarjetas principales de cada módulo y a los paneles de detalle.

2. **La voz técnica en las etiquetas**
   Todo lo que sea dato técnico (códigos, referencias, SKU, fechas, numeración, "actualizado hace 2 min", encabezados de sección tipo "03 · SISTEMA") debe ir en la tipografía monoespaciada con mayúsculas y espaciado amplio. Hoy hay uso suelto de monoespaciada, pero ninguna pantalla usa el estilo de etiqueta de marca. Esto es lo que hace que un panel se lea como "sistema" y no como plantilla.

3. **Cabecera de módulo consistente**
   El manual define una jerarquía fija: etiqueta técnica pequeña arriba, título grande en Chakra Petch, y subtítulo de lectura. Cada módulo del hub (Ventas, Pedidos, Core, Sublime, España, Crew…) hoy encabeza a su manera. Unificarlo en una sola cabecera reutilizable ordena todo el hub de golpe.

4. **Números tabulares en todas las cifras**
   Ya se usan en algunas tablas, no en las tarjetas de indicador ni en los importes. Sin esto las columnas de dinero bailan.

5. **Iconografía coherente**
   El manual pide un solo color por icono, trazo lineal, sin rellenos ni degradados, y prohíbe mezclar sets. Hoy la barra lateral y los módulos usan iconos genéricos con tratamientos distintos. Unificar tamaño, grosor y color (azul / tinta / blanco, nunca dos a la vez).

6. **Movimiento**
   Entrada 240 ms escala 0,96 → 1, salida 160 ms, transición entre vistas 400 ms, nunca rebote ni rotación. Los tiempos están definidos pero no se aplican; hoy hay animaciones fuera de norma (temblor, revelado con desenfoque de 600 ms).

7. **Gráficas fuera de marca**
   Las gráficas del resumen usan una paleta ajena (rojo, verde, amarillo, morado). Deben ir a una escala azul del 100 al 900 con el rosa reservado solo para alertas.

8. **Barra de estado del sistema**
   El manual muestra un panel interno con "actualizado hace X" y contadores de pendientes / en proceso / completados. Existe en Ventas pero no como pieza común. Convertirlo en una franja de estado reutilizable en la cabecera de cada módulo.

9. **Colores sueltos**
   Hay pantallas con blanco, negro y códigos fijos escritos a mano (Fuerza Venezuela, Login, Mapa Woo/Core, Reportes, varios diálogos). Rompen el sistema y el modo oscuro.

10. **Tono de los textos**
    Voz de producto: precisa y breve. "Cambios guardados", "12 pedidos pendientes". Revisar mensajes largos o técnicos en avisos y estados vacíos.

## Propuesta de trabajo por fases

**Fase 1 — Núcleo visual (mayor impacto, riesgo bajo)**
Crear tres piezas reutilizables: la ventana de marca, la cabecera de módulo y la etiqueta técnica. Aplicarlas primero al Resumen de ventas y al inicio de Basico Core como referencia visual.

**Fase 2 — Propagación**
Extender cabecera, etiquetas y números tabulares al resto de módulos del hub, sin tocar lógica.

**Fase 3 — Detalle fino**
Paleta de gráficas, unificación de iconos, tiempos de animación normalizados y limpieza de colores escritos a mano.

## Detalles técnicos

- Nuevos componentes en `src/components/brand/`: `BrandWindow` (barra 38px, radio 16, tres controles, etiqueta mono a la derecha), `ModuleHeader` (eyebrow mono-cap + h1 display + subtítulo + slot de acciones), `SystemStatusBar` (última actualización + contadores).
- Añadir a `src/index.css`: utilidades `.mono-cap` ya existente pero sin uso — adoptarla; `.num` con `font-variant-numeric: tabular-nums`; `.motion-in` / `.motion-out` atadas a `--ease-brand`, `--dur-in`, `--dur-out`.
- Paleta de gráficas: derivar de `--blue-100/300/500/700/900` + `--destructive` solo para alerta; centralizar en un array exportado y sustituir `PIE_COLORS` en `Dashboard.tsx` y demás gráficas.
- Sustituir literales de color en los archivos con más ocurrencias: `FuerzaVenezuela.tsx`, `Login.tsx`, `AporteDialog.tsx`, `PolicyEventsAttentionPanel.tsx`, `CoreReports.tsx`, `CoreWooCoreMap.tsx`, `CoreProducts.tsx`.
- Eliminar `animate-shake` y ajustar `scroll-reveal` a 240 ms con la curva de marca.
- Sin cambios de base de datos, rutas, permisos ni lógica de negocio.

## Fuera de alcance

Landing pública, favicon, imágenes de redes, y cualquier cambio funcional.
