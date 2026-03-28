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

    const { segmentFilter, listName } = await req.json();

    // 1. Build query for customers_cache based on segment filter
    let query = supabase.from("customers_cache").select("email, first_name, last_name, billing_phone");

    if (segmentFilter) {
      if (segmentFilter.type === "orders_count") {
        if (segmentFilter.min !== undefined) query = query.gte("orders_count", segmentFilter.min);
        if (segmentFilter.max !== undefined) query = query.lte("orders_count", segmentFilter.max);
      }
      if (segmentFilter.type === "all") {
        // no filter
      }
    }

    // Filter only contacts with email
    query = query.not("email", "is", null).neq("email", "");

    const { data: contacts, error: dbErr } = await query.limit(10000);
    if (dbErr) throw dbErr;

    if (!contacts || contacts.length === 0) {
      return new Response(JSON.stringify({ listId: null, contactCount: 0, message: "No contacts found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Create or get list in Brevo
    const safeListName = listName || `Basico_${Date.now()}`;

    const listRes = await fetch(`${BREVO_BASE}/contacts/lists`, {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ name: safeListName, folderId: 1 }),
    });

    let listId: number;
    if (listRes.ok) {
      const listData = await listRes.json();
      listId = listData.id;
    } else {
      // If list already exists, find it
      const listsRes = await fetch(`${BREVO_BASE}/contacts/lists?limit=50&offset=0`, {
        headers: { "api-key": BREVO_API_KEY },
      });
      const listsData = await listsRes.json();
      const existing = listsData.lists?.find((l: any) => l.name === safeListName);
      if (existing) {
        listId = existing.id;
      } else {
        const errBody = await listRes.text();
        throw new Error(`Failed to create list: ${errBody}`);
      }
    }

    // 3. Sync contacts to Brevo in batches of 150
    const batchSize = 150;
    let synced = 0;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const jsonContacts = batch.map((c) => ({
        email: c.email,
        attributes: {
          FIRSTNAME: c.first_name || "",
          LASTNAME: c.last_name || "",
          SMS: c.billing_phone || "",
        },
        listIds: [listId],
        updateEnabled: true,
      }));

      const importRes = await fetch(`${BREVO_BASE}/contacts/import`, {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          listIds: [listId],
          jsonBody: jsonContacts,
          updateExistingContacts: true,
          emptyContactsAttributes: false,
        }),
      });

      if (!importRes.ok) {
        const errText = await importRes.text();
        console.error(`Batch import error: ${errText}`);
      } else {
        synced += batch.length;
      }
    }

    return new Response(JSON.stringify({ listId, contactCount: synced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("brevo-sync-contacts error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
