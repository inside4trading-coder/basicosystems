import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const PIN_SALT = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // reuse as salt source

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin + ":sublime:" + PIN_SALT.slice(0, 16));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateTempPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims) return jsonResponse({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;
    const userEmail = (claimsData.claims.email as string) ?? null;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) return jsonResponse({ error: "Admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const { action, employee_id } = body as { action?: string; employee_id?: string };
    if (!action || !employee_id) return jsonResponse({ error: "Missing parameters" }, 400);

    const audit = async (a: string, metadata: Record<string, unknown> = {}) => {
      await admin.from("sublime_pin_audit").insert({
        employee_id,
        action: a,
        performed_by: userEmail ?? userId,
        metadata,
      });
    };

    if (action === "generate_temp") {
      const pin = generateTempPin();
      const hash = await hashPin(pin);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Ensure a row exists
      const { data: existing } = await admin
        .from("sublime_clock_settings")
        .select("employee_id")
        .eq("employee_id", employee_id)
        .maybeSingle();

      const patch = {
        employee_id,
        temp_pin_hash: hash,
        temp_pin_expires_at: expiresAt,
        pin_hash: null,
        pin_set_at: null,
        pin_status: "temp_generated",
        failed_attempts: 0,
        locked_until: null,
      };

      const { error } = existing
        ? await admin.from("sublime_clock_settings").update(patch).eq("employee_id", employee_id)
        : await admin.from("sublime_clock_settings").upsert(patch, { onConflict: "employee_id" });
      if (error) throw error;

      await audit("temp_generated", { expires_at: expiresAt });
      return jsonResponse({ pin, expires_at: expiresAt });
    }

    if (action === "reset") {
      const { error } = await admin
        .from("sublime_clock_settings")
        .update({
          pin_hash: null,
          pin_set_at: null,
          temp_pin_hash: null,
          temp_pin_expires_at: null,
          failed_attempts: 0,
          locked_until: null,
          pin_status: "requires_reset",
        })
        .eq("employee_id", employee_id);
      if (error) throw error;
      await audit("reset");
      return jsonResponse({ ok: true });
    }

    if (action === "block" || action === "unblock") {
      const blocked = action === "block";
      const { data: current } = await admin
        .from("sublime_clock_settings")
        .select("pin_hash, pin_status")
        .eq("employee_id", employee_id)
        .maybeSingle();
      const nextStatus = blocked
        ? "locked"
        : current?.pin_hash
        ? "active"
        : current?.pin_status === "temp_generated"
        ? "temp_generated"
        : "not_configured";
      const { error } = await admin
        .from("sublime_clock_settings")
        .update({ blocked, pin_status: nextStatus, locked_until: null, failed_attempts: 0 })
        .eq("employee_id", employee_id);
      if (error) throw error;
      await audit(blocked ? "blocked" : "unblocked");
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
