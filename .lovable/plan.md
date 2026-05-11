## Diagnóstico

La falla que se ve en el video (campos de "Nueva obligación" con texto raro como "Medios de comunicación" en Importancia y selects que no guardan el valor seleccionado) no es de permisos del rol manager. Es causada por la **traducción automática del navegador**:

- `index.html` declara `<html lang="en">`, pero todo el contenido está en español.
- Chrome/Edge detecta inconsistencia y traduce la página EN→ES en cuentas donde el auto‑translate está activo (lo que explica que "le pase al manager" y no al admin: depende del navegador del usuario, no del rol).
- "Media" (etiqueta de importancia) se traduce literalmente a **"Medios de comunicación"**.
- El traductor muta los nodos de texto del DOM, lo que rompe la sincronización de Radix Select → al hacer clic en un item, React no recibe bien el evento y el valor no se asigna; el campo queda en "Seleccionar".

## Cambios propuestos

1. **`index.html`**: cambiar `<html lang="en">` por `<html lang="es">` para que el navegador no proponga traducir.
2. Añadir `<meta name="google" content="notranslate" />` en `<head>` como salvaguarda adicional.
3. (Opcional, defensivo) Añadir el atributo `translate="no"` al `<body>` o al contenedor raíz `#root`, de modo que aunque el usuario fuerce traducción manualmente, los controles interactivos (Selects, Sheets) no se rompan.

Sin cambios de lógica de negocio, RLS, ni de roles. Solo metadatos del HTML.

## Validación

- Abrir la app en Edge/Chrome con un perfil que tenga "traducir páginas en inglés a español" activo.
- Antes del fix: aparece la barra de traducción y "Importancia" muestra "Medios de comunicación"; los selects no guardan el valor.
- Después del fix: el navegador ya no traduce, "Importancia" muestra "Media" y los selects funcionan normalmente.
