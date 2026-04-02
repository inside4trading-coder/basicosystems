import { createHmac, createHash } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const zadarmaKey = Deno.env.get("ZADARMA_KEY");
    const zadarmaSecret = Deno.env.get("ZADARMA_SECRET");
    const sipLogin = Deno.env.get("ZADARMA_SIP_LOGIN");

    if (!zadarmaKey || !zadarmaSecret) {
      throw new Error("ZADARMA_KEY or ZADARMA_SECRET not configured");
    }

    if (!sipLogin) {
      throw new Error("ZADARMA_SIP_LOGIN not configured");
    }

    // Generate WebRTC key via Zadarma API
    const apiMethod = "/v1/webrtc/get_key/";
    const params: Record<string, string> = {
      sip: sipLogin,
    };

    const paramsStr = httpBuildQuery(params);
    const md5Hash = md5(paramsStr);
    const signStr = apiMethod + paramsStr + md5Hash;
    const signature = createHmac("sha1", zadarmaSecret).update(signStr).digest("base64");

    const url = `https://api.zadarma.com${apiMethod}?${paramsStr}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `${zadarmaKey}:${signature}`,
      },
    });

    const data = await res.json();

    if (data.status !== "success") {
      console.error("Zadarma WebRTC key error:", JSON.stringify(data));
      throw new Error(data.message || `Zadarma API returned status: ${data.status}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        key: data.key,
        sipLogin,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("WebRTC key error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
