
The user is on step 2 (Audiencia) of the campaign wizard and can't proceed with "Sincronizar y avanzar". They have 1 manual contact selected but "0 contactos coinciden" from segment conditions.

Let me investigate the wizard logic.
<lov-tool-use id="toolu_vrtx_01A2STVC85or7HVKgMVmKa6p" name="code--search_files" integration-id="code" data="{\"query\": \"SINCRONIZAR Y AVANZAR|Sincronizar y avanzar\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01XEGsVqJ4sbH7ag4ynF6aRe" name="code--search_files" integration-id="code" data="{\"query\": \"SINCRONIZAR Y AVANZAR|Sincronizar y avanzar|sincronizar\", \"case_sensitive\": false}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01P3GWZYfk6buf8qBxCT1edm" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/CampaignWizard.tsx\", \"lines\": \"1-200\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01T1d3B3YByE5TxDH1ktUswo" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/CampaignWizard.tsx\", \"lines\": \"460-498\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01UA7hQxiCaanyAaFDUrgMDC" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/CampaignWizard.tsx\", \"lines\": \"200-260\"}">
</lov-tool-use>
Let me check SegmentBuilder to see how `contactCount` gets set — issue: `contactCount` is null, so `canAdvance` returns false at step 1. The image shows "0 contactos coinciden" but "1 seleccionados". Need to know if selected count updates contactCount.
<lov-tool-use id="toolu_vrtx_01VKEnEXhBfP65mUFJYssMjn" name="code--search_files" integration-id="code" data="{\"query\": \"onCountChange|onSelectedChange|setContactCount|onCount\", \"include_patterns\": \"src/**/*.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01K5V37YxX9ye24kfddq2qTE" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/CampaignWizard.tsx\", \"lines\": \"290-330\"}">
</lov-tool-use>
Found it. The screenshot shows "0 contactos coinciden" but "1 seleccionados" (manually-added email). `contactCount` reflects "matched" count (0), not selected (1). So `canAdvance()` returns false → button disabled. Also, even if user can click it, `syncContacts` checks `selectedContacts` which would work but the button is gated by canAdvance using contactCount.

<lov-plan>
## Problema

En el paso "Audiencia", el botón **"Sincronizar y avanzar"** se deshabilita porque `canAdvance()` exige `contactCount > 0`, pero `contactCount` solo refleja los contactos que **coinciden con las condiciones** del segmento (0 en tu caso). Los emails añadidos **manualmente** (`selectedContacts`, en tu caso 1: eduardojg1994@gmail.com) no cuentan.

Resultado: tienes 1 contacto seleccionado válido para enviar, pero el wizard te bloquea.

## Solución

Cambiar la lógica de avance del paso 2 para que considere **el total real seleccionado**, que es la suma efectiva de:
- contactos del segmento que están marcados, o
- emails añadidos manualmente.

### Cambios en `src/pages/CampaignWizard.tsx`

1. **`canAdvance()` (paso 1)**: en lugar de comprobar `contactCount > 0`, comprobar `selectedContacts.length > 0`. Así el botón se habilita en cuanto haya al menos un destinatario (manual o del segmento).

2. **Botón "Sincronizar contactos con Brevo"** (línea 312): mostrarlo cuando `selectedContacts.length > 0 && !listId` (no solo cuando hay match del segmento).

3. **Resumen del paso 4** (línea 466): mostrar `selectedContacts.length` como número de contactos si `contactCount` es 0/null.

4. **Etiqueta del botón** (línea 487): mantener "Sincronizar y avanzar" cuando `!listId`, lo cual seguirá disparando `syncContacts()` con los `selectedContacts` correctamente (esa función ya usa `selectedContacts`, no `contactCount`).

No se requieren cambios en edge functions ni en BD. Es un fix de 4 líneas en el wizard.

## Resultado esperado

- Añades manualmente un email → contador "1 seleccionados" → botón **"Sincronizar y avanzar"** se activa → al pulsarlo, llama a `brevo-sync-contacts`, crea la lista en Brevo y pasa al paso 3 (Contenido).
