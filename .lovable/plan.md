
# Cómo aportar → modal con formulario y comprobante

Activamos el botón "usar este método" de cada canal en `/fuerza-venezuela` para que abra un **modal en la misma página** (mejor conversión, mantiene el contexto del fondo). Arrancamos con Pago Móvil completo; Zelle y Binance quedan listos en estructura para llenar sus datos en un paso siguiente. Quitamos "efectivo sublime" del listado de canales activos según indicación.

## Flujo del usuario

1. Click en "usar este método" en la tarjeta del canal.
2. Se abre un modal con dos zonas:
   - **Datos del canal** (a quién pagar). Para Pago Móvil: `04245957541 · Banco de Venezuela · V-26.007.816` con botones de copiar.
   - **Formulario de registro del aporte**.
3. El usuario completa, adjunta comprobante (obligatorio), envía.
4. El aporte queda como `por_verificar`. Mostramos pantalla de "¡gracias! revisaremos tu aporte y aparecerá publicado en breve" con un enlace para ver la tabla pública.

## Formulario (campos)

- nombre (texto, requerido) — se publica como `donante_publico` salvo que marque "aportar como anónimo".
- correo (email, requerido, privado, solo interno)
- teléfono (texto, requerido, privado, solo interno)
- fecha de pago (date, requerido)
- monto (numérico, requerido) — en Bs para pago móvil, en USD para Zelle, en USDT para Binance
- referencia (texto, requerido) — número de operación / hash / referencia bancaria
- comprobante de pago (file, **obligatorio**) — imagen o PDF, máx 5 MB
- checkbox opcional "publicar como anónimo"

Validación cliente con zod (longitudes, formato email, file size/mime) y revalidación en el RPC.

## Comportamiento por canal

- **Pago Móvil** → activo, formulario completo + datos arriba.
- **Zelle** → modal abre, datos del canal en placeholder ("próximamente, contáctanos") hasta que pases los datos definitivos. El formulario funciona igual.
- **Binance** → idem Zelle.
- **Efectivo Sublime** → se elimina de las tarjetas públicas.

## Tras enviar

- Insert en `fondo_aportes` con `estado='por_verificar'`, `fecha_reportada = fecha_pago`, datos privados (email, teléfono, nombre completo) en columnas existentes.
- Subida del comprobante a bucket privado, ruta guardada en el aporte para que admin lo revise en `FondoTransparente.tsx`.
- Aparece en la tabla pública en la fila "por verificar" (ya soportado por el RPC público actual) y en el dashboard privado para confirmación manual.

## Detalles técnicos

**Backend**

- Bucket privado nuevo `fondo-comprobantes` con políticas en `storage.objects`:
  - `INSERT` permitido a `anon` y `authenticated` sólo bajo el prefijo `aportes/`.
  - `SELECT` solo para `admin` y `manager` (vía `has_role`).
- Campos nuevos en `fondo_aportes` si faltan: `donante_email`, `donante_telefono`, `comprobante_path` (revisar antes de migrar; reutilizamos los existentes si ya están).
- RPC `public.fondo_registrar_aporte_publico(p_metodo, p_nombre, p_email, p_telefono, p_fecha_pago, p_monto, p_moneda, p_referencia, p_comprobante_path, p_es_anonimo)` con `SECURITY DEFINER`, `GRANT EXECUTE TO anon, authenticated`. Valida tipos, longitudes, monto > 0, método permitido, inserta con `estado='por_verificar'` y devuelve `{ok, id}`. No expone los campos privados a la vista pública (siguen filtrados por `fondo_public_aportes_list`).
- Rate-limit blando: rechaza si ya existe un aporte con misma `referencia + metodo` en las últimas 24h.

**Frontend**

- Nuevo componente `src/components/fondo/AporteDialog.tsx` (Dialog shadcn): recibe `metodo`, renderiza datos del canal + formulario con `react-hook-form` + `zod`. Sube el archivo a Storage con el cliente anon (`supabase.storage.from('fondo-comprobantes').upload(...)`) y luego llama al RPC.
- Mapa de datos por método en `src/components/fondo/canales.ts` (pago móvil completo; zelle/binance con `pendiente=true`).
- En `src/pages/FuerzaVenezuela.tsx`: el botón "usar este método" abre el dialog del canal correspondiente; remover la tarjeta de "efectivo sublime".
- Estado de éxito dentro del modal (no navega), con CTA "ver tabla en vivo" que hace scroll a la sección de aportes.

## Fuera de alcance (siguiente iteración)

- Datos reales de Zelle y Binance (los pasas y los cargo).
- Notificación por email al donante.
- Aparición instantánea en la tabla pública sin pasar por "por verificar".
