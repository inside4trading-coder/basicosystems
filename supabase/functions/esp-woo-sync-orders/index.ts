// Sincronización READ-ONLY de pedidos WooCommerce España -> esp_woo_orders / esp_woo_order_items
// + esp_sales (venta web) + esp_fabrication_requests (cuando aplica).
// Nunca escribe en WooCommerce. No descuenta inventario por sedes.
import { authorizeAction } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONFIRMED_STATUSES = ["processing", "completed"];
const EXCLUDED_STATUSES = ["cancelled", "refunded", "failed", "trash"];
const WEB_LOCATION_CODE = "WEB_ES";
const WEB_CHANNEL_KEY = "woocommerce_es";

function getWooConfig() {
  const key = Deno.env.get("WC_ES_CONSUMER_KEY");
  const secret = Deno.env.get("WC_ES_CONSUMER_SECRET");
  const baseRaw = (Deno.env.get("WC_ES_BASE_URL") || "https://basicoclothes.es").trim();
  if (!key || !secret) return null;
  const withProto = /^https?:\/\//i.test(baseRaw) ? baseRaw : `https://${baseRaw}`;
  const base = withProto.replace(/\/+$/, "") + "/wp-json/wc/v3";
  const auth = "Basic " + btoa(`${key}:${secret}`);
  return { base, auth, baseRaw };
}

