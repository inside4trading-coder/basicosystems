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

interface OpenRouterModel {
  id: string;
  name?: string;
  architecture?: { output_modalities?: string[] };
  pricing?: Record<string, string>;
}

// El catálogo de OpenRouter cambia poco; se cachea en memoria para no consultarlo en cada
// apertura de la pantalla de configuración.
const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: { at: number; image: OpenRouterModel[]; video: OpenRouterModel[] } | null = null;

async function fetchCatalog() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache;

  // Los modelos de imagen viven en su propio catálogo: `/v1/models` ya no los publica y
  // filtrarlo por `output_modalities` devolvía una lista vieja con ids inexistentes (404
  // al generar). `/v1/images/models` es la misma fuente que usa la función de generación.
  const [imageRes, videoRes] = await Promise.all([
    fetch("https://openrouter.ai/api/v1/images/models"),
    fetch("https://openrouter.ai/api/v1/models?output_modality=video"),
  ]);
  if (!imageRes.ok || !videoRes.ok) throw new Error("No se pudo leer el catálogo de OpenRouter.");

  const imageAll = (await imageRes.json())?.data as OpenRouterModel[] ?? [];
  const video = (await videoRes.json())?.data as OpenRouterModel[] ?? [];

  // Los routers automáticos no sirven para generación dirigida de producto.
  const image = imageAll.filter((m) => !m.id.startsWith("openrouter/auto"));

  cache = { at: Date.now(), image, video };
  return cache;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const catalog = await fetchCatalog();

    const shape = (m: OpenRouterModel) => ({
      id: m.id,
      name: m.name ?? m.id,
      // Precio por token de imagen; para video OpenRouter devuelve 0 (no es consultable
      // por adelantado), así que el cliente debe tratarlo como desconocido.
      imageOutputPrice: m.pricing?.image_output ? Number(m.pricing.image_output) : null,
    });

    return json(200, {
      image: catalog.image.map(shape),
      video: catalog.video.map(shape),
    });
  } catch (e) {
    return json(500, { error: (e as Error).message ?? "Error inesperado" });
  }
});
