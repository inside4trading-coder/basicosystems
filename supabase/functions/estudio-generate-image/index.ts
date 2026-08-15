import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BUCKET = "estudio-visual";
const PHOTO_TYPES = ["fondo_blanco", "modelo", "mockup"] as const;
type PhotoType = (typeof PHOTO_TYPES)[number];

const VIEW_TYPES = ["frente", "espalda", "detalle", "tres_cuartos"] as const;
type ViewType = (typeof VIEW_TYPES)[number];

// Ningún modelo del catálogo de OpenRouter publica un parámetro `size`: publican
// `aspect_ratio` y, algunos, `resolution` ("1K"/"2K"/"4K"). Se acepta solo esta lista.
const ASPECT_RATIOS = ["4:5", "1:1", "9:16"] as const;

// Compatibilidad con presets/clientes viejos que todavía guardan el tamaño en píxeles.
const LEGACY_SIZE_TO_ASPECT: Record<string, string> = {
  "1080x1350": "4:5",
  "1080x1080": "1:1",
  "1080x1920": "9:16",
};


/**
 * Modificador que se concatena al prompt del preset según la vista pedida.
 *
 * Vive aquí y no en el cliente para que `prompt_used` guarde exactamente lo que se le
 * mandó al modelo: si una vista sale mal, el registro dice por qué.
 */
const VIEW_PROMPT: Record<ViewType, string> = {
  frente: "",
  espalda:
    "Genera la vista trasera de esta misma prenda, manteniendo exactamente el mismo estilo, fondo, encuadre e iluminación.",
  detalle:
    "Acércate al estampado o detalle principal de la prenda: primer plano nítido, mismo estilo, fondo e iluminación.",
  tres_cuartos:
    "Vista de tres cuartos de la prenda (girada aproximadamente 45 grados), manteniendo el mismo estilo, fondo e iluminación.",
};

/** Aviso extra cuando la vista se deduce del frente en vez de partir de su propia foto. */
const INFERRED_SUFFIX =
  "No inventes elementos de diseño que no puedas ver en la foto de referencia: si una zona no es visible, resuélvela de la forma más simple y neutra posible, coherente con el resto de la prenda.";

/**
 * Instrucción que se agrega cuando además de la prenda se manda la foto de una persona real.
 * Nombra las referencias por posición, así que depende del orden de `input_references`:
 * prenda primero, modelo después.
 */
const MODEL_REFERENCE_SUFFIX =
  "La primera imagen de referencia es la prenda; la segunda es la persona que debe lucirla. Reproduce a esa persona —rostro, tono de piel, tipo de cuerpo y cabello— sin alterarla, y vístela con la prenda respetando su corte, color, textura y todo detalle de diseño o texto.";

interface ImageModelCapabilities {
  maxInputReferences: number | null;
  supportsResolution: boolean;
}

// El catálogo cambia poco y se consulta en cada generación, así que se cachea en memoria.
const CAPS_TTL_MS = 10 * 60 * 1000;
let capsCache: { at: number; byId: Record<string, ImageModelCapabilities> } | null = null;

