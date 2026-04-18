import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RECIPIENT = "hola@musacreativo.com";
const SENDER = { name: "Basico Landing", email: "crew@basicoclothes.com" };

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not configured");

    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const brand = String(body.brand ?? "").trim();
    const interest = String(body.interest ?? "").trim();
    const message = String(body.message ?? "").trim();

    if (!name || !email) {
      return new Response(JSON.stringify({ error: "name and email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const row = (label: string, value: string) => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:13px;color:#666;width:130px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">${label}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:15px;color:#0A0A0A;">${escapeHtml(value || "—")}</td>
      </tr>`;

    const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;">
      <div style="max-width:620px;margin:32px auto;background:#fff;border:1px solid #eaeaea;">
        <div style="background:#0A0A0A;padding:20px 24px;">
          <div style="color:#fff;font-weight:900;letter-spacing:-.01em;font-size:18px;text-transform:uppercase;">
            Basico <span style="color:#E3001B;">/</span> Systems
          </div>
          <div style="color:#bbb;font-size:12px;margin-top:4px;text-transform:uppercase;letter-spacing:.08em;">Nuevo lead desde la landing</div>
        </div>
        <div style="padding:24px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#0A0A0A;">${escapeHtml(name)}</h1>
          <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;">
            ${row("Nombre", name)}
            ${row("Email", email)}
            ${row("Marca", brand)}
            ${row("Interés", interest)}
            ${row("Mensaje", message)}
          </table>
          <div style="margin-top:24px;padding:14px 16px;background:#fafafa;border-left:3px solid #E3001B;font-size:13px;color:#444;">
            Responde directamente a este email para contactar al lead (reply-to: ${escapeHtml(email)}).
          </div>
        </div>
      </div>
    </body></html>`;

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: SENDER,
        to: [{ email: RECIPIENT }],
        replyTo: { email, name },
        subject: `Nuevo lead desde la landing — ${name}`,
        htmlContent: html,
      }),
    });

    const text = await brevoRes.text();
    if (!brevoRes.ok) {
      console.error("Brevo /smtp/email failed:", brevoRes.status, text);
      return new Response(JSON.stringify({ error: "Brevo send failed", detail: text }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, brevo: text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-landing-lead-notification error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
