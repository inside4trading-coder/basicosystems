# Prompts BASICO STUDIO — reorganizar la configuración

Reorganiza solo la pantalla de configuración de `/estudio-visual` para que coincida con las 5 cards actuales. No se toca la generación real, la Edge Function, el storage, el historial ni los modelos disponibles.

## Cómo queda la configuración

Un solo diálogo llamado **Prompts BASICO STUDIO** ("Configura el prompt base de cada tipo de generación."), con estas secciones:

1. **Foto para catálogo** — textarea único de prompt base + Guardar. Sin selector de modelo.
2. **Fondo transparente** — textarea único de prompt base + Guardar. Sin selector de modelo.
3. **Prompts para fondos dinámicos** — el CRUD actual de fondos (nombre, portada, imagen de referencia, activo, orden) y, dentro de cada fondo, "Prompt por modelo para este fondo".
4. **Video corto** — en construcción (solo aviso).
5. **Mockup con modelo** — en construcción (solo aviso).

Los estilos antiguos ("Con modelo", "Con modelo — borrador", "Editorial urbano", "Flat lay", "Mockup lifestyle") dejan de mostrarse. No se borran de la base.

El botón "Fondos dinámicos" del asistente desaparece como entrada suelta: pasa a ser la sección 3 del mismo diálogo. "Modelos habilitados" y "Preset de marca BASICO" siguen igual, como accesos aparte.

## Dónde se elige el modelo

Solo en el asistente de generación, en el paso **Generar** (selector ya existente). La configuración ya no muestra ningún selector de modelo, salvo las pestañas por modelo dentro de cada fondo dinámico, que son configuración de prompt y se etiquetan como tal.

## Qué prompt se usa al generar

- Foto para catálogo → prompt base de "Foto para catálogo" + modelo elegido en el wizard.
- Fondo transparente → prompt base de "Fondo transparente" + modelo elegido.
- Fondo dinámico → prompt del fondo seleccionado para ese modelo.

Si falta el prompt, el botón Generar queda bloqueado con aviso (ya ocurre en dinámico; se extiende a catálogo y transparente). No se gastan créditos.

El resumen previo a generar muestra: Tipo, Fondo (solo si aplica), Modelo, Formato y Salida (individual/carrusel).

## Detalles técnicos

- `src/components/estudio/config/PromptTab.tsx`: se reescribe como editor de dos prompts base (catálogo y transparente), sin `Select` de modelo y sin listar los presets antiguos. Sigue usando `estudio_prompt_presets` (misma tabla, mismas columnas): el preset de catálogo es el actual "Fondo blanco — default"; para transparente se usa/crea una fila propia identificada por nombre fijo (`Fondo transparente`) en el mismo `photo_type`, creada al primer guardado desde el cliente. Sin migración ni cambios de esquema.
- `src/pages/EstudioVisual.tsx`: `presetForKind` deja de mandar `catalogo` y `transparente` al mismo preset y pasa a resolver por nombre; el sufijo de transparencia actual se mantiene. Sin cambios en el envío a la Edge Function.
- `src/components/estudio/config/BackgroundsTab.tsx`: solo copy — "Prompt por modelo para este fondo" y textos de configuración.
- `src/components/estudio/StudioWizard.tsx`: renombra el botón/diálogo a "Prompts BASICO STUDIO", integra fondos dinámicos como sección dentro de él y mantiene el selector de modelo del paso Generar.
- Verificación: typecheck y revisión visual del diálogo de configuración en el preview.
