# Próximos pasos para activar fundacionbasico.com

No requiere cambios de código. Es trabajo de configuración en BanaHosting + Lovable.

## 1. Completar registros DNS en BanaHosting

Ya tienes 3 registros. Faltan ajustes y 1 registro nuevo. Tu pantalla debe quedar así:

| Host Name | Record Type | Address |
|-----------|-------------|---------|
| `@` | A (Address) | `185.158.133.1` |
| `www` | A (Address) | `185.158.133.1` |
| `_lovable` | TXT (SPF/txt) | `lovable_verify=1d139af1b85e6851a6954f403dbac292de118001a53daef1bfd89a5034d0333b` |
| `_lovable.www` | TXT (SPF/txt) | `lovable_verify=1ae57cf85144948193f64252b94013ba4b4d283c96da8852f1b3f0d7410b8417` |

Acciones concretas:
- **Verificar el TXT `_lovable`**: en tu captura el campo Address se ve cortado (`...292de118(`). Abre ese registro y confirma que contiene el valor COMPLETO que muestra Lovable (termina en `...a53daef1bfd89a5034d0333b`). Si está cortado, bórralo y vuelve a pegarlo entero.
- **Agregar el cuarto registro** `_lovable.www` tipo TXT con el segundo `lovable_verify=...` que muestra Lovable para `www.fundacionbasico.com`.
- Pulsar **Save Changes**.
- No tocar MX, SPF reales, DKIM, DMARC ni nameservers.

## 2. Esperar verificación en Lovable

- Volver a Lovable → Project Settings → Domains.
- Pulsar **Check status** en cada dominio cada 10–15 min.
- Propagación normal: 15 min – 2 h. Máximo 72 h.
- Cuando ambos pasen a **Active**, Lovable emite SSL automático.
- Marcar `fundacionbasico.com` como **Primary** (menú ⋯ → Set as primary). Así `www` redirige al dominio sin www.

## 3. Publicar el proyecto

El switch de hostname (que ya dejé en `src/App.tsx`) solo viaja al dominio cuando el proyecto está publicado/actualizado.
- Cuando me confirmes que los dominios están **Active** en Lovable, ejecuto el publish desde aquí.
- Resultado final:
  - `fundacionbasico.com` → landing pública Fuerza Venezuela.
  - `www.fundacionbasico.com` → redirige a `fundacionbasico.com`.
  - `/fuerza-venezuela` en ese dominio → redirige a `/`.
  - El HUB privado sigue solo en `basicosystems.lovable.app` y la URL de preview.

## 4. Verificación final (cuando publique)

- Abrir `https://fundacionbasico.com` en incógnito → debe cargar Fuerza Venezuela.
- Abrir `https://www.fundacionbasico.com` → debe redirigir.
- Abrir `https://basicosystems.lovable.app` → debe seguir mostrando el HUB normal (login).

---

**Lo que necesito de ti ahora:** confirma cuando hayas (a) corregido/completado el TXT `_lovable`, (b) agregado el TXT `_lovable.www`, y (c) los dos dominios aparezcan **Active** en Lovable. Ahí publico.
