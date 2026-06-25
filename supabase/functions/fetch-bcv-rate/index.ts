// Fetches official BCV USD rate from DolarApi Venezuela and stores it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SOURCE = "dolarapi_bcv";
const ENDPOINT = "https://ve.dolarapi.com/v1/dolares/oficial";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Identify caller (optional; cron call has no auth)
  let user_id: string | null = null;
  let user_email = "system";
  try {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await admin.auth.getUser(token);
      if (data.user) {
        user_id = data.user.id;
        user_email = data.user.email ?? "user";
      }
    }
  } catch (_) { /* ignore */ }

  try {
    const resp = await fetch(ENDPOINT, { headers: { accept: "application/json" } });
    if (!resp.ok) throw new Error(`Proveedor HTTP ${resp.status}`);
    const payload = await resp.json();

    const rate = Number(payload?.promedio);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Tasa inválida en respuesta del proveedor: ${payload?.promedio}`);
    }

    const providerUpdated = payload?.fechaActualizacion ? new Date(payload.fechaActualizacion).toISOString() : null;

    // Previous active rate for audit
    const { data: prev } = await admin
      .from("fondo_exchange_rates")
      .select("id, rate")
      .eq("source", SOURCE)
      .eq("is_active", true)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Deactivate previous
    await admin
      .from("fondo_exchange_rates")
      .update({ is_active: false })
      .eq("source", SOURCE)
      .eq("is_active", true);

    // Insert new active
    const { data: inserted, error: insErr } = await admin
      .from("fondo_exchange_rates")
      .insert({
        source: SOURCE,
        base_currency: "USD",
        quote_currency: "VES",
        rate,
        provider_updated_at: providerUpdated,
        raw_payload: payload,
        is_active: true,
        updated_by: user_id,
      })
      .select("id, rate, fetched_at, provider_updated_at, source")
      .single();
    if (insErr) throw insErr;

    // Sync visible "tasa del día" in fondo_configuracion (UI already reads these)
    await admin
      .from("fondo_configuracion")
      .update({
        tasa_ves_usd: rate,
        tasa_fecha: (providerUpdated ?? new Date().toISOString()).slice(0, 10),
        tasa_fuente: SOURCE,
        tasa_actualizada_at: new Date().toISOString(),
        tasa_actualizada_por: user_id,
      })
      .eq("id", true);

    // Audit log
    await admin.from("fondo_audit_log").insert({
      user_id,
      user_email,
      accion: "actualizar_tasa_bcv",
      tabla: "fondo_exchange_rates",
      record_id: inserted.id,
      valor_anterior: prev ? { id: prev.id, rate: prev.rate } : null,
      valor_nuevo: { id: inserted.id, rate: inserted.rate, source: SOURCE, provider_updated_at: providerUpdated, raw_payload: payload },
    });

    return new Response(
      JSON.stringify({ ok: true, rate: inserted.rate, source: SOURCE, fetched_at: inserted.fetched_at, provider_updated_at: providerUpdated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    console.error("fetch-bcv-rate error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
