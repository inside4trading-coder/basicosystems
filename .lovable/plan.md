# Diagnóstico: "La generación falló (OpenRouter respondió 404)"

## Causa confirmada

El error no es del prompt ni de la imagen. Es el **id del modelo**.

Los dos últimos jobs fallidos guardaron este mensaje literal de OpenRouter:

```text
404 — No model found for "bytedance-seed/seedream-5.0-lite"
```

El id correcto en el catálogo de imágenes de OpenRouter es `bytedance-seed/seedream-5-0-lite` (con guiones, no puntos). Lo mismo pasa con `bytedance-seed/seedream-5.0-pro` → real: `bytedance-seed/seedream-5-0-pro`.

## Por qué se está usando ese modelo

En el catálogo de modelos habilitados del Studio hoy hay exactamente 8 filas de imagen, y **los únicos habilitados son los tres de ByteDance**:

| Modelo | Habilitado | Existe en OpenRouter |
| --- | --- | --- |
| bytedance-seed/seedream-4.5 | sí | sí |
| bytedance-seed/seedream-5.0-lite | sí | **no** (es `-5-0-lite`) |
| bytedance-seed/seedream-5.0-pro | sí | **no** (es `-5-0-pro`) |
| google/gemini-2.5-flash-image | no | sí |
| google/gemini-3-pro-image | no | sí |
| google/gemini-3.1-flash-image | no | sí |
| openai/gpt-5-image | no | sí |
| openai/gpt-5-image-mini | no | sí |

Como Gemini y GPT están deshabilitados, el selector empuja al usuario a un modelo con id inválido y toda generación termina en 404.

## Causa de fondo (por qué se colaron ids malos)

La función que alimenta el catálogo (`estudio-list-models`) consulta `https://openrouter.ai/api/v1/models`. Ese endpoint **ya no devuelve modelos de imagen**: verificado ahora, no contiene ningún `seedream-5`. El catálogo de imágenes vive en `https://openrouter.ai/api/v1/images/models` (el mismo que la función de generación ya usa para leer capacidades). Por eso el listado de modelos de imagen quedó desactualizado y con ids escritos a mano.

## Corrección propuesta

1. **Arreglo inmediato (datos, sin código)**: corregir los dos ids en el catálogo habilitado (`5.0` → `5-0`) y volver a habilitar los modelos Gemini/GPT que sí funcionan, para que el selector del asistente vuelva a tener opciones válidas.
2. **Arreglo de raíz (una función)**: en `estudio-list-models`, leer los modelos de imagen desde `/v1/images/models` en vez de `/v1/models`, de modo que el catálogo que se ofrece en Configuración siempre traiga ids reales.
3. **Mensaje de error más claro**: cuando OpenRouter responde 404 por modelo inexistente, mostrar "El modelo X ya no existe en OpenRouter" en vez del genérico 404.

## Fuera de alcance

No se toca el pipeline de composición Fase 0/1, ni prompts, ni fondos, ni el resto de módulos.
