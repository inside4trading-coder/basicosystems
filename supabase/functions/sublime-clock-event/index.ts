import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PIN_SALT = SERVICE_ROLE_KEY;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const EARTH_RADIUS_M = 6_371_000;
function distanceMeters(
  lat1: number, lon1: number, lat2: number, lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(PIN_SALT),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyToken(token: string): Promise<{ employeeId: string } | null> {
  try {
    const decoded = atob(token);
    const parts = decoded.split("|");
    if (parts.length !== 4) return null;
    const [employeeId, kind, expStr, sig] = parts;
    if (kind !== "active") return null;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return null;
    const expected = await hmac(`${employeeId}|${kind}|${expStr}`);
    if (expected !== sig) return null;
    return { employeeId };
  } catch {
    return null;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const VALID_TYPES = new Set([
  "entrada", "salida", "inicio_descanso", "fin_descanso",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      session_token,
      event_type,
      latitude,
      longitude,
      accuracy,
      device_user_agent,
      observations,
      force_review,
    } = body as {
      session_token?: string;
      event_type?: string;
      latitude?: number | null;
      longitude?: number | null;
      accuracy?: number | null;
      device_user_agent?: string | null;
      observations?: string | null;
      force_review?: boolean;
    };

    if (!session_token) return jsonResponse({ ok: false, error: "Sesión inválida" }, 401);
    const sess = await verifyToken(session_token);
    if (!sess) return jsonResponse({ ok: false, error: "Sesión expirada. Vuelve a introducir tu PIN." }, 401);

    if (!event_type || !VALID_TYPES.has(event_type)) {
      return jsonResponse({ ok: false, error: "Acción no válida" }, 400);
    }

    const { data: settings } = await admin
      .from("sublime_clock_settings")
      .select("*")
      .eq("employee_id", sess.employeeId)
      .maybeSingle();

    if (!settings) return jsonResponse({ ok: false, error: "Configuración no encontrada" }, 404);
    if (settings.blocked) return jsonResponse({ ok: false, error: "Fichaje bloqueado" }, 403);
    if (!settings.enabled) return jsonResponse({ ok: false, error: "Fichaje no habilitado" }, 403);
    if (!settings.store_id) return jsonResponse({ ok: false, error: "Sin tienda asignada" }, 400);

    const { data: store } = await admin
      .from("sublime_stores")
      .select("*")
      .eq("id", settings.store_id)
      .maybeSingle();

    if (!store) return jsonResponse({ ok: false, error: "Tienda no encontrada" }, 404);

    const hasCoords = typeof latitude === "number" && typeof longitude === "number"
      && Number.isFinite(latitude) && Number.isFinite(longitude);

    let distance: number | null = null;
    let location_state = "ubicacion_no_disponible";
    let clock_state: "valido" | "pendiente_revision" = "valido";

    if (hasCoords && store.latitude != null && store.longitude != null) {
      distance = Math.round(distanceMeters(
        Number(store.latitude), Number(store.longitude),
        latitude!, longitude!,
      ));
      const radius = Number(store.radius_meters ?? 75);
      if (distance <= radius) {
        location_state = "dentro_del_radio";
        if (typeof accuracy === "number" && accuracy > 100) {
          location_state = "ubicacion_imprecisa";
        }
      } else {
        location_state = "fuera_del_radio";
        clock_state = "pendiente_revision";
      }
    } else {
      // No coords → require review
      clock_state = "pendiente_revision";
    }

    if (force_review) {
      clock_state = "pendiente_revision";
    }

    // Punctuality
    let punctuality_state: string | null = null;
    if (event_type === "entrada" && settings.entry_time) {
      const now = new Date();
      const [hh, mm] = String(settings.entry_time).split(":").map(Number);
      const scheduled = new Date(now);
      scheduled.setHours(hh ?? 0, mm ?? 0, 0, 0);
      const diffMin = (now.getTime() - scheduled.getTime()) / 60000;
      const tol = settings.late_tolerance_minutes ?? 0;
      if (diffMin <= 0) punctuality_state = "a_tiempo";
      else if (diffMin <= tol) punctuality_state = "dentro_tolerancia";
      else punctuality_state = "tarde";
    }

    const nowIso = new Date().toISOString();
    const eventDate = new Date().toISOString().slice(0, 10);

    const { data: inserted, error } = await admin
      .from("sublime_clock_events")
      .insert({
        employee_id: sess.employeeId,
        store_id: settings.store_id,
        event_type,
        event_at: nowIso,
        event_date: eventDate,
        source: "pin",
        latitude: hasCoords ? latitude : null,
        longitude: hasCoords ? longitude : null,
        distance_meters: distance,
        allowed_radius_meters: store.radius_meters,
        location_state,
        clock_state,
        punctuality_state,
        device_user_agent: device_user_agent ?? null,
        is_automatic: true,
        observations: observations ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse({
      ok: true,
      event: inserted,
      distance,
      radius: store.radius_meters,
      location_state,
      clock_state,
      punctuality_state,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
