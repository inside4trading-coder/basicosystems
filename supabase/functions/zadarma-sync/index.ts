import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function zadarmaSign(method: string, params: Record<string, string>, secret: string): string {
  const sortedKeys = Object.keys(params).sort();
  const paramsStr = sortedKeys.map((k) => `${k}=${params[k]}`).join("");
  const signStr = method + paramsStr + createHmac("md5", "").update(paramsStr).digest("hex");
  return createHmac("sha1", secret).update(signStr).digest("base64");
}

async function zadarmaRequest(
  apiMethod: string,
  params: Record<string, string>,
  key: string,
  secret: string
) {
  const qs = new URLSearchParams(params).toString();
  const url = `https://api.zadarma.com/v1/${apiMethod}/?${qs}`;
  const signature = zadarmaSign(`/v1/${apiMethod}/`, params, secret);

  const res = await fetch(url, {
    headers: {
      Authorization: `${key}:${signature}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zadarma API error ${res.status}: ${text}`);
  }
  return res.json();
}

function mapDirection(disposition: string | undefined, clid: string | undefined): string {
  if (disposition === "answered" || !disposition) {
    // Check if incoming based on other fields
  }
  return "outgoing"; // default
}

function mapStatus(disposition: string | undefined, seconds: number): string {
  if (!disposition) return seconds > 0 ? "answered" : "no_answer";
  const d = disposition.toLowerCase();
  if (d === "answered" || seconds > 0) return "answered";
  if (d === "busy") return "busy";
  if (d === "no answer" || d === "noanswer" || d === "no_answer") return "no_answer";
  if (d === "cancel" || d === "failed") return "missed";
  return "no_answer";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const zadarmaKey = Deno.env.get("ZADARMA_KEY");
    const zadarmaSecret = Deno.env.get("ZADARMA_SECRET");
    if (!zadarmaKey || !zadarmaSecret) {
      throw new Error("ZADARMA_KEY or ZADARMA_SECRET not configured");
    }

    const body = await req.json();
    const { start, end } = body;

    if (!start || !end) {
      return new Response(JSON.stringify({ error: "start and end are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch PBX statistics from Zadarma
    const params: Record<string, string> = {
      start,
      end,
      version: "2",
    };

    const data = await zadarmaRequest("statistics/pbx", params, zadarmaKey, zadarmaSecret);

    if (data.status !== "success") {
      throw new Error(`Zadarma returned status: ${data.status} - ${JSON.stringify(data)}`);
    }

    const stats = data.stats || [];
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch SIP agent mappings
    const { data: sipAgents } = await supabase.from("sip_agents").select("sip_id, agent_name");
    const sipMap: Record<string, string> = {};
    (sipAgents || []).forEach((a: { sip_id: string; agent_name: string }) => {
      sipMap[a.sip_id] = a.agent_name;
    });

    // Transform and upsert calls
    const calls = stats.map((s: Record<string, unknown>) => {
      const sip = String(s.sip || s.internal || "");
      const callId = String(s.call_id || s.pbx_call_id || s.id || `${s.callstart}_${sip}`);
      const seconds = Number(s.seconds || s.duration || 0);
      const talkSeconds = Number(s.talk_seconds || s.billseconds || seconds);

      // Determine direction
      let direction = "outgoing";
      if (s.calltype === "IN_CALLS" || s.call_type === "incoming" || s.disposition === "incoming") {
        direction = "incoming";
      } else if (s.clid && s.destination) {
        // If clid looks like external number and destination is a SIP, it's incoming
        if (String(s.destination).length <= 4) direction = "incoming";
      }

      return {
        call_id: callId,
        pbx_call_id: String(s.pbx_call_id || ""),
        call_start: s.callstart || s.call_start || null,
        call_end: s.callend || null,
        caller: String(s.clid || s.caller_id || s.from || ""),
        destination: String(s.destination || s.called_did || s.to || ""),
        direction,
        status: mapStatus(String(s.disposition || ""), seconds),
        duration: seconds,
        talk_duration: talkSeconds,
        sip,
        agent_name: sipMap[sip] || sip || "Sin asignar",
        cost: Number(s.cost || s.bill_cost || 0),
        is_recorded: Boolean(s.is_recorded || s.recorded),
        recording_url: String(s.recording || s.record_link || ""),
        raw_data: s,
        synced_at: new Date().toISOString(),
      };
    });

    if (calls.length > 0) {
      // Upsert in batches of 500
      for (let i = 0; i < calls.length; i += 500) {
        const batch = calls.slice(i, i + 500);
        const { error: upsertError } = await supabase
          .from("calls_cache")
          .upsert(batch, { onConflict: "call_id" });

        if (upsertError) {
          console.error("Upsert error:", upsertError);
          throw new Error(`DB upsert failed: ${upsertError.message}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: calls.length,
        period: { start, end },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Zadarma sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
