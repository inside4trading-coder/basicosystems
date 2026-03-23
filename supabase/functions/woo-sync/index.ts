import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WC_BASE = "https://basicoclothes.com/wp-json/wc/v3";

async function wcFetch(path: string, params: Record<string, string> = {}) {
  const key = Deno.env.get("WC_CONSUMER_KEY")!;
  const secret = Deno.env.get("WC_CONSUMER_SECRET")!;
  const qs = new URLSearchParams({ consumer_key: key, consumer_secret: secret, ...params });
  const res = await fetch(`${WC_BASE}${path}?${qs}`);
  return {
    body: await res.json(),
    totalPages: parseInt(res.headers.get("X-WP-TotalPages") || "1"),
  };
}

function extractVariation(meta: any[], key: string): string | null {
  if (!Array.isArray(meta)) return null;
  const found = meta.find((m: any) =>
    m.key?.toLowerCase() === key.toLowerCase() ||
    m.display_key?.toLowerCase() === key.toLowerCase() ||
    m.key?.toLowerCase().includes(key.toLowerCase())
  );
  return found?.value || found?.display_value || null;
}

function extractSaleChannel(meta: any[]): string {
  if (!Array.isArray(meta)) return "web";
  const ch = meta.find((m: any) =>
    m.key === "_sale_channel" || m.key === "sale_channel" || m.key === "_created_via"
  );
  return ch?.value || "web";
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const sinceDays = parseInt(url.searchParams.get("days") || "30");
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all orders paginated
    const allOrders: any[] = [];
    let page = 1;
    let totalPages = 1;
    console.log(`Starting sync since ${since.toISOString()} (${sinceDays} days)`);
    while (page <= totalPages) {
      console.log(`Fetching page ${page}/${totalPages}...`);
      const res = await wcFetch("/orders", {
        after: since.toISOString(),
        per_page: "100",
        page: String(page),
        status: "any",
      });
      totalPages = res.totalPages;
      if (Array.isArray(res.body)) allOrders.push(...res.body);
      else {
        console.error("WC API returned non-array:", JSON.stringify(res.body).slice(0, 200));
        break;
      }
      console.log(`Page ${page} done, got ${res.body?.length || 0} orders (total so far: ${allOrders.length})`);
      page++;
    }
    console.log(`Total orders fetched: ${allOrders.length}`);

    // Fetch product_costs for matching
    const { data: costData } = await supabase.from("product_costs").select("sku, analytic_category, unit_cost_total");
    const costMap = new Map<string, { category: string | null; cost: number | null }>();
    if (costData) {
      for (const c of costData) {
        costMap.set(c.sku, { category: c.analytic_category, cost: c.unit_cost_total });
      }
    }

    let syncedOrders = 0;
    let syncedItems = 0;
    let syncedPayments = 0;

    // Process in batches of 50
    for (let i = 0; i < allOrders.length; i += 50) {
      const batch = allOrders.slice(i, i + 50);

      const orderRows = batch.map((o: any) => ({
        order_id: o.id,
        order_number: String(o.number || o.id),
        order_datetime: o.date_created_gmt ? o.date_created_gmt + "Z" : o.date_created,
        order_date: (o.date_created_gmt || o.date_created || "").split("T")[0] || null,
        order_status: o.status,
        sale_channel: extractSaleChannel(o.meta_data),
        billing_state: o.billing?.state || null,
        subtotal_amount: parseFloat(o.discount_total || "0") > 0
          ? parseFloat(o.total || "0") + parseFloat(o.discount_total || "0") - parseFloat(o.shipping_total || "0") - parseFloat(o.total_tax || "0")
          : parseFloat(o.total || "0") - parseFloat(o.shipping_total || "0") - parseFloat(o.total_tax || "0"),
        discount_amount: parseFloat(o.discount_total || "0"),
        shipping_amount: parseFloat(o.shipping_total || "0"),
        tax_amount: parseFloat(o.total_tax || "0"),
        refunded_amount: Math.abs(parseFloat(o.total_refunded || "0")),
        total_amount: parseFloat(o.total || "0"),
        order_currency: o.currency || "USD",
        customer_email: o.billing?.email || null,
        customer_phone: o.billing?.phone || null,
        payment_method: o.payment_method_title || o.payment_method || null,
        synced_at: new Date().toISOString(),
      }));

      const { error: ordErr } = await supabase.from("orders").upsert(orderRows, { onConflict: "order_id" });
      if (ordErr) console.error("Orders upsert error:", ordErr.message);
      syncedOrders += orderRows.length;

      // Order items
      const itemRows: any[] = [];
      for (const o of batch) {
        for (const li of (o.line_items || [])) {
          const sku = li.sku || null;
          const costInfo = sku ? costMap.get(sku) : null;
          itemRows.push({
            order_id: o.id,
            line_item_id: li.id,
            sku,
            parent_sku: li.parent_name ? null : null,
            product_name: li.name,
            quantity: li.quantity || 0,
            unit_price: parseFloat(li.price || "0"),
            line_total: parseFloat(li.total || "0"),
            item_cost: costInfo?.cost || null,
            size: extractVariation(li.meta_data, "talla") || extractVariation(li.meta_data, "size") || extractVariation(li.meta_data, "pa_talla"),
            color: extractVariation(li.meta_data, "color") || extractVariation(li.meta_data, "pa_color"),
            analytic_category: costInfo?.category || null,
          });
        }
      }

      if (itemRows.length > 0) {
        // Delete existing items for these orders then insert
        const orderIds = batch.map((o: any) => o.id);
        await supabase.from("order_items").delete().in("order_id", orderIds);
        const { error: itemErr } = await supabase.from("order_items").insert(itemRows);
        if (itemErr) console.error("Items insert error:", itemErr.message);
        syncedItems += itemRows.length;
      }

      // Payments
      const paymentRows = batch.map((o: any) => ({
        order_id: o.id,
        payment_slot: 1,
        payment_method: o.payment_method_title || o.payment_method || "unknown",
        payment_bank: null,
        payment_amount: parseFloat(o.total || "0"),
        payment_currency: o.currency || "USD",
        payment_reference: o.transaction_id || null,
      }));

      const paymentOrderIds = batch.map((o: any) => o.id);
      await supabase.from("payments").delete().in("order_id", paymentOrderIds);
      const { error: payErr } = await supabase.from("payments").insert(paymentRows);
      if (payErr) console.error("Payments insert error:", payErr.message);
      syncedPayments += paymentRows.length;
    }

    return new Response(JSON.stringify({
      success: true,
      synced: { orders: syncedOrders, items: syncedItems, payments: syncedPayments },
      total_fetched: allOrders.length,
      since: since.toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
