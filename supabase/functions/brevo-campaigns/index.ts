import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BREVO_BASE = "https://api.brevo.com/v3";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const body = req.method !== "GET" ? await req.json() : {};
    const action = body.action || url.searchParams.get("action") || "list";

    // ---- GET SENDERS ----
    if (action === "get_senders") {
      const res = await fetch(`${BREVO_BASE}/senders`, {
        headers: { "api-key": BREVO_API_KEY },
      });
      if (!res.ok) throw new Error("Failed to fetch senders from Brevo");
      const data = await res.json();
      const activeSenders = (data.senders || []).filter((s: any) => s.active);
      return new Response(JSON.stringify(activeSenders), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- LIST campaigns ----
    if (action === "list") {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- GET single campaign ----
    if (action === "get") {
      const id = body.id || url.searchParams.get("id");
      const { data, error } = await supabase.from("campaigns").select("*").eq("id", id).single();
      if (error) throw error;

      // Fetch stats from Brevo if campaign was sent
      if (data.brevo_campaign_id && data.status === "sent") {
        try {
          const statsRes = await fetch(`${BREVO_BASE}/emailCampaigns/${data.brevo_campaign_id}`, {
            headers: { "api-key": BREVO_API_KEY },
          });
          if (statsRes.ok) {
            const brevoData = await statsRes.json();
            const stats = brevoData.statistics?.globalStats || {};
            const statsJson = {
              sent: stats.sent || 0,
              delivered: stats.delivered || 0,
              opened: stats.uniqueOpens || 0,
              clicked: stats.uniqueClicks || 0,
              unsubscribed: stats.unsubscriptions || 0,
              bounced: stats.hardBounces + stats.softBounces || 0,
              openRate: stats.sent > 0 ? ((stats.uniqueOpens || 0) / stats.sent * 100).toFixed(1) : "0",
              clickRate: stats.sent > 0 ? ((stats.uniqueClicks || 0) / stats.sent * 100).toFixed(1) : "0",
            };
            // Update local stats
            await supabase.from("campaigns").update({ stats_json: statsJson }).eq("id", id);
            data.stats_json = statsJson;
          }
        } catch (e) {
          console.error("Failed to fetch Brevo stats:", e);
        }
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- CREATE campaign in Brevo + DB ----
    if (action === "create") {
      const { name, subject, senderName, senderEmail, content, listId, segmentFilter, scheduledAt, recipientCount, sendNow } = body;

      // Create in Brevo
      const brevoPayload: any = {
        name,
        subject,
        sender: { name: senderName || "Basico", email: senderEmail || "hola@basicoclothes.com" },
        type: "classic",
        htmlContent: content || "<html><body>{{params.BODY}}</body></html>",
        recipients: listId ? { listIds: [listId] } : undefined,
      };

      if (scheduledAt) {
        brevoPayload.scheduledAt = scheduledAt;
      }

      const brevoRes = await fetch(`${BREVO_BASE}/emailCampaigns`, {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(brevoPayload),
      });

      if (!brevoRes.ok) {
        const errText = await brevoRes.text();
        throw new Error(`Brevo create campaign failed: ${errText}`);
      }

      const brevoData = await brevoRes.json();
      const brevoCampaignId = brevoData.id;

      // Save to DB
      const status = sendNow ? "sent" : scheduledAt ? "scheduled" : "draft";
      const { data: dbCampaign, error: dbErr } = await supabase
        .from("campaigns")
        .insert({
          name,
          subject,
          sender_name: senderName || "Basico",
          sender_email: senderEmail || "hola@basicoclothes.com",
          content,
          brevo_campaign_id: brevoCampaignId,
          segment_filter: segmentFilter || {},
          recipient_count: recipientCount || 0,
          status,
          scheduled_at: scheduledAt || null,
          sent_at: sendNow ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (dbErr) throw dbErr;

      // Send now if requested
      if (sendNow) {
        const sendRes = await fetch(`${BREVO_BASE}/emailCampaigns/${brevoCampaignId}/sendNow`, {
          method: "POST",
          headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
        });

        if (!sendRes.ok) {
          const errText = await sendRes.text();
          console.error(`Send now failed: ${errText}`);
          // Update status back to draft
          await supabase.from("campaigns").update({ status: "draft", sent_at: null }).eq("id", dbCampaign.id);
          throw new Error(`Failed to send: ${errText}`);
        }
      }

      return new Response(JSON.stringify(dbCampaign), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- DELETE campaign ----
    if (action === "delete") {
      const { id } = body;
      // Get brevo_campaign_id first
      const { data: camp } = await supabase.from("campaigns").select("brevo_campaign_id").eq("id", id).single();
      
      if (camp?.brevo_campaign_id) {
        await fetch(`${BREVO_BASE}/emailCampaigns/${camp.brevo_campaign_id}`, {
          method: "DELETE",
          headers: { "api-key": BREVO_API_KEY },
        });
      }

      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- DUPLICATE campaign ----
    if (action === "duplicate") {
      const { id } = body;
      const { data: original, error: fetchErr } = await supabase.from("campaigns").select("*").eq("id", id).single();
      if (fetchErr) throw fetchErr;

      const { data: dup, error: dupErr } = await supabase
        .from("campaigns")
        .insert({
          name: `${original.name} (copia)`,
          subject: original.subject,
          sender_name: original.sender_name,
          sender_email: original.sender_email,
          content: original.content,
          segment_filter: original.segment_filter,
          status: "draft",
        })
        .select()
        .single();

      if (dupErr) throw dupErr;

      return new Response(JSON.stringify(dup), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("brevo-campaigns error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
