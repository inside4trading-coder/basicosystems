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
// Tope de trabajos a reconciliar por llamada, para no exceder el tiempo de la función.
const MAX_RECONCILE = 5;

interface VideoJobRow {
  id: string;
  openrouter_job_id: string | null;
  status: string;
  video_storage_path: string | null;
}

/**
 * Consulta un trabajo en OpenRouter y, si terminó, descarga el video al bucket.
 * Devuelve la fila actualizada.
 */
async function syncJob(
  admin: ReturnType<typeof createClient>,
  apiKey: string,
  job: VideoJobRow,
) {
  if (!job.openrouter_job_id) return { id: job.id, status: job.status };

  const res = await fetch(`https://openrouter.ai/api/v1/videos/${job.openrouter_job_id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    // Un fallo transitorio de consulta no debe marcar el trabajo como fallido:
    // se reintenta en el siguiente poll.
    return { id: job.id, status: job.status, transientError: true };
  }

  const payload = await res.json();
  const status = payload?.status as string | undefined;

  if (status === "failed") {
    await admin
      .from("estudio_video_jobs")
      .update({
        status: "failed",
        error_message: payload?.error?.message ?? "La generación de video falló en OpenRouter.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return { id: job.id, status: "failed" };
  }

  if (status !== "completed") {
    return { id: job.id, status: "in_progress" };
  }

  // Completado: descargar y persistir. Si ya se persistió antes, no repetir.
  if (job.video_storage_path) {
    return { id: job.id, status: "completed", videoPath: job.video_storage_path };
  }

  const contentUrl =
    payload?.unsigned_urls?.[0] ??
    `https://openrouter.ai/api/v1/videos/${job.openrouter_job_id}/content?index=0`;

  const videoRes = await fetch(contentUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(120_000),
  });
  if (!videoRes.ok) {
    return { id: job.id, status: "in_progress", transientError: true };
  }

  const bytes = new Uint8Array(await videoRes.arrayBuffer());
  const videoPath = `${job.id}/motion.mp4`;
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(videoPath, bytes, { contentType: "video/mp4", upsert: true });

  if (uploadErr) {
    await admin
      .from("estudio_video_jobs")
      .update({
        status: "failed",
        error_message: "El video se generó pero no se pudo guardar.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return { id: job.id, status: "failed" };
  }

  await admin
    .from("estudio_video_jobs")
    .update({
      status: "completed",
      video_storage_path: videoPath,
      cost_usd: payload?.usage?.cost ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  return { id: job.id, status: "completed", videoPath, costUsd: payload?.usage?.cost ?? null };
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
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "manager");
    if (!allowed) return json(403, { error: "Solo administradores o managers" });

    if (!OPENROUTER_API_KEY) {
      return json(500, { error: "OPENROUTER_API_KEY no configurada en las Edge Functions." });
    }

    const body = await req.json().catch(() => ({}));
    const jobId = body?.jobId as string | undefined;

    // Sin jobId → modo reconciliación: recupera los trabajos que quedaron a medias porque
    // el navegador se cerró durante la generación.
    const query = jobId
      ? admin.from("estudio_video_jobs").select("id, openrouter_job_id, status, video_storage_path").eq("id", jobId)
      : admin
          .from("estudio_video_jobs")
          .select("id, openrouter_job_id, status, video_storage_path")
          .in("status", ["pending", "in_progress"])
          .not("openrouter_job_id", "is", null)
          .order("created_at", { ascending: true })
          .limit(MAX_RECONCILE);

    const { data: jobs, error: jobsErr } = await query;
    if (jobsErr) return json(500, { error: "No se pudieron leer los trabajos de video." });

    const results = [];
    for (const job of (jobs ?? []) as VideoJobRow[]) {
      results.push(await syncJob(admin, OPENROUTER_API_KEY, job));
    }

    return json(200, { results });
  } catch (e) {
    return json(500, { error: (e as Error).message ?? "Error inesperado" });
  }
});
