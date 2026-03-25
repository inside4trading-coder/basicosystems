import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE = "https://basicoclothes.com/wp-json/wc/v3";
const PER_PAGE = 100;

async function wcFetch(path: string, params: Record<string, string> = {}) {
  const WC_KEY = Deno.env.get("WC_CONSUMER_KEY")!;
  const WC_SECRET = Deno.env.get("WC_CONSUMER_SECRET")!;
  const qs = new URLSearchParams({ consumer_key: WC_KEY, consumer_secret: WC_SECRET, ...params });
  const res = await fetch(`${BASE}${path}?${qs}`);
  return {
    body: await res.json(),
    totalPages: parseInt(res.headers.get("X-WP-TotalPages") || "1"),
    total: parseInt(res.headers.get("X-WP-Total") || "0"),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get starting page from query param (for resumable sync)
    const url = new URL(req.url);
    const startPage = parseInt(url.searchParams.get("start_page") || "1");
    const maxPagesParam = parseInt(url.searchParams.get("max_pages") || "20");

    const first = await wcFetch("/customers", { page: String(startPage), per_page: String(PER_PAGE), orderby: "registered_date", order: "desc" });
    const totalPages = first.totalPages;
    const total = first.total;

    let allCustomers: any[] = Array.isArray(first.body) ? first.body : [];
    
    const endPage = Math.min(startPage + maxPagesParam - 1, totalPages);
    
    // Fetch remaining pages in batches of 3
    for (let batch = startPage + 1; batch <= endPage; batch += 3) {
      const promises = [];
      for (let p = batch; p <= Math.min(batch + 2, endPage); p++) {
        promises.push(
          wcFetch("/customers", { page: String(p), per_page: String(PER_PAGE), orderby: "registered_date", order: "desc" })
        );
      }
      const results = await Promise.all(promises);
      for (const r of results) {
        if (Array.isArray(r.body)) allCustomers = allCustomers.concat(r.body);
      }
    }

    // Map and upsert
    const rows = allCustomers.map((c: any) => ({
      id: c.id,
      email: c.email || null,
      first_name: c.first_name || null,
      last_name: c.last_name || null,
      username: c.username || null,
      avatar_url: c.avatar_url || null,
      billing_company: c.billing?.company || null,
      billing_city: c.billing?.city || null,
      billing_state: c.billing?.state || null,
      billing_country: c.billing?.country || null,
      billing_phone: c.billing?.phone || null,
      shipping_city: c.shipping?.city || null,
      shipping_state: c.shipping?.state || null,
      shipping_country: c.shipping?.country || null,
      woo_orders_count: c.orders_count ?? 0,
      woo_total_spent: parseFloat(c.total_spent || "0"),
      orders_count: c.orders_count ?? 0,
      total_spent: parseFloat(c.total_spent || "0"),
      date_created: c.date_created_gmt ? `${c.date_created_gmt}Z` : null,
      date_modified: c.date_modified_gmt ? `${c.date_modified_gmt}Z` : null,
      last_order_id: c.last_order?.id || null,
      last_order_date: c.last_order?.date_created_gmt ? `${c.last_order.date_created_gmt}Z` : null,
      synced_at: new Date().toISOString(),
    }));

    // Upsert in batches of 500
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await supabase.from("customers_cache").upsert(batch, { onConflict: "id" });
      if (error) {
        console.error("Upsert error batch", i, error);
        throw error;
      }
      upserted += batch.length;
    }

    // Recalculate orders_count and total_spent from orders table
    await supabase.rpc("refresh_customers_order_stats");

    const nextPage = endPage < totalPages ? endPage + 1 : null;

    return new Response(
      JSON.stringify({ success: true, total_woo: total, synced: upserted, pages_fetched: endPage - startPage + 1, next_page: nextPage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("woo-customers-sync error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