async function wooGet(url: string, auth: string) {
  const r = await fetch(url, { headers: { Authorization: auth } });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Woo GET ${r.status}: ${text.slice(0, 200)}`);
  }
  return r.json();
}

function variantLabel(size: string | null, color: string | null) {
  return [size, color].filter(Boolean).join(" · ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const action = body.action || "sync";

  // Autorización funcional: admin siempre; otros roles requieren permiso de módulo.
  const { result: authz, admin } = await authorizeAction(req, "espana.orders.sync", action);
  if (!authz.ok) {
    return new Response(JSON.stringify({
      ok: false,
      error: authz.errorCode,
      message: authz.errorCode === "forbidden"
        ? "No tienes permiso para sincronizar pedidos WooCommerce España."
        : "Sesión no válida. Vuelve a iniciar sesión.",
    }), { status: authz.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const userId = authz.userId!;



  const cfg = getWooConfig();
  if (!cfg) {
    return new Response(JSON.stringify({
      ok: false, error: "missing_credentials",
      message: "Faltan secrets WC_ES_CONSUMER_KEY / WC_ES_CONSUMER_SECRET",
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (action === "test") {
    try {
      const r = await fetch(`${cfg.base}/orders?per_page=1`, { headers: { Authorization: cfg.auth } });
      const total = r.headers.get("X-WP-Total");
      return new Response(JSON.stringify({
        ok: r.ok, status: r.status, base_url: cfg.baseRaw, orders_total: total,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // SYNC ORDERS
  const params: any = {
    after: body.after || null,
    before: body.before || null,
    status: body.status || "any",
    per_page: Math.min(Number(body.per_page) || 50, 100),
    max_pages: Math.min(Number(body.max_pages) || 20, 100),
  };

  const summary = {
    orders_checked: 0, orders_created: 0, orders_updated: 0,
    items_checked: 0, items_created: 0, items_updated: 0,
    sales_created: 0, sales_updated: 0,
    fabrication_requests_created: 0,
    unmapped_items: 0,
    errors: [] as string[],
  };

  // Resolve channel + web location ids
  const { data: channel } = await admin.from("esp_sales_channels")
    .select("id").eq("key", WEB_CHANNEL_KEY).maybeSingle();
  const { data: webLoc } = await admin.from("esp_locations")
    .select("id").eq("code", WEB_LOCATION_CODE).maybeSingle();
  const channelId = channel?.id || null;
  const webLocationId = webLoc?.id || null;

  const { data: runRow, error: runErr } = await admin.from("esp_woo_order_sync_runs").insert({
    sync_type: "orders", status: "running", created_by: userId, params,
  }).select("id").single();
  if (runErr) {
    return new Response(JSON.stringify({ ok: false, error: runErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const runId = runRow.id;

  try {
    let page = 1;
    while (page <= params.max_pages) {
      const qs = new URLSearchParams();
      qs.set("per_page", String(params.per_page));
      qs.set("page", String(page));
      qs.set("orderby", "date");
      qs.set("order", "desc");
      if (params.status && params.status !== "any") qs.set("status", params.status);
      if (params.after) qs.set("after", params.after);
      if (params.before) qs.set("before", params.before);

      const orders: any[] = await wooGet(`${cfg.base}/orders?${qs.toString()}`, cfg.auth);
      if (!Array.isArray(orders) || orders.length === 0) break;

      for (const wo of orders) {
        summary.orders_checked++;
        try {
          const wooId: number = wo.id;
          const status: string = wo.status || "pending";
          const dateCreated = wo.date_created_gmt ? `${wo.date_created_gmt}Z` : wo.date_created || null;
          const datePaid = wo.date_paid_gmt ? `${wo.date_paid_gmt}Z` : wo.date_paid || null;
          const dateMod = wo.date_modified_gmt ? `${wo.date_modified_gmt}Z` : wo.date_modified || null;
          const billing = wo.billing || {};
          const shipping = wo.shipping || {};

          const orderPayload: any = {
            woo_order_id: wooId,
            order_number: wo.number || String(wooId),
            status,
            currency: wo.currency || "EUR",
            total_eur: Number(wo.total || 0),
            subtotal_eur: Number(wo.total || 0) - Number(wo.total_tax || 0) - Number(wo.shipping_total || 0) + Number(wo.discount_total || 0),
            discount_eur: Number(wo.discount_total || 0),
            shipping_total_eur: Number(wo.shipping_total || 0),
            total_tax_eur: Number(wo.total_tax || 0),
            payment_method: wo.payment_method || null,
            payment_method_title: wo.payment_method_title || null,
            customer_id: wo.customer_id || null,
            customer_name: `${billing.first_name || ""} ${billing.last_name || ""}`.trim() || null,
            customer_email: billing.email || null,
            customer_phone: billing.phone || null,
            billing_city: billing.city || null,
            billing_country: billing.country || null,
            shipping_city: shipping.city || null,
            shipping_country: shipping.country || null,
            billing_address_snapshot: billing,
            shipping_address_snapshot: shipping,
            date_created: dateCreated,
            date_paid: datePaid,
            date_modified: dateMod,
            source: "woocommerce_es",
            last_synced_at: new Date().toISOString(),
            raw_payload: wo,
          };

          // Upsert order
          const { data: existingOrder } = await admin.from("esp_woo_orders")
            .select("id, esp_sale_id").eq("woo_order_id", wooId).maybeSingle();

          let espWooOrderId: string;
          let espSaleId: string | null = existingOrder?.esp_sale_id ?? null;
          if (existingOrder) {
            const { error } = await admin.from("esp_woo_orders")
              .update(orderPayload).eq("id", existingOrder.id);
            if (error) throw new Error(`order update ${wooId}: ${error.message}`);
            espWooOrderId = existingOrder.id;
            summary.orders_updated++;
          } else {
            const { data, error } = await admin.from("esp_woo_orders")
              .insert(orderPayload).select("id").single();
            if (error) throw new Error(`order insert ${wooId}: ${error.message}`);
            espWooOrderId = data.id;
            summary.orders_created++;
          }

          // ---- Items ----
          type ResolvedItem = {
            wooItem: any;
            productId: string | null;
            variantId: string | null;
            productName: string;
            variantSize: string | null;
            variantColor: string | null;
            needsFabrication: boolean;
            unitPrice: number;
          };

          const resolved: ResolvedItem[] = [];
          const wooItems: any[] = Array.isArray(wo.line_items) ? wo.line_items : [];

          for (const li of wooItems) {
            summary.items_checked++;
            try {
              const wooVarId = li.variation_id || null;
              const wooProdId = li.product_id || null;
              const sku = (li.sku || "").trim() || null;

              let variantId: string | null = null;
              let productId: string | null = null;
              let isMadeToOrder = false;
              let pName = li.name || "";
              let vSize: string | null = null;
              let vColor: string | null = null;

              // Match variant
              if (wooVarId) {
                const { data: v } = await admin.from("esp_product_variants")
                  .select("id, product_id, size, color").eq("woo_variation_id", wooVarId).maybeSingle();
                if (v) { variantId = v.id; productId = v.product_id; vSize = v.size; vColor = v.color; }
              }
              if (!variantId && sku) {
                const { data: v } = await admin.from("esp_product_variants")
                  .select("id, product_id, size, color").eq("variant_sku", sku).maybeSingle();
                if (v) { variantId = v.id; productId = v.product_id; vSize = v.size; vColor = v.color; }
              }
              if (!productId && wooProdId) {
                const { data: p } = await admin.from("esp_products")
                  .select("id, name, is_made_to_order, requires_fabrication, fulfillment_mode").eq("woo_product_id", wooProdId).maybeSingle();
                if (p) {
                  productId = p.id; pName = p.name;
                  isMadeToOrder = !!p.is_made_to_order || !!p.requires_fabrication || p.fulfillment_mode === "made_to_order";
                }
              }
              if (productId && !isMadeToOrder) {
                const { data: p } = await admin.from("esp_products")
                  .select("name, is_made_to_order, requires_fabrication, fulfillment_mode").eq("id", productId).maybeSingle();
                if (p) {
                  pName = p.name;
                  isMadeToOrder = !!p.is_made_to_order || !!p.requires_fabrication || p.fulfillment_mode === "made_to_order";
                }
              }
              if (!variantId || !productId) summary.unmapped_items++;

              const qty = Number(li.quantity || 1);
              const subtotal = Number(li.subtotal || 0);
              const total = Number(li.total || 0);
              const unit = qty > 0 ? subtotal / qty : 0;

              const itemPayload: any = {
                esp_woo_order_id: espWooOrderId,
                woo_order_id: wooId,
                woo_order_item_id: li.id,
                product_id: productId,
                variant_id: variantId,
                woo_product_id: wooProdId,
                woo_variation_id: wooVarId,
                sku,
                name: pName || `WOO-${li.id}`,
                quantity: qty,
                subtotal_eur: subtotal,
                total_eur: total,
                unit_price_eur: unit,
                needs_fabrication: isMadeToOrder,
                raw_payload: li,
              };

              const { data: existingItem } = await admin.from("esp_woo_order_items")
                .select("id").eq("woo_order_id", wooId).eq("woo_order_item_id", li.id).maybeSingle();
              if (existingItem) {
                const { error } = await admin.from("esp_woo_order_items")
                  .update(itemPayload).eq("id", existingItem.id);
                if (error) throw new Error(`item update ${li.id}: ${error.message}`);
                summary.items_updated++;
              } else {
                const { error } = await admin.from("esp_woo_order_items").insert(itemPayload);
                if (error) throw new Error(`item insert ${li.id}: ${error.message}`);
                summary.items_created++;
              }

              resolved.push({
                wooItem: li, productId, variantId,
                productName: pName, variantSize: vSize, variantColor: vColor,
                needsFabrication: isMadeToOrder, unitPrice: unit,
              });
            } catch (e) {
              summary.errors.push(e instanceof Error ? e.message : String(e));
            }
          }

          // ---- esp_sales (sólo confirmados, no excluidos) ----
          const isConfirmed = CONFIRMED_STATUSES.includes(status);
          const isExcluded = EXCLUDED_STATUSES.includes(status);

          if (isConfirmed && !isExcluded) {
            const saleNumber = `ES-WOO-${wooId}`;
            const saleDate = datePaid || dateCreated || new Date().toISOString();
            const salePayload: any = {
              sale_number: saleNumber,
              channel_id: channelId,
              location_id: webLocationId,
              inventory_location_id: webLocationId,
              status: "completed",
              payment_status: "paid",
              source: "woocommerce_es",
              reference_type: "woocommerce_order",
              reference_id: String(wooId),
              external_order_number: wo.number || String(wooId),
              customer_name_snapshot: orderPayload.customer_name,
              customer_email_snapshot: orderPayload.customer_email,
              subtotal_eur: orderPayload.subtotal_eur,
              discount_eur: orderPayload.discount_eur,
              shipping_total_eur: orderPayload.shipping_total_eur,
              total_eur: orderPayload.total_eur,
              sale_date: saleDate,
              notes: `Pedido WooCommerce ES #${wo.number || wooId}`,
            };

            const { data: existingSale } = await admin.from("esp_sales")
              .select("id").eq("reference_type", "woocommerce_order")
              .eq("reference_id", String(wooId)).maybeSingle();

            let saleId: string;
            if (existingSale) {
              const { error } = await admin.from("esp_sales").update(salePayload).eq("id", existingSale.id);
              if (error) throw new Error(`sale update ${wooId}: ${error.message}`);
              saleId = existingSale.id;
              summary.sales_updated++;
            } else {
              const { data, error } = await admin.from("esp_sales")
                .insert({ ...salePayload, created_by: userId }).select("id").single();
              if (error) throw new Error(`sale insert ${wooId}: ${error.message}`);
              saleId = data.id;
              summary.sales_created++;
            }
            espSaleId = saleId;

            // Replace sale items (snapshot)
            await admin.from("esp_sale_items").delete().eq("sale_id", saleId).eq("source", "woocommerce_es");
            const saleItemsRows = resolved
              .filter(r => r.productId && r.variantId)
              .map(r => ({
                sale_id: saleId,
                product_id: r.productId,
                variant_id: r.variantId,
                sku_snapshot: r.wooItem.sku || null,
                product_name_snapshot: r.productName,
                variant_label_snapshot: variantLabel(r.variantSize, r.variantColor),
                quantity: Number(r.wooItem.quantity || 1),
                unit_price_eur: r.unitPrice,
                subtotal_eur: Number(r.wooItem.subtotal || 0),
                source: "woocommerce_es",
                woo_order_item_id: r.wooItem.id,
              }));
            if (saleItemsRows.length > 0) {
              const { error } = await admin.from("esp_sale_items").insert(saleItemsRows);
              if (error) throw new Error(`sale items insert ${wooId}: ${error.message}`);
            }

            // link sale to woo order
            await admin.from("esp_woo_orders").update({ esp_sale_id: saleId }).eq("id", espWooOrderId);
          }

          // ---- Fabricación ----
          if (isConfirmed && !isExcluded) {
            for (const r of resolved) {
              if (!r.needsFabrication) continue;
              const { data: existingItemRow } = await admin.from("esp_woo_order_items")
                .select("id").eq("woo_order_id", wooId).eq("woo_order_item_id", r.wooItem.id).maybeSingle();
              if (!existingItemRow) continue;

              const { data: existingFab } = await admin.from("esp_fabrication_requests")
                .select("id").eq("source_order_item_id", existingItemRow.id).maybeSingle();
              if (existingFab) continue;

              const { data: fab, error } = await admin.from("esp_fabrication_requests").insert({
                source_type: "woocommerce_order",
                source_order_id: espWooOrderId,
                source_order_item_id: existingItemRow.id,
                woo_order_id: wooId,
                woo_order_item_id: r.wooItem.id,
                product_id: r.productId,
                variant_id: r.variantId,
                sku: r.wooItem.sku || null,
                product_name: r.productName,
                variant_label: variantLabel(r.variantSize, r.variantColor),
                quantity: Number(r.wooItem.quantity || 1),
                status: "pending",
                priority: "normal",
                created_by: userId,
              }).select("id").single();
              if (error) {
                summary.errors.push(`fab insert ${wooId}/${r.wooItem.id}: ${error.message}`);
                continue;
              }
              await admin.from("esp_woo_order_items")
                .update({ fabrication_request_id: fab.id }).eq("id", existingItemRow.id);
              summary.fabrication_requests_created++;
            }
          }
        } catch (e) {
          summary.errors.push(e instanceof Error ? e.message : String(e));
        }
      }

      if (orders.length < params.per_page) break;
      page++;
    }

    await admin.from("esp_woo_order_sync_runs").update({
      status: summary.errors.length > 0 ? "completed_with_errors" : "completed",
      finished_at: new Date().toISOString(),
      orders_checked: summary.orders_checked,
      orders_created: summary.orders_created,
      orders_updated: summary.orders_updated,
      items_checked: summary.items_checked,
      items_created: summary.items_created,
      items_updated: summary.items_updated,
      sales_created: summary.sales_created,
      sales_updated: summary.sales_updated,
      fabrication_requests_created: summary.fabrication_requests_created,
      unmapped_items: summary.unmapped_items,
      errors_count: summary.errors.length,
      summary: { errors: summary.errors.slice(0, 50) },
    }).eq("id", runId);

    return new Response(JSON.stringify({ ok: true, run_id: runId, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from("esp_woo_order_sync_runs").update({
      status: "failed", finished_at: new Date().toISOString(),
      errors_count: summary.errors.length + 1,
      summary: { errors: [...summary.errors, msg].slice(0, 50) },
    }).eq("id", runId);
    return new Response(JSON.stringify({ ok: false, error: msg, ...summary }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
