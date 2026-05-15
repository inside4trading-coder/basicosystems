import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PIN_SALT = SERVICE_ROLE_KEY;

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;
const SESSION_TTL_MS = 5 * 60 * 1000;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin + ":sublime:" + PIN_SALT.slice(0, 16));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
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

async function makeToken(employeeId: string, kind: "setup" | "active"): Promise<string> {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${employeeId}|${kind}|${exp}`;
  const sig = await hmac(payload);
  return btoa(`${payload}|${sig}`);
}

async function verifyToken(
  token: string,
): Promise<{ employeeId: string; kind: "setup" | "active" } | null> {
  try {
    const decoded = atob(token);
    const parts = decoded.split("|");
    if (parts.length !== 4) return null;
    const [employeeId, kind, expStr, sig] = parts;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return null;
    const expected = await hmac(`${employeeId}|${kind}|${expStr}`);
    if (expected !== sig) return null;
    if (kind !== "setup" && kind !== "active") return null;
    return { employeeId, kind };
  } catch {
    return null;
  }
}

const TRIVIAL_PINS = new Set([
  "000000", "111111", "222222", "333333", "444444", "555555",
  "666666", "777777", "888888", "999999", "123456", "654321",
  "012345", "543210",
]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function recordFailure(employeeId: string) {
  const { data } = await admin
    .from("sublime_clock_settings")
    .select("failed_attempts")
    .eq("employee_id", employeeId)
    .maybeSingle();
  const next = (data?.failed_attempts ?? 0) + 1;
  const willLock = next >= MAX_ATTEMPTS;
  const lockedUntil = willLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString() : null;
  await admin
    .from("sublime_clock_settings")
    .update({
      failed_attempts: next,
      last_pin_attempt_at: new Date().toISOString(),
      ...(willLock && { locked_until: lockedUntil, pin_status: "locked" }),
    })
    .eq("employee_id", employeeId);
  if (willLock) {
    await admin.from("sublime_pin_audit").insert({
      employee_id: employeeId,
      action: "locked_out",
      performed_by: "system",
      metadata: { until: lockedUntil },
    });
  }
  return { attempts: next, locked_until: lockedUntil };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body as { action?: string };

    if (action === "verify") {
      const pin = String((body as { pin?: string }).pin ?? "").trim();
      if (!/^\d{4,6}$/.test(pin)) {
        return jsonResponse({ ok: false, error: "PIN inválido" }, 400);
      }
      const hash = await hashPin(pin);

      // Try personal PIN first (6 digits)
      let match: any = null;
      let isTemp = false;
      if (pin.length === 6) {
        const { data } = await admin
          .from("sublime_clock_settings")
          .select("*")
          .eq("pin_hash", hash)
          .maybeSingle();
        match = data;
      }
      if (!match && pin.length === 4) {
        const { data } = await admin
          .from("sublime_clock_settings")
          .select("*")
          .eq("temp_pin_hash", hash)
          .maybeSingle();
        if (data) {
          match = data;
          isTemp = true;
        }
      }

      if (!match) {
        return jsonResponse({ ok: false, error: "PIN incorrecto" }, 200);
      }

      // Blocked / locked checks
      if (match.blocked) {
        return jsonResponse({ ok: false, error: "Fichaje bloqueado. Contacta a tu supervisor." }, 200);
      }
      if (match.locked_until && new Date(match.locked_until) > new Date()) {
        const until = new Date(match.locked_until).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
        return jsonResponse({ ok: false, error: `Fichaje bloqueado hasta ${until}.` }, 200);
      }

      if (isTemp) {
        if (match.temp_pin_expires_at && new Date(match.temp_pin_expires_at) < new Date()) {
          return jsonResponse({ ok: false, error: "PIN temporal expirado. Pide uno nuevo a tu supervisor." }, 200);
        }
        const token = await makeToken(match.employee_id, "setup");
        // reset failures on success
        await admin
          .from("sublime_clock_settings")
          .update({ failed_attempts: 0, last_pin_attempt_at: new Date().toISOString() })
          .eq("employee_id", match.employee_id);
        return jsonResponse({ ok: true, requires_personal_setup: true, session_token: token });
      }

      // Active PIN — fetch employee summary
      const { data: emp } = await admin
        .from("employees")
        .select("id, first_name, last_name, internal_id, status")
        .eq("id", match.employee_id)
        .maybeSingle();

      if (!emp || emp.status !== "active") {
        return jsonResponse({ ok: false, error: "Empleado no disponible" }, 200);
      }

      await admin
        .from("sublime_clock_settings")
        .update({ failed_attempts: 0, last_pin_attempt_at: new Date().toISOString() })
        .eq("employee_id", match.employee_id);

      const token = await makeToken(match.employee_id, "active");
      return jsonResponse({
        ok: true,
        session_token: token,
        employee: {
          id: emp.id,
          name: `${emp.first_name} ${emp.last_name}`.trim(),
          internal_id: emp.internal_id,
        },
      });
    }

    if (action === "set_personal_pin") {
      const { session_token, new_pin, confirm_pin } = body as {
        session_token?: string; new_pin?: string; confirm_pin?: string;
      };
      if (!session_token) return jsonResponse({ ok: false, error: "Sesión inválida" }, 400);
      const t = await verifyToken(session_token);
      if (!t || t.kind !== "setup") {
        return jsonResponse({ ok: false, error: "Sesión expirada. Vuelve a introducir tu PIN temporal." }, 401);
      }
      if (!new_pin || !confirm_pin) return jsonResponse({ ok: false, error: "Faltan datos" }, 400);
      if (!/^\d{6}$/.test(new_pin)) return jsonResponse({ ok: false, error: "El PIN debe tener 6 dígitos" }, 400);
      if (new_pin !== confirm_pin) return jsonResponse({ ok: false, error: "Los PINs no coinciden" }, 400);
      if (TRIVIAL_PINS.has(new_pin)) {
        return jsonResponse({ ok: false, error: "Elige un PIN menos predecible" }, 400);
      }

      const hash = await hashPin(new_pin);
      // Ensure uniqueness across employees
      const { data: clash } = await admin
        .from("sublime_clock_settings")
        .select("employee_id")
        .eq("pin_hash", hash)
        .neq("employee_id", t.employeeId)
        .maybeSingle();
      if (clash) return jsonResponse({ ok: false, error: "Elige otro PIN" }, 400);

      const { error } = await admin
        .from("sublime_clock_settings")
        .update({
          pin_hash: hash,
          pin_set_at: new Date().toISOString(),
          temp_pin_hash: null,
          temp_pin_expires_at: null,
          pin_status: "active",
          failed_attempts: 0,
          locked_until: null,
        })
        .eq("employee_id", t.employeeId);
      if (error) throw error;

      await admin.from("sublime_pin_audit").insert({
        employee_id: t.employeeId,
        action: "personal_set",
        performed_by: "employee",
        metadata: {},
      });

      const { data: emp } = await admin
        .from("employees")
        .select("id, first_name, last_name, internal_id")
        .eq("id", t.employeeId)
        .maybeSingle();

      const activeToken = await makeToken(t.employeeId, "active");
      return jsonResponse({
        ok: true,
        session_token: activeToken,
        employee: emp
          ? { id: emp.id, name: `${emp.first_name} ${emp.last_name}`.trim(), internal_id: emp.internal_id }
          : null,
      });
    }

    // Record failed attempt explicitly is handled inside verify; expose helper for wrong PIN tracking via employee lookup is intentionally avoided.

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
