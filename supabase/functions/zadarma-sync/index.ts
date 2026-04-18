import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createHmac, createHash } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const zadarmaTimeZone = Deno.env.get("ZADARMA_TIMEZONE") ?? "Europe/Madrid";

function md5(data: string): string {
  return createHash("md5").update(data).digest("hex");
}

function httpBuildQuery(params: Record<string, string>): string {
  const sorted = Object.keys(params).sort().reduce((obj, key) => {
    obj[key] = params[key];
    return obj;
  }, {} as Record<string, string>);
  return new URLSearchParams(sorted).toString().replace(/%20/g, "+");
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const offsetPart = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value;

  if (!offsetPart || offsetPart === "GMT") return 0;

  const match = offsetPart.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return 0;

  const [, sign, hours, minutes] = match;
  const totalMinutes = Number(hours) * 60 + Number(minutes || 0);
  return sign === "+" ? totalMinutes : -totalMinutes;
}

function normalizeIncomingUtcString(value: string): Date {
  const normalized = value.includes("T")
    ? value
    : value.replace(" ", "T");

  return new Date(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
}

function formatForZadarma(value: string, timeZone: string): string {
  const date = normalizeIncomingUtcString(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid datetime received: ${value}`);
  }

  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
}

function parseZadarmaDateTime(value: unknown, timeZone: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const assumedUtcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  const offsetMinutes = getTimeZoneOffsetMinutes(new Date(assumedUtcMs), timeZone);
  return new Date(assumedUtcMs - offsetMinutes * 60_000).toISOString();
}

async function fetchRecordingUrl(
  pbxCallId: string,
  key: string,
  secret: string,
): Promise<string | null> {
  try {
    const data = await zadarmaRequest(
      "pbx/record/request",
      { pbx_call_id: pbxCallId, lifetime: "5184000" },
      key,
      secret,
    );
    if (data?.status !== "success") return null;
    const link = data.link || (Array.isArray(data.links) ? data.links[0] : null);
    return typeof link === "string" && link ? link : null;
  } catch (err) {
    console.warn(`fetchRecordingUrl failed for ${pbxCallId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function enrichWithRecordings(
  calls: Array<Record<string, unknown>>,
  key: string,
  secret: string,
  concurrency = 5,
): Promise<number> {
  const targets = calls.filter((c) => {
    const pbx = String(c.pbx_call_id || "");
    return pbx && Number(c.talk_duration || 0) > 0 && !c.recording_url;
  });
  let enriched = 0;
  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = targets.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (call) => {
        const link = await fetchRecordingUrl(String(call.pbx_call_id), key, secret);
        if (link) {
          call.recording_url = link;
          call.is_recorded = true;
          enriched++;
        }
      }),
    );
  }
  return enriched;
}

async function zadarmaRequest(
  apiMethod: string,
  params: Record<string, string>,
  key: string,
  secret: string
) {
  const method = `/v1/${apiMethod}/`;
  const paramsStr = httpBuildQuery(params);
  const md5Hash = md5(paramsStr);
  const signStr = method + paramsStr + md5Hash;
  const sha1Hex = createHmac("sha1", secret).update(signStr).digest("hex");
  const signature = btoa(sha1Hex);

  const url = `https://api.zadarma.com${method}?${paramsStr}`;

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

    const zadarmaStart = formatForZadarma(start, zadarmaTimeZone);
    const zadarmaEnd = formatForZadarma(end, zadarmaTimeZone);

    const params: Record<string, string> = {
      start: zadarmaStart,
      end: zadarmaEnd,
      format: "json",
      version: "2",
    };

    const data = await zadarmaRequest("statistics/pbx", params, zadarmaKey, zadarmaSecret);

    if (data.status !== "success") {
      throw new Error(`Zadarma returned status: ${data.status} - ${JSON.stringify(data)}`);
    }

    const stats = data.stats || [];
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: sipAgents } = await supabase.from("sip_agents").select("sip_id, agent_name");
    const sipMap: Record<string, string> = {};
    (sipAgents || []).forEach((a: { sip_id: string; agent_name: string }) => {
      sipMap[a.sip_id] = a.agent_name;
    });

    const calls = stats.map((s: Record<string, unknown>) => {
      const sip = String(s.sip || s.internal || "");
      const callId = String(s.call_id || s.pbx_call_id || s.id || `${s.callstart}_${sip}`);
      const seconds = Number(s.seconds || s.duration || 0);
      const talkSeconds = Number(s.talk_seconds || s.billseconds || seconds);

      let direction = "outgoing";
      if (s.calltype === "IN_CALLS" || s.call_type === "incoming" || s.disposition === "incoming") {
        direction = "incoming";
      } else if (s.clid && s.destination) {
        if (String(s.destination).length <= 4) direction = "incoming";
      }

      return {
        call_id: callId,
        pbx_call_id: String(s.pbx_call_id || ""),
        call_start: parseZadarmaDateTime(s.callstart || s.call_start, zadarmaTimeZone),
        call_end: parseZadarmaDateTime(s.callend, zadarmaTimeZone),
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
