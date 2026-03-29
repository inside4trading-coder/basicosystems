import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const { contacts, listName } = await req.json();

    // contacts: array of { email, first_name, last_name, billing_phone? }
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return new Response(JSON.stringify({ listId: null, contactCount: 0, message: "No contacts provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter only contacts with valid email
    const validContacts = contacts.filter((c: any) => c.email && c.email.includes("@"));

    if (validContacts.length === 0) {
      return new Response(JSON.stringify({ listId: null, contactCount: 0, message: "No valid emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create or get list in Brevo
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

    // Sync contacts to Brevo in batches of 150
    const batchSize = 150;
    let synced = 0;
    for (let i = 0; i < validContacts.length; i += batchSize) {
      const batch = validContacts.slice(i, i + batchSize);
      const jsonContacts = batch.map((c: any) => ({
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
