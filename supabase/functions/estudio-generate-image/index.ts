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

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
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
    const productName = (body?.productName as string | undefined) ?? null;
    const productPrice = (body?.productPrice as string | undefined) ?? null;

    if (!sourcePhotoPath) return json(400, { error: "sourcePhotoPath requerido" });
    if (!photoType || !PHOTO_TYPES.includes(photoType)) {
      return json(400, { error: `photoType debe ser uno de: ${PHOTO_TYPES.join(", ")}` });
    }

    // 3. Resolver preset (el indicado, o el default de ese photo_type)
    let presetId = promptPresetId ?? null;
    let promptText = promptOverride ?? null;
    let imageModel: string | null = null;

    if (!promptText) {
      const presetQuery = presetId
        ? admin.from("estudio_prompt_presets").select("*").eq("id", presetId).maybeSingle()
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
      presetId = preset.id;
      promptText = preset.prompt_text;
      imageModel = preset.image_model;
    }
    if (!imageModel) imageModel = "google/gemini-2.5-flash-image";

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
        product_name: productName,
        product_price: productPrice,
      })
      .select()
      .single();
    if (jobErr || !job) return json(500, { error: "No se pudo crear el registro de generación." });

    // 5. Descargar la foto original y convertirla a base64
    const { data: photoBlob, error: downloadErr } = await admin.storage
      .from(BUCKET)
      .download(sourcePhotoPath);
    if (downloadErr || !photoBlob) {
      await admin.from("estudio_image_jobs").update({
        status: "failed",
        error_message: "No se pudo leer la foto original del bucket.",
      }).eq("id", job.id);
      return json(400, { error: "No se pudo leer la foto original del bucket." });
    }
    const photoBase64 = `data:${photoBlob.type || "image/jpeg"};base64,${arrayBufferToBase64(await photoBlob.arrayBuffer())}`;

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
        input_references: [{ type: "image_url", image_url: { url: photoBase64 } }],
      }),
    });

    if (aiRes.status === 429) {
      await admin.from("estudio_image_jobs").update({
        status: "failed",
        error_message: "Límite de OpenRouter alcanzado.",
      }).eq("id", job.id);
      return json(429, { error: "Límite de OpenRouter alcanzado, intenta de nuevo en unos minutos." });
    }
    if (aiRes.status === 402) {
      await admin.from("estudio_image_jobs").update({
        status: "failed",
        error_message: "Saldo insuficiente en la cuenta de OpenRouter.",
      }).eq("id", job.id);
      return json(402, { error: "Saldo insuficiente en la cuenta de OpenRouter." });
    }
    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      await admin.from("estudio_image_jobs").update({
        status: "failed",
        error_message: `OpenRouter respondió ${aiRes.status}: ${errText.slice(0, 300)}`,
      }).eq("id", job.id);
      return json(502, { error: "La generación de imagen falló. Intenta de nuevo." });
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
      return json(502, { error: "OpenRouter no devolvió una imagen generada." });
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

    return json(200, { jobId: job.id, generatedImagePath: generatedPath, costUsd });
  } catch (e) {
    return json(500, { error: (e as Error).message ?? "Error inesperado" });
  }
});
