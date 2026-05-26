import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONFIRMED_STATUSES = new Set([
  "processing",
  "pick-up-listo-par",
  "pedido-pick-up-re",
  "el-pedido-esta-si",
  "pedido-recibido-p",
  "recordartorio-de-",
  "tu-pedido-ha-sido",
  "pedido-listo-para",
  "tu-pago-fue-confi",
  "completed",
]);

const REVERTING_STATUSES = new Set([
  "cancelled",
  "refunded",
  "failed",
  "pago-pendiente-po",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth: validate JWT and role
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json({ error: "missing_token" }, 401);
  const { data: userData } = await supabase.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) return json({ error: "invalid_token" }, 401);
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roleSet = new Set((roles ?? []).map((r: any) => r.role));
  if (!roleSet.has("admin") && !roleSet.has("manager")) return json({ error: "forbidden" }, 403);

  // Optional period filter
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (body?.period_start) periodStart = String(body.period_start);
    if (body?.period_end) periodEnd = String(body.period_end);
  } catch { /* ignore */ }

  const summary: any = {
    orders_checked: 0,
    items_checked: 0,
    movements_created: 0,
    pending_items_created: 0,
    reversals_created: 0,
    errors_count: 0,
    skipped_existing: 0,
    by_fund: { general: 0, non_restockable: 0, pending: 0 },
    errors: [] as any[],
  };

  let runId: string | null = null;
  try {
    // Pre-load reference data
    const [
      { data: funds },
      { data: coreProducts },
      { data: coreVariants },
      { data: restock },
      { data: existingMovs },
      { data: existingPend },
    ] = await Promise.all([
      supabase.from("core_fabrication_funds").select("id, fund_type, currency, core_product_id"),
      supabase.from("core_products").select("id, core_sku, woo_sku, woo_product_id, name, unit_cost, is_restockable, currency, cost_snapshot"),
      supabase.from("core_product_variants").select("id, core_product_id, variant_sku, woo_sku, woo_variation_id, status, size, variant_label"),
      supabase.from("core_restock_control").select("sku, woo_product_id, woo_variation_id, core_product_id, core_variant_id, status, reason"),
      supabase.from("core_fabrication_fund_movements").select("source_order_id, source_order_item_id, movement_type, id, amount, fund_id, currency").not("source_order_item_id", "is", null),
      supabase.from("core_fabrication_fund_pending_items").select("source_order_id, source_order_item_id, id, status"),
    ]);

    const generalFundUSD = (funds ?? []).find((f: any) => f.fund_type === "general" && f.currency === "USD" && !f.core_product_id);
    const nonRestockFundUSD = (funds ?? []).find((f: any) => f.fund_type === "non_restockable" && f.currency === "USD" && !f.core_product_id);
    if (!generalFundUSD || !nonRestockFundUSD) {
      return json({ error: "missing_base_funds" }, 500);
    }

    // Index helpers
    const skuToVariant = new Map<string, any>();
    for (const v of coreVariants ?? []) {
      if (v.variant_sku) skuToVariant.set(String(v.variant_sku).trim().toLowerCase(), v);
      if (v.woo_sku) skuToVariant.set(String(v.woo_sku).trim().toLowerCase(), v);
    }
    const skuToProduct = new Map<string, any>();
    for (const p of coreProducts ?? []) {
      if (p.core_sku) skuToProduct.set(String(p.core_sku).trim().toLowerCase(), p);
      if (p.woo_sku) skuToProduct.set(String(p.woo_sku).trim().toLowerCase(), p);
    }
    const productById = new Map<string, any>();
    for (const p of coreProducts ?? []) productById.set(p.id, p);

    const activeRestock = (restock ?? []).filter((r: any) => r.status === "active");
    const restockSkuSet = new Set(
      activeRestock.filter((r: any) => r.sku).map((r: any) => String(r.sku).trim().toLowerCase())
    );
    const restockCoreProdSet = new Set(activeRestock.filter((r: any) => r.core_product_id).map((r: any) => r.core_product_id));
    const restockCoreVarSet = new Set(activeRestock.filter((r: any) => r.core_variant_id).map((r: any) => r.core_variant_id));

    const movKey = (oid: number | null, iid: number | null, mt: string) => `${oid}|${iid}|${mt}`;
    const movByKey = new Map<string, any>();
    for (const m of existingMovs ?? []) movByKey.set(movKey(m.source_order_id, m.source_order_item_id, m.movement_type), m);

    const pendKey = (oid: number | null, iid: number | null) => `${oid}|${iid}`;
    const pendByKey = new Map<string, any>();
    for (const p of existingPend ?? []) pendByKey.set(pendKey(p.source_order_id, p.source_order_item_id), p);

    // Create run row
    const { data: runRow } = await supabase.from("core_fabrication_fund_runs").insert({
      run_type: "process_sales",
      status: "completed",
      summary: {},
      created_by: userId,
    }).select().single();
    runId = runRow?.id ?? null;

    // ---- Pass 1: confirmed orders → generate movements / pendings ----
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data: orders, error: ordErr } = await supabase
        .from("orders")
        .select("order_id, order_status, order_datetime")
        .in("order_status", Array.from(CONFIRMED_STATUSES))
        .order("order_id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (ordErr) throw ordErr;
      if (!orders || orders.length === 0) break;
      summary.orders_checked += orders.length;

      const orderIds = orders.map((o: any) => o.order_id);
      const orderById = new Map(orders.map((o: any) => [o.order_id, o]));
      const { data: items } = await supabase
        .from("order_items")
        .select("order_id, line_item_id, sku, parent_sku, product_name, quantity, line_total, unit_price")
        .in("order_id", orderIds);

      for (const it of items ?? []) {
        summary.items_checked += 1;
        const oid = it.order_id;
        const iid = it.line_item_id;
        const order = orderById.get(oid);
        if (!order) continue;

        // Skip if any sale movement already exists for this item
        if (
          movByKey.has(movKey(oid, iid, "sale_generated")) ||
          movByKey.has(movKey(oid, iid, "sale_generated_non_restockable"))
        ) {
          summary.skipped_existing += 1;
          continue;
        }

        const skuLower = (it.sku || it.parent_sku || "").toString().trim().toLowerCase();
        const variant = skuLower ? skuToVariant.get(skuLower) : null;
        const product = variant
          ? productById.get(variant.core_product_id)
          : (skuLower ? skuToProduct.get(skuLower) : null);

        // Missing SKU
        if (!skuLower) {
          await upsertPending({
            supabase, pendByKey, oid, iid, it, order, runId, reason: "missing_sku",
            suggested: "Asignar SKU al producto Woo",
          });
          summary.pending_items_created += 1;
          continue;
        }

        // No core product mapped
        if (!product) {
          await upsertPending({
            supabase, pendByKey, oid, iid, it, order, runId, reason: "product_not_in_core",
            suggested: "Crear Producto Core o asociar",
          });
          summary.pending_items_created += 1;
          continue;
        }

        // Determine cost from snapshot or product
        const unitCost = Number(product.unit_cost ?? 0);
        if (!unitCost || unitCost <= 0) {
          await upsertPending({
            supabase, pendByKey, oid, iid, it, order, runId, reason: "missing_cost",
            suggested: "Asignar estructura de costos / snapshot",
          });
          summary.pending_items_created += 1;
          continue;
        }

        // Restock classification
        const isNonRestock =
          restockSkuSet.has(skuLower) ||
          restockCoreProdSet.has(product.id) ||
          (variant && restockCoreVarSet.has(variant.id)) ||
          product.is_restockable === false ||
          (variant && variant.status === "inactive");

        const qty = Number(it.quantity ?? 0) || 0;
        if (qty <= 0) {
          await upsertPending({
            supabase, pendByKey, oid, iid, it, order, runId, reason: "sync_error",
            suggested: "Cantidad inválida en la línea de pedido",
          });
          summary.pending_items_created += 1;
          continue;
        }

        const amount = +(qty * unitCost).toFixed(4);
        const fund = isNonRestock ? nonRestockFundUSD : generalFundUSD;
        const movementType = isNonRestock ? "sale_generated_non_restockable" : "sale_generated";

        const { error: insErr } = await supabase.from("core_fabrication_fund_movements").insert({
          fund_id: fund.id,
          fabrication_fund_run_id: runId,
          movement_type: movementType,
          source: "woocommerce",
          source_order_id: oid,
          source_order_item_id: iid,
          core_product_id: product.id,
          core_variant_id: variant?.id ?? null,
          sku: it.sku ?? it.parent_sku ?? null,
          product_name: it.product_name ?? product.name ?? null,
          quantity: qty,
          unit_cost_snapshot: unitCost,
          cost_snapshot_data: product.cost_snapshot ?? null,
          amount,
          currency: product.currency || "USD",
          reason: isNonRestock ? "Venta confirmada (no restockeable)" : "Venta confirmada",
          status: "posted",
          created_by: userId,
        });
        if (insErr) {
          // Likely unique conflict from a race — count as skipped
          if ((insErr as any).code === "23505") {
            summary.skipped_existing += 1;
          } else {
            summary.errors_count += 1;
            summary.errors.push({ oid, iid, error: insErr.message });
          }
          continue;
        }

        // Update fund balance
        await supabase
          .from("core_fabrication_funds")
          .update({ available_amount: roundAmt((await currentFund(supabase, fund.id)) + amount) })
          .eq("id", fund.id);

        summary.movements_created += 1;
        if (isNonRestock) summary.by_fund.non_restockable += 1; else summary.by_fund.general += 1;
        movByKey.set(movKey(oid, iid, movementType), { source_order_id: oid, source_order_item_id: iid, movement_type: movementType });

        // If pending existed, mark resolved
        const existingPendRow = pendByKey.get(pendKey(oid, iid));
        if (existingPendRow && existingPendRow.status === "pending") {
          await supabase.from("core_fabrication_fund_pending_items")
            .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: userId })
            .eq("id", existingPendRow.id);
        }
      }

      if (orders.length < pageSize) break;
      from += pageSize;
    }

    // ---- Pass 2: reverting orders → generate reversals ----
    let from2 = 0;
    while (true) {
      const { data: orders2 } = await supabase
        .from("orders")
        .select("order_id, order_status")
        .in("order_status", Array.from(REVERTING_STATUSES))
        .order("order_id", { ascending: true })
        .range(from2, from2 + pageSize - 1);
      if (!orders2 || orders2.length === 0) break;
      const orderIds2 = orders2.map((o: any) => o.order_id);
      const orderStatusMap = new Map(orders2.map((o: any) => [o.order_id, o.order_status]));
      const { data: movs } = await supabase
        .from("core_fabrication_fund_movements")
        .select("id, source_order_id, source_order_item_id, fund_id, amount, currency, sku, product_name, core_product_id, core_variant_id, woo_product_id, woo_variation_id, movement_type, status")
        .in("source_order_id", orderIds2)
        .in("movement_type", ["sale_generated", "sale_generated_non_restockable"])
        .neq("status", "reversed");

      for (const m of movs ?? []) {
        // Skip if a reversal exists
        if (movByKey.has(movKey(m.source_order_id, m.source_order_item_id, "reversal"))) continue;
        const status = orderStatusMap.get(m.source_order_id);
        const { data: rev, error: revErr } = await supabase.from("core_fabrication_fund_movements").insert({
          fund_id: m.fund_id,
          fabrication_fund_run_id: runId,
          movement_type: "reversal",
          source: "system",
          source_order_id: m.source_order_id,
          source_order_item_id: m.source_order_item_id,
          core_product_id: m.core_product_id,
          core_variant_id: m.core_variant_id,
          sku: m.sku,
          product_name: m.product_name,
          quantity: null,
          amount: -Number(m.amount),
          currency: m.currency,
          related_movement_id: m.id,
          reason: `Reverso por estado ${status}`,
          status: "posted",
          created_by: userId,
        }).select().single();
        if (revErr) {
          if ((revErr as any).code === "23505") continue;
          summary.errors_count += 1;
          summary.errors.push({ order: m.source_order_id, error: revErr.message });
          continue;
        }
        // mark original as reversed
        await supabase.from("core_fabrication_fund_movements").update({ status: "reversed" }).eq("id", m.id);
        // update fund balance
        const newBal = roundAmt((await currentFund(supabase, m.fund_id)) - Number(m.amount));
        await supabase.from("core_fabrication_funds").update({ available_amount: newBal }).eq("id", m.fund_id);
        summary.reversals_created += 1;
        movByKey.set(movKey(m.source_order_id, m.source_order_item_id, "reversal"), rev);
      }

      if (orders2.length < pageSize) break;
      from2 += pageSize;
    }

    const finalStatus = summary.errors_count > 0 ? "completed_warnings" : "completed";
    if (runId) {
      await supabase.from("core_fabrication_fund_runs").update({
        status: finalStatus,
        orders_checked: summary.orders_checked,
        items_checked: summary.items_checked,
        movements_created: summary.movements_created,
        pending_items_created: summary.pending_items_created,
        reversals_created: summary.reversals_created,
        errors_count: summary.errors_count,
        summary,
      }).eq("id", runId);
    }

    return json({ ok: true, run_id: runId, summary });
  } catch (e) {
    console.error("process-fabrication-funds error:", e);
    if (runId) {
      await supabase.from("core_fabrication_fund_runs").update({
        status: "failed",
        summary: { ...summary, error: String((e as Error).message) },
      }).eq("id", runId);
    }
    return json({ error: String((e as Error).message) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function roundAmt(n: number) { return Math.round(n * 10000) / 10000; }
async function currentFund(supabase: any, id: string) {
  const { data } = await supabase.from("core_fabrication_funds").select("available_amount").eq("id", id).single();
  return Number(data?.available_amount ?? 0);
}
async function upsertPending(opts: {
  supabase: any; pendByKey: Map<string, any>; oid: number; iid: number | null; it: any; order: any;
  reason: string; suggested: string; runId?: string | null;
}) {
  const { supabase, pendByKey, oid, iid, it, order, reason, suggested, runId } = opts;
  const key = `${oid}|${iid}`;
  const existing = pendByKey.get(key);
  const payload = {
    source_order_id: oid,
    source_order_item_id: iid,
    woo_sku: it.sku ?? it.parent_sku ?? null,
    product_name: it.product_name ?? null,
    quantity: it.quantity ?? null,
    revenue: it.line_total ?? null,
    order_status: order?.order_status ?? null,
    reason,
    suggested_action: suggested,
    status: "pending",
    fabrication_fund_run_id: runId ?? null,
  };
  if (existing) {
    if (existing.status === "ignored" || existing.status === "resolved") return;
    await supabase.from("core_fabrication_fund_pending_items")
      .update({ reason, suggested_action: suggested, order_status: order?.order_status ?? null, fabrication_fund_run_id: runId ?? null })
      .eq("id", existing.id);
  } else {
    const { data } = await supabase.from("core_fabrication_fund_pending_items").insert(payload).select().single();
    if (data) pendByKey.set(key, data);
  }
}

