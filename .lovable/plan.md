## Corrección final /fuerza-venezuela

Solo cambios de diseño, jerarquía, copy y responsive en `src/pages/FuerzaVenezuela.tsx`. No se tocan RPCs, tablas, cálculos ni rutas.

### 1. Header superior (sticky)

Refactor del `<header>` existente:
- **Izquierda**: logo `logo-fondo-transparente-v2.png` + microtexto "por [basico]".
- **Derecha (desktop)**: mini-cápsula glass con:
  - label "recaudado confirmado"
  - valor `~ US$ {totalesUSD.ingresado_confirmado_usd}` (usa el valor ya calculado de aportes confirmados, no por verificar)
  - botón primario "donar ahora" que abre `AporteDialog`.
- **Mobile**: logo arriba, debajo fila compacta `recaudado | botón donar`. Botón "donar ahora" siempre accesible (sticky).

### 2. Contexto del terremoto (slim)

Eliminar la caja roja grande. Reemplazar por una banda fina justo bajo el header (border-l acento rojo, fondo `bg-red-500/5`, una línea):
- Principal: "respuesta activa por el terremoto ocurrido en venezuela"
- Secundario (muted, una línea): "este fondo nace para canalizar aportes y convertirlos en ayuda visible, con ingresos, gastos y saldo disponible publicados."

### 3. Quitar redundancia

Eliminar el badge "EN VIVO · TRANSPARENTE · VENEZUELA". En la zona de las tarjetas de estado del fondo añadir microtexto "actualizado tras verificación".

### 4. Hero reescrito

Composición:
- H1: "fuerza venezuela" (logo o tipografía actual)
- Subtítulo: "una nueva forma de ayudar."
- Párrafo explicativo de 4 líneas (donas → confirma → disponible → publicamos gasto/comprobante/contenido).
- Remate grande: **"no nos creas."** / **"míralo."** (display, dos líneas, acento).
- Línea soporte: "ingresos visibles. gastos con soporte. saldo disponible."
- CTAs: primario "donar ahora", secundario "ver fondo" (scroll a `#resumen`).

### 5. Bloque "cómo funciona" + responsive

Sección dedicada con 5 pasos: DONAS → VERIFICAMOS → PUBLICAMOS → EJECUTAMOS → MOSTRAMOS, cada uno con su copy corto del brief. Cierre: "no es una promesa de transparencia. es una plataforma para verla."

- **Desktop (`md:`+)**: flujo horizontal actual con flechas laterales `→`.
- **Mobile**: timeline vertical — cards full-width apiladas, ícono + título + descripción, conector vertical sutil (línea + chevron `↓`) entre pasos. Sin flechas laterales. Mismo estilo dark/tech/glow.

Se hará con dos render paths (`hidden md:flex` para horizontal, `flex md:hidden` para vertical) para no forzar la adaptación.

### 6. Tarjetas de estado del fondo

Ajustar solo los labels (valores siguen igual):
- "disponible total aprox."
- "recaudado confirmado"
- "gastado con soporte"

Pie aclaratorio (muted, small): "los montos aproximados combinan Bs, USD y USDT usando la tasa BCV activa para bolívares. los saldos reales se mantienen separados por moneda."

### 7. Detalles técnicos

- Archivo único: `src/pages/FuerzaVenezuela.tsx`.
- Reutilizar `AporteDialog`, `totalesUSD`, `tasaBCV` y RPCs ya existentes.
- Tokens semánticos existentes (no hardcodear colores).
- Sticky header con `position: sticky; top: 0; z-50` + backdrop-blur.
- Verificación: build + screenshots Playwright en desktop (1280) y mobile (390) del hero y la sección "cómo funciona".

### Fuera de alcance
Lógica contable, tablas de aportes/egresos, RPCs, rutas, otros módulos.
