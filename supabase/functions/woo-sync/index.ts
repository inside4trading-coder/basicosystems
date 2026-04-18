import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WC_BASE = "https://basicoclothes.com/wp-json/wc/v3";

function getMetaValue(meta: any[], key: string): string | null {
  if (!Array.isArray(meta)) return null;
  const found = meta.find((m: any) => m.key === key);
  return found?.value || null;
}

function getOrderExchangeRate(o: any): number {
  const rate = getMetaValue(o.meta_data, "_woocs_order_rate");
  if (rate) {
    const parsed = parseFloat(rate);
    if (parsed > 0) return parsed;
  }
  return 1;
}

function getOrderCurrency(o: any): string {
  // o.currency from WC API = actual order currency (e.g. VES, USD)
  // _order_currency meta often returns base currency (USD), NOT the order currency
  // _woocs_order_base_currency = store base currency (always USD) — never use for order currency
  return o.currency
    || getMetaValue(o.meta_data, "_order_currency")
    || "USD";
}

async function wcFetch(path: string, params: Record<string, string> = {}) {
  const key = Deno.env.get("WC_CONSUMER_KEY")!;
  const secret = Deno.env.get("WC_CONSUMER_SECRET")!;
  const qs = new URLSearchParams({ consumer_key: key, consumer_secret: secret, ...params });
  const res = await fetch(`${WC_BASE}${path}?${qs}`);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`WooCommerce returned invalid response (status ${res.status}). The site may be temporarily unavailable.`);
  }
  return {
    body,
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
    const full = url.searchParams.get("full") === "true";
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

    // Collect unique product IDs to fetch categories from WC
    const productIdSet = new Set<number>();
    for (const o of allOrders) {
      for (const li of (o.line_items || [])) {
        if (li.product_id) productIdSet.add(li.product_id);
      }
    }

    // First, fetch the full category tree to build parent lookup
    const categoryParentMap = new Map<number, { name: string; parentId: number }>();
    let catPage = 1;
    let catTotalPages = 1;
    while (catPage <= catTotalPages) {
      const res = await wcFetch("/products/categories", {
        per_page: "100",
        page: String(catPage),
        _fields: "id,name,parent",
      });
      catTotalPages = res.totalPages;
      if (Array.isArray(res.body)) {
        for (const c of res.body) {
          categoryParentMap.set(c.id, { name: c.name, parentId: c.parent || 0 });
        }
      }
      catPage++;
    }
    console.log(`Fetched ${categoryParentMap.size} categories from WC tree`);

    // Helper to find top-level parent category name
    function getParentCategoryName(catId: number): string | null {
      let current = catId;
      let depth = 0;
      while (depth < 10) {
        const cat = categoryParentMap.get(current);
        if (!cat) return null;
        if (cat.parentId === 0) return cat.name; // This is the root
        current = cat.parentId;
        depth++;
      }
      return null;
    }

    const productCategoryMap = new Map<number, { category: string; parentCategory: string | null }>();
    const productIds = [...productIdSet];
    console.log(`Fetching categories for ${productIds.length} unique products...`);
    // Fetch products in batches of 100
    for (let i = 0; i < productIds.length; i += 100) {
      const chunk = productIds.slice(i, i + 100);
      const res = await wcFetch("/products", {
        include: chunk.join(","),
        per_page: "100",
        _fields: "id,categories",
      });
      if (Array.isArray(res.body)) {
        for (const p of res.body) {
          const cats: { id: number; name: string }[] = (p.categories || []).filter((c: any) => c.name);
          if (cats.length > 0) {
            // Most specific = last category
            const specific = cats[cats.length - 1];
            // Find root parent
            const parentName = getParentCategoryName(specific.id);
            productCategoryMap.set(p.id, {
              category: specific.name,
              parentCategory: parentName && parentName !== specific.name ? parentName : null,
            });
          }
        }
      }
    }
    console.log(`Fetched categories for ${productCategoryMap.size} products`);

    let syncedOrders = 0;
    let syncedItems = 0;
    let syncedPayments = 0;

    // Process in batches of 50
    for (let i = 0; i < allOrders.length; i += 50) {
      const batch = allOrders.slice(i, i + 50);

      const orderRows = batch.map((o: any) => {
        let rate = getOrderExchangeRate(o);
        const currency = getOrderCurrency(o);
        const total = parseFloat(o.total || "0");
        // If currency is not USD but rate is 1 (missing), don't pretend it's USD
        // Use null for total_amount_usd so it's obvious the conversion failed
        let totalUsd: number | null;
        if (currency === "USD") {
          totalUsd = total;
        } else if (rate > 1) {
          totalUsd = total / rate;
        } else {
          // No valid exchange rate — estimate from order total (likely VES)
          // Mark rate as 0 to signal missing data
          rate = 0;
          totalUsd = null;
        }

        const shippingLines = o.shipping_lines || [];
        const shippingMethodTitle = shippingLines.map((s: any) => s.method_title).filter(Boolean).join(", ") || null;

        return {
          order_id: o.id,
          order_number: String(o.number || o.id),
          order_datetime: o.date_created_gmt ? o.date_created_gmt + "Z" : o.date_created,
          order_date: (o.date_created_gmt || o.date_created || "").split("T")[0] || null,
          order_status: o.status,
          sale_channel: extractSaleChannel(o.meta_data),
          billing_state: o.billing?.state || null,
          billing_name: [o.billing?.first_name, o.billing?.last_name].filter(Boolean).join(" ") || null,
          billing_address: [o.billing?.address_1, o.billing?.address_2].filter(Boolean).join(", ") || null,
          billing_city: o.billing?.city || null,
          billing_country: o.billing?.country || null,
          shipping_name: [o.shipping?.first_name, o.shipping?.last_name].filter(Boolean).join(" ") || null,
          shipping_address: [o.shipping?.address_1, o.shipping?.address_2].filter(Boolean).join(", ") || null,
          shipping_city: o.shipping?.city || null,
          shipping_country: o.shipping?.country || null,
          shipping_method: shippingMethodTitle,
          customer_note: o.customer_note || null,
          subtotal_amount: parseFloat(o.discount_total || "0") > 0
            ? total + parseFloat(o.discount_total || "0") - parseFloat(o.shipping_total || "0") - parseFloat(o.total_tax || "0")
            : total - parseFloat(o.shipping_total || "0") - parseFloat(o.total_tax || "0"),
          discount_amount: parseFloat(o.discount_total || "0"),
          shipping_amount: parseFloat(o.shipping_total || "0"),
          tax_amount: parseFloat(o.total_tax || "0"),
          refunded_amount: Math.abs(parseFloat(o.total_refunded || "0")),
          total_amount: total,
          total_amount_usd: totalUsd,
          exchange_rate: rate,
          order_currency: currency,
          customer_email: o.billing?.email || null,
          customer_phone: o.billing?.phone || null,
          payment_method: o.payment_method_title || o.payment_method || null,
          pago_metodo_1: getMetaValue(o.meta_data, "_basico_pago_metodo") || null,
          pago_metodo_2: getMetaValue(o.meta_data, "_basico_pago_metodo_2") || null,
          pago_metodo_3: getMetaValue(o.meta_data, "_basico_pago_metodo_3") || null,
          pago_metodo_4: getMetaValue(o.meta_data, "_basico_pago_metodo_4") || null,
          synced_at: new Date().toISOString(),
        };
      });

      const { error: ordErr } = await supabase.from("orders").upsert(orderRows, { onConflict: "order_id" });
      if (ordErr) console.error("Orders upsert error:", ordErr.message);
      syncedOrders += orderRows.length;

      // Order items
      const itemRows: any[] = [];
      for (const o of batch) {
        for (const li of (o.line_items || [])) {
          const sku = li.sku || null;
          const costInfo = sku ? costMap.get(sku) : null;
          const wcCatInfo = productCategoryMap.get(li.product_id) || null;
          const wcCategory = wcCatInfo?.category || null;
          const parentCategory = wcCatInfo?.parentCategory || null;
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
            analytic_category: costInfo?.category || wcCategory || null,
            product_category: wcCategory,
            parent_category: parentCategory,
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
        payment_method: o.payment_method_title || o.payment_method || (o.currency === "VES" ? "Pago en tienda (Bs)" : "Otro"),
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
