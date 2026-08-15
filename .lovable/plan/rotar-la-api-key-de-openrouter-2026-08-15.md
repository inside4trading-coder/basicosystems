# Rotar la API key de OpenRouter

## Objetivo
Reemplazar el valor del secreto `OPENROUTER_API_KEY` (cuenta comprasbasicoclotheseuropa@gmail.com) sin tocar código.

## Qué se hará
1. Abrir el formulario seguro de secretos para que ingreses la nueva key de OpenRouter (`sk-or-v1-...`). El valor se guarda cifrado y nunca pasa por el chat.
2. Las Edge Functions que ya leen `Deno.env.get("OPENROUTER_API_KEY")` (`estudio-generate-image`, `estudio-generate-video`, `estudio-video-status`) toman el nuevo valor automáticamente al redeploy; se redespliegan para asegurar el rebinding.
3. Verificación: una generación de prueba en Basico Studio para confirmar que no aparece error 401 de OpenRouter.

## Nota de seguridad
La key que pegaste en el chat queda expuesta en el historial: conviene revocarla en OpenRouter y crear una nueva antes de guardarla.

## Fuera de alcance
No se cambia el modelo, los prompts, los presets ni la lógica de generación.
