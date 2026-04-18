
## Problema

En el módulo Llamadas, el enlace "🎧 Escuchar" actualmente es un `<a href={recording_url}>` que el navegador interpreta como descarga (porque Zadarma sirve el mp3 con headers de descarga). El usuario quiere reproducir el audio inline, sin descargar.

## Solución

Reemplazar el enlace por un **reproductor de audio inline** en cada fila con grabación.

### Cambios en `src/pages/Llamadas.tsx`

1. **Estado local** `playingId: string | null` para controlar qué llamada se está reproduciendo (solo una a la vez).
2. En la celda "Grabación", si `is_recorded && recording_url`:
   - Mostrar un botón ▶️ "Reproducir" (icono `Play` de lucide).
   - Al pulsarlo, expandir un `<audio controls src={recording_url} autoPlay />` compacto en la misma celda (o debajo de la fila).
   - Botón se convierte en ⏸ "Ocultar" para colapsar.
3. Mantener un enlace secundario opcional "Descargar" (icono `Download`) para quien quiera el archivo.

### Detalles UX

- Tamaño compacto: `<audio>` nativo HTML5 con `className="h-8"` para que no rompa la altura de la tabla.
- Solo un audio activo a la vez: al abrir uno nuevo, el anterior se cierra (control vía `playingId`).
- Si Zadarma devuelve el mp3 con `Content-Disposition: attachment`, el elemento `<audio>` lo reproduce igual porque el navegador respeta la URL como source de media, no como navegación.

### Archivos a tocar

- `src/pages/Llamadas.tsx` — celda "Grabación" + estado `playingId`.

Sin cambios en backend, edge functions ni BD.

## Resultado esperado

Al pulsar ▶️ en una llamada con grabación, aparece un reproductor inline que permite escuchar el audio directamente sin descargar. Opcionalmente queda un botón de descarga aparte.
