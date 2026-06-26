
# Rediseño final de /fuerza-venezuela

Solo cambios de diseño, jerarquía y copy en el hero/header y responsive del bloque "cómo funciona". No se toca lógica contable, RPCs, tablas ni cálculos.

## 1. Subir el logo como asset

- Subir `user-uploads://logo_fondo_transparente.png` con `lovable-assets` → `src/assets/logo-fondo-transparente.png.asset.json`.
- Importar como pointer JSON y usar `asset.url` en el header.

## 2. Header superior (nuevo)

Reemplazar el header actual de `src/pages/FuerzaVenezuela.tsx` por una barra fija/sticky con:

- Izquierda: logo Fondo Transparente (alto ~28–32px) + bloque pequeño:
  - línea 1: `fondo transparente` (text-sm font-semibold)
  - línea 2: `por [basico]` (text-[10px] uppercase tracking-wider text-zinc-500)
- Derecha: botón compacto `donar ahora` (rojo #E3001B, abre el selector de canales / hace scroll a `#aportar`).

Eliminar el badge `EN VIVO · TRANSPARENTE · VENEZUELA`.

## 3. Contexto del terremoto (rediseño)

Quitar la alerta grande roja actual. Sustituir por un módulo delgado, editorial:

```
┌──────────────────────────────────────────────────────────┐
│ ▍ respuesta activa por el terremoto ocurrido en venezuela │
│   este fondo nace para canalizar aportes y convertirlos  │
│   en ayuda visible, con ingresos, gastos y saldo         │
│   disponible publicados.                                  │
└──────────────────────────────────────────────────────────┘
```

- Borde izquierdo rojo de 2–3px, fondo `bg-white/[0.02]`, sin glow.
- Una sola línea de título + una línea de descripción en `text-zinc-400`.

## 4. Hero principal (reescritura de copy y jerarquía)

Estructura nueva:

1. **Título**: `fuerza venezuela` (mantener escala grande actual)
2. **Subtítulo**: `una nueva forma de ayudar.`
3. **Bloque de texto principal** (párrafos cortos, multilínea):
   ```
   aquí no solo donas.
   aquí puedes ver qué pasa con tu aporte.

   cuando donas, tu aporte se registra.
   cuando se confirma, entra al dinero disponible.
   cuando usamos el dinero, publicamos el monto, el gasto y el comprobante.
   cuando es posible, también mostramos contenido de la entrega o la acción realizada.
   ```
4. **Remate**: `no nos creas.` / `míralo.` (grande, dos líneas, acento rojo en "míralo.")
5. **CTAs**:
   - Principal: `donar ahora` (rojo sólido)
   - Secundario: `ver fondo en vivo` (outline, scroll a sección de balances)
6. **Mini-flujo horizontal** (debajo de los CTAs, ya existe — se mantiene en desktop):
   `DONAS → SE CONFIRMA → DISPONIBLE → GASTO CON COMPROBANTE → AYUDA VISIBLE`
   con caption: `ingresos visibles. gastos con soporte. saldo disponible.`

El resumen de dinero (cards de balance) permanece **después** del hero, igual que hoy. Añadir microestado `actualizado en vivo tras verificación` arriba de las cards de balance (sustituye el badge eliminado).

## 5. Responsive del bloque "cómo funciona"

- Desktop (`md:` y arriba): mantener el layout horizontal actual con flechas laterales.
- Mobile (<768px): reemplazar por timeline vertical:
  - 5 cards full-width apiladas en orden: donar → confirmar → disponible → gasto con comprobante → ayuda visible.
  - Cada card: ícono + título + descripción corta, mismo estilo dark/tech (borde `white/10`, glow sutil rojo).
  - Microetiqueta `paso 1` … `paso 5` arriba de cada card en `text-[10px] uppercase tracking-wider text-[#E3001B]/80`.
  - Conector vertical: línea de 1px `bg-white/10` con una flecha hacia abajo (`ChevronDown`) entre cards.
  - Spacing generoso (`gap-4` mobile).
- Implementación: dos bloques renderizados, uno `hidden md:flex` (desktop actual) y otro `md:hidden` (timeline vertical nuevo). No tocar el contenido textual del flujo.

## 6. Limpieza menor

- Mover/eliminar el badge `EN VIVO · TRANSPARENTE · VENEZUELA`.
- Asegurar que el header sticky no tape el ancla `#aportar` (offset con `scroll-mt-20`).
- Mantener footer existente con `fundacionbasico.com` y BASICO Box logo.

## Detalles técnicos

- Archivo único editado: `src/pages/FuerzaVenezuela.tsx`.
- Nuevo asset: `src/assets/logo-fondo-transparente.png.asset.json` (vía `lovable-assets create`).
- Sin cambios en `AporteDialog.tsx`, `canales.ts`, RPCs ni schema.
- Sin nuevos paquetes.
- Tokens existentes (`#E3001B`, zinc palette, glass cards) reutilizados — no se introducen colores nuevos.

## Fuera de alcance

- Lógica de aportes, confirmación, BCV, storage.
- Página privada `/admin/fondo-transparente`.
- Modales de donación (ya configurados en el turno anterior).