async function loadImageModelCapabilities(): Promise<Record<string, ImageModelCapabilities>> {
  if (capsCache && Date.now() - capsCache.at < CAPS_TTL_MS) return capsCache.byId;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/images/models");
    if (!res.ok) return capsCache?.byId ?? {};
    const models = (await res.json())?.data ?? [];
    const byId: Record<string, ImageModelCapabilities> = {};
    for (const m of models as any[]) {
      const params = m?.supported_parameters ?? {};
      const max = params?.input_references?.max;
      byId[m.id] = {
        maxInputReferences: typeof max === "number" ? max : null,
        supportsResolution: Object.prototype.hasOwnProperty.call(params, "resolution"),
      };
    }
    capsCache = { at: Date.now(), byId };
    return byId;
  } catch {
    return capsCache?.byId ?? {};
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function downloadAsBase64(
  admin: any,
  path: string,
): Promise<string | null> {
  const { data: blob, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !blob) return null;
  return `data:${blob.type || "image/jpeg"};base64,${arrayBufferToBase64(await blob.arrayBuffer())}`;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    // 1. Verificar JWT y rol (admin|manager) — mismo patrón que admin-manage-users
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json(401, { error: "No autorizado" });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json(401, { error: "Sesión inválida" });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isAllowed = (callerRoles ?? []).some(
      (r: any) => r.role === "admin" || r.role === "manager",
    );
    if (!isAllowed) return json(403, { error: "Solo administradores o managers" });

    if (!OPENROUTER_API_KEY) {
      return json(500, { error: "OPENROUTER_API_KEY no configurada en las Edge Functions." });
    }

    // 2. Body
    const body = await req.json().catch(() => ({}));
    const sourcePhotoPath = body?.sourcePhotoPath as string | undefined;
    const photoType = body?.photoType as PhotoType | undefined;
    const promptPresetId = body?.promptPresetId as string | undefined;
    const promptOverride = body?.promptOverride as string | undefined;
    const imageModelOverride = body?.imageModel as string | undefined;
    const outputSizeOverride = body?.outputSize as string | undefined;
    const sessionId = (body?.sessionId as string | undefined) ?? null;
    const viewType = (body?.viewType as ViewType | undefined) ?? "frente";
    const isInferred = Boolean(body?.isInferred);
    const modelPhotoPath = (body?.modelPhotoPath as string | undefined)?.trim() || null;
    const backgroundReferencePath = (body?.backgroundReferencePath as string | undefined)?.trim() || null;

    if (!sourcePhotoPath) return json(400, { error: "sourcePhotoPath requerido" });
    if (!photoType || !PHOTO_TYPES.includes(photoType)) {
      return json(400, { error: `photoType debe ser uno de: ${PHOTO_TYPES.join(", ")}` });
    }
    if (!VIEW_TYPES.includes(viewType)) {
      return json(400, { error: `viewType debe ser uno de: ${VIEW_TYPES.join(", ")}` });
    }
    const requestedAspect = outputSizeOverride?.trim()
      ? LEGACY_SIZE_TO_ASPECT[outputSizeOverride.trim()] ?? outputSizeOverride.trim()
      : "";
    if (requestedAspect && !ASPECT_RATIOS.includes(requestedAspect as typeof ASPECT_RATIOS[number])) {
      return json(400, { error: `La proporción debe ser una de: ${ASPECT_RATIOS.join(", ")}` });
    }


    // 3. Resolver preset. Se carga SIEMPRE (aunque venga un prompt propio) porque de él salen
    //    también el modelo y el tamaño de salida.
    const presetQuery = promptPresetId
      ? admin.from("estudio_prompt_presets").select("*").eq("id", promptPresetId).maybeSingle()
      : admin
          .from("estudio_prompt_presets")
          .select("*")
          .eq("photo_type", photoType)
          .eq("is_default", true)
          .maybeSingle();
    const { data: preset, error: presetErr } = await presetQuery;
    if (presetErr || !preset) {
      return json(400, { error: "No se encontró un preset de prompt para este tipo de fotografía." });
    }

    const presetId = preset.id;
    const usesModelReference = Boolean(modelPhotoPath);
    const basePrompt = promptOverride?.trim() || preset.prompt_text;
    const promptText = [
      basePrompt,
      VIEW_PROMPT[viewType],
      isInferred ? INFERRED_SUFFIX : "",
      usesModelReference ? MODEL_REFERENCE_SUFFIX : "",
    ]
      .filter(Boolean)
      .join(" ");
    // Proporción explícita: es lo que convierte al módulo en "estandarizado" de verdad.
    // El preset define el default; la pantalla puede ajustarlo por corrida.
    const presetAspectRaw = (preset.output_size as string | undefined) ?? "";
    const presetAspect = LEGACY_SIZE_TO_ASPECT[presetAspectRaw] ?? presetAspectRaw;
    const aspectRatio =
      requestedAspect ||
      (ASPECT_RATIOS.includes(presetAspect as typeof ASPECT_RATIOS[number]) ? presetAspect : "4:5");

    const imageModel = imageModelOverride?.trim() || preset.image_model || "google/gemini-2.5-flash-image";

    // El modelo debe estar habilitado por el admin (control de costo). Si el catálogo aún no
    // está poblado, no se bloquea la generación.
    const { data: enabledModels } = await admin
      .from("estudio_enabled_models")
      .select("model_id")
      .eq("kind", "image")
      .eq("is_enabled", true);
    const allowList = (enabledModels ?? []).map((m: { model_id: string }) => m.model_id);
    if (allowList.length > 0 && !allowList.includes(imageModel)) {
      return json(200, { error: `El modelo "${imageModel}" no está habilitado.` });
    }

    // Capacidades publicadas por OpenRouter para este modelo: cuántas referencias admite y
    // si acepta `resolution`. Se valida antes de gastar la llamada.
    const caps = (await loadImageModelCapabilities())[imageModel];
    if (usesModelReference && caps?.maxInputReferences != null && caps.maxInputReferences < 2) {
      return json(200, {
        error: `El modelo "${imageModel}" solo acepta ${caps.maxInputReferences} imagen de referencia, así que no puede combinar prenda y modelo. Elige otro modelo o quita la foto del modelo.`,
      });
    }

    // 4. Crear el job (status: processing)
    const { data: job, error: jobErr } = await admin
      .from("estudio_image_jobs")
      .insert({
        created_by: userData.user.id,
        status: "processing",
        source_photo_path: sourcePhotoPath,
        photo_type: photoType,
        prompt_preset_id: presetId,
        prompt_used: promptText,
        image_model: imageModel,
        output_size: aspectRatio,
        session_id: sessionId,
        view_type: viewType,
        is_inferred: isInferred,
        model_photo_path: modelPhotoPath,
        uses_model_reference: usesModelReference,
      })
      .select()
      .single();
    if (jobErr || !job) return json(500, { error: "No se pudo crear el registro de generación." });

    // 5. Descargar la foto original (y la del modelo, si la hay) y convertirlas a base64
    const photoBase64 = await downloadAsBase64(admin, sourcePhotoPath);
    if (!photoBase64) {
      await admin.from("estudio_image_jobs").update({
        status: "failed",
        error_message: "No se pudo leer la foto original del bucket.",
      }).eq("id", job.id);
      return json(400, { error: "No se pudo leer la foto original del bucket." });
    }

    let modelPhotoBase64: string | null = null;
    if (modelPhotoPath) {
      modelPhotoBase64 = await downloadAsBase64(admin, modelPhotoPath);
      if (!modelPhotoBase64) {
        await admin.from("estudio_image_jobs").update({
          status: "failed",
          error_message: "No se pudo leer la foto del modelo del bucket.",
        }).eq("id", job.id);
        return json(200, { error: "No se pudo leer la foto del modelo del bucket." });
      }
    }

    // Referencia del fondo dinámico elegido: si falla, no se inventa otro fondo.
    let backgroundBase64: string | null = null;
    if (backgroundReferencePath) {
      backgroundBase64 = await downloadAsBase64(admin, backgroundReferencePath);
      if (!backgroundBase64) {
        await admin.from("estudio_image_jobs").update({
          status: "failed",
          error_message: "No se pudo leer la imagen de referencia del fondo.",
        }).eq("id", job.id);
        return json(200, { error: "No se pudo leer la imagen de referencia del fondo." });
      }
    }

    // 6. Llamar a OpenRouter (endpoint dedicado de imágenes)
    const aiRes = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: imageModel,
        prompt: promptText,
        // El orden importa: el prompt nombra las referencias por posición.
        input_references: [
          { type: "image_url", image_url: { url: photoBase64 } },
          ...(modelPhotoBase64 ? [{ type: "image_url", image_url: { url: modelPhotoBase64 } }] : []),
          ...(backgroundBase64 ? [{ type: "image_url", image_url: { url: backgroundBase64 } }] : []),
        ],
        // Ningún modelo publica `size`; la proporción se pide con `aspect_ratio`, y solo se
        // manda `resolution` en los modelos que la publican.
        aspect_ratio: aspectRatio,
        ...(caps?.supportsResolution ? { resolution: "2K" } : {}),
        output_format: "png",
      }),
      signal: AbortSignal.timeout(180_000),
    });


    if (aiRes.status === 429) {
      await admin.from("estudio_image_jobs").update({
        status: "failed",
        error_message: "Límite de OpenRouter alcanzado.",
      }).eq("id", job.id);
      return json(200, { error: "Límite de OpenRouter alcanzado, intenta de nuevo en unos minutos." });
    }
    if (aiRes.status === 402) {
      await admin.from("estudio_image_jobs").update({
        status: "failed",
        error_message: "Saldo insuficiente en la cuenta de OpenRouter.",
      }).eq("id", job.id);
      return json(200, { error: "Saldo insuficiente en la cuenta de OpenRouter." });
    }
    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      await admin.from("estudio_image_jobs").update({
        status: "failed",
        error_message: `OpenRouter respondió ${aiRes.status}: ${errText.slice(0, 300)}`,
      }).eq("id", job.id);
      return json(200, { error: `La generación falló (OpenRouter respondió ${aiRes.status}).` });
    }

    const aiData = await aiRes.json();
    const generatedB64 = aiData?.data?.[0]?.b64_json as string | undefined;
    const mediaType = (aiData?.data?.[0]?.media_type as string | undefined) ?? "image/png";
    const costUsd = (aiData?.usage?.cost as number | undefined) ?? null;

    if (!generatedB64) {
      await admin.from("estudio_image_jobs").update({
        status: "failed",
        error_message: "OpenRouter no devolvió una imagen generada.",
      }).eq("id", job.id);
      return json(200, { error: "OpenRouter no devolvió una imagen generada." });
    }

    // 7. Subir la imagen generada al bucket
    const ext = mediaType.includes("png") ? "png" : mediaType.includes("webp") ? "webp" : "jpg";
    const generatedPath = `${job.id}/generado.${ext}`;
    const bytes = Uint8Array.from(atob(generatedB64), (c) => c.charCodeAt(0));
    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(generatedPath, bytes, { contentType: mediaType, upsert: true });
    if (uploadErr) {
      await admin.from("estudio_image_jobs").update({
        status: "failed",
        error_message: "No se pudo guardar la imagen generada.",
      }).eq("id", job.id);
      return json(500, { error: "No se pudo guardar la imagen generada." });
    }

    // 8. Marcar el job como completado
    await admin
      .from("estudio_image_jobs")
      .update({ status: "completed", generated_image_path: generatedPath, cost_usd: costUsd })
      .eq("id", job.id);

    return json(200, {
      jobId: job.id,
      generatedImagePath: generatedPath,
      costUsd,
      viewType,
      isInferred,
      usesModelReference,
    });

  } catch (e) {
    return json(500, { error: (e as Error).message ?? "Error inesperado" });
  }
});
