

# Web Phone como widget flotante

## Situación actual
El teléfono web ocupa una Card completa en la parte superior de la página Llamadas, consumiendo espacio valioso del dashboard de analítica.

## Propuesta
Convertir el Web Phone en un **widget flotante fijo** en la esquina inferior derecha de la pantalla, similar a un botón de chat/WhatsApp. Estará disponible en **todas las páginas** del sistema (no solo en Llamadas).

```text
┌─────────────────────────────────────┐
│  AppLayout                          │
│  ┌──────────────────────────────┐   │
│  │  <Outlet /> (cualquier pág)  │   │
│  │                              │   │
│  │                              │   │
│  │                              │   │
│  │                         ┌────┤   │
│  │                         │ 📞 │   │  ← botón circular (colapsado)
│  │                         └────┤   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘

Al hacer click se expande:
┌─────────────────────────────────────┐
│                              ┌─────┐│
│                              │Phone││
│                              │widget│
│                              │420px ││
│                              │     ││
│                              └─────┘│
└─────────────────────────────────────┘
```

## Cambios

### 1. Refactorizar `ZadarmaWebPhone.tsx`
- Eliminar la Card wrapper — el componente será el contenido del popover/panel flotante.
- Agregar estado `collapsed` (botón FAB) vs `expanded` (panel con el widget).
- Posición: `fixed bottom-4 right-4 z-50`.
- El botón FAB muestra un ícono de teléfono con badge de estado (punto verde = conectado, amarillo = cargando, rojo = error).
- Al expandir: panel de ~320×460px con bordes redondeados, sombra, y el widget Zadarma dentro.
- Botón para minimizar/cerrar el panel.

### 2. Mover el componente de `Llamadas.tsx` a `AppLayout.tsx`
- Eliminar `<ZadarmaWebPhone />` de la página Llamadas.
- Renderizarlo en `AppLayout.tsx` después del `<main>`, para que esté disponible globalmente.
- La página Llamadas queda exclusivamente para analítica (KPIs, gráficos, tabla).

### 3. Archivos modificados
| Archivo | Cambio |
|---|---|
| `src/components/llamadas/ZadarmaWebPhone.tsx` | Refactorizar a widget flotante con toggle expand/collapse |
| `src/components/AppLayout.tsx` | Agregar `<ZadarmaWebPhone />` como widget global |
| `src/pages/Llamadas.tsx` | Eliminar import y uso de `ZadarmaWebPhone` |

