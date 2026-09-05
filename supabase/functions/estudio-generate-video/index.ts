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
// La signed URL solo tiene que sobrevivir a que OpenRouter descargue el primer fotograma,
// pero se da margen porque la generación puede encolarse.
const SOURCE_URL_TTL_SECONDS = 60 * 60;

/**
 * Saca el motivo legible de un error de OpenRouter.
 *
 * El proveedor de video devuelve su propio error anidado como texto dentro del mensaje
 * ("HTTP 400: {\"error\": {\"message\": \"Invalid resolution: 480p\"}}"), así que volcar el
 * cuerpo tal cual le muestra al usuario un bloque de JSON escapado en vez del motivo.
 */
function readOpenRouterError(raw: string): string {
  let message = raw.trim();
  try {
    const outer = JSON.parse(raw);
    message = String(outer?.error?.message ?? outer?.message ?? message);
  } catch {
    return message.slice(0, 300);
  }

  const nested = message.match(/\{[\s\S]*\}/);
  if (nested) {
    try {
      const inner = JSON.parse(nested[0]);
      message = String(inner?.error?.message ?? inner?.message ?? message);
    } catch {
      // El mensaje no traía JSON anidado: se queda el de afuera.
    }
  }
  return message.trim().slice(0, 300);
}

/** Los parámetros que más rechazan los modelos: vale la pena decir qué hacer. */
function hintForError(message: string): string {
  if (/resolution/i.test(message)) {
    return ' Ese modelo no acepta esa resolución: elige "Automática" o prueba con 720p.';
  }
  if (/duration/i.test(message)) {
    return " Ese modelo no acepta esa duración: prueba con otra (muchos solo aceptan 4, 6 u 8 segundos).";
  }
  if (/aspect/i.test(message)) {
    return " Ese modelo no acepta ese formato: prueba con 16:9 o 9:16.";
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json(401, { error: "No autorizado" });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json(401, { error: "Sesión inválida" });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: allowed } = await admin.rpc("has_module_access", {
      _user_id: userData.user.id,
      _module: "/estudio-visual",
    });
    if (!allowed) return json(403, { error: "No tienes acceso a Basico Studio" });

    if (!OPENROUTER_API_KEY) {
      return json(500, { error: "OPENROUTER_API_KEY no configurada en las Edge Functions." });
    }

    const body = await req.json().catch(() => ({}));
    const sourceImagePath = body?.sourceImagePath as string | undefined;
    const motionPresetId = (body?.motionPresetId as string | undefined) ?? null;
    const promptOverride = body?.promptOverride as string | undefined;
    const durationSeconds = Number(body?.durationSeconds ?? 5);
    // Vacío o "auto" = no mandar el parámetro y dejar que el modelo elija. Es la única
    // opción que funciona con cualquier modelo: OpenRouter no publica qué resoluciones
    // acepta cada uno, así que no hay forma de validarlo por adelantado.
    const rawResolution = (body?.resolution as string | undefined)?.trim();
    const resolution = !rawResolution || rawResolution === "auto" ? null : rawResolution;
    const aspectRatio = (body?.aspectRatio as string | undefined) ?? "9:16";
    const videoModelOverride = body?.videoModel as string | undefined;

    if (!sourceImagePath) return json(400, { error: "sourceImagePath requerido" });
    if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 20) {
      return json(400, { error: "La duración debe ser un entero entre 1 y 20 segundos." });
    }

    // Resolver preset de movimiento (el indicado, o el default).
    let promptText = promptOverride ?? null;
    let videoModel = videoModelOverride ?? null;

    if (!promptText || !videoModel) {
      const query = motionPresetId
        ? admin.from("estudio_motion_presets").select("*").eq("id", motionPresetId).maybeSingle()
        : admin.from("estudio_motion_presets").select("*").eq("is_default", true).maybeSingle();
      const { data: preset } = await query;
      if (!preset && (!promptText || !videoModel)) {
        return json(400, { error: "No se encontró un preset de movimiento." });
      }
      promptText = promptText ?? preset!.prompt_text;
      videoModel = videoModel ?? preset!.video_model;
    }

    // Verificar que el modelo esté habilitado por el admin (control de costo).
    const { data: enabled } = await admin
      .from("estudio_enabled_models")
      .select("model_id")
      .eq("kind", "video")
      .eq("model_id", videoModel)
      .eq("is_enabled", true)
      .maybeSingle();
    if (!enabled) {
      return json(400, { error: `El modelo de video "${videoModel}" no está habilitado.` });
    }

    // OpenRouter descarga el primer fotograma por URL (no acepta base64 aquí). La signed URL
    // de Supabase es HTTPS pre-autenticada, así que el bucket privado no es obstáculo.
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(sourceImagePath, SOURCE_URL_TTL_SECONDS);
    if (signErr || !signed?.signedUrl) {
      return json(400, { error: "No se pudo preparar la imagen de origen." });
    }

    const { data: job, error: jobErr } = await admin
      .from("estudio_video_jobs")
      .insert({
        created_by: userData.user.id,
        source_image_path: sourceImagePath,
        motion_preset_id: motionPresetId,
        prompt_used: promptText,
        video_model: videoModel,
        duration_seconds: durationSeconds,
        resolution,
        aspect_ratio: aspectRatio,
        generate_audio: false,
        status: "pending",
      })
      .select()
      .single();
    if (jobErr || !job) return json(500, { error: "No se pudo crear el trabajo de video." });

    const aiRes = await fetch("https://openrouter.ai/api/v1/videos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: videoModel,
        prompt: promptText,
        frame_images: [
          {
            type: "image_url",
            image_url: { url: signed.signedUrl },
            frame_type: "first_frame",
          },
        ],
        duration: durationSeconds,
        // Solo se manda si el usuario eligió una explícita: mandar una que el modelo no
        // soporta es un 400 seguro (ej. Veo rechaza 480p).
        ...(resolution ? { resolution } : {}),
        aspect_ratio: aspectRatio,
        // Loops de producto: sin audio (además, generarlo encarece).
        generate_audio: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const failJob = async (message: string) => {
      await admin
        .from("estudio_video_jobs")
        .update({ status: "failed", error_message: message, updated_at: new Date().toISOString() })
        .eq("id", job.id);
    };

    if (aiRes.status === 429) {
      await failJob("Límite de OpenRouter alcanzado.");
      return json(200, { jobId: job.id, error: "Límite de OpenRouter alcanzado, intenta en unos minutos." });
    }
    if (aiRes.status === 402) {
      await failJob("Saldo insuficiente en OpenRouter.");
      return json(200, { jobId: job.id, error: "Saldo insuficiente en la cuenta de OpenRouter." });
    }
    if (!aiRes.ok) {
      const detail = readOpenRouterError(await aiRes.text().catch(() => ""));
      const message = `La generación de video fue rechazada (${aiRes.status}): ${detail}${hintForError(detail)}`;
      await failJob(message);
      // 200 con `error` para que supabase-js no enmascare el motivo real.
      return json(200, { jobId: job.id, error: message });
    }

    const submitted = await aiRes.json();
    const openrouterJobId = submitted?.id as string | undefined;
    if (!openrouterJobId) {
      await failJob("OpenRouter no devolvió un id de generación.");
      return json(200, { jobId: job.id, error: "OpenRouter no devolvió un id de generación." });
    }

    await admin
      .from("estudio_video_jobs")
      .update({
        openrouter_job_id: openrouterJobId,
        status: submitted?.status === "completed" ? "in_progress" : "in_progress",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return json(200, { jobId: job.id, openrouterJobId, status: "in_progress" });
  } catch (e) {
    return json(500, { error: (e as Error).message ?? "Error inesperado" });
  }
});
