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
  "ml-pago-por-confi",
  "fabricacion",
  "enviado",
  "completed",
]);

const REVERTING_STATUSES = new Set([
  "cancelled",
  "refunded",
  "failed",
  "pago-pendiente-po",
]);

// Resolves the effective unit cost via public.resolve_core_operational_unit_cost.
// Falls back through: variant override → base structure → policy manual → external
// supplier → core_products manual mirror → unit_cost → zero.
async function resolveVariantUnitCost(
  supabase: any,
  product: any,
  variant: any,
  wooProductId?: number | null,
  wooVariationId?: number | null,
): Promise<{
  unit_cost: number;
  cost_source: string;
  policy_id: string | null;
  resolved_core_product_id: string | null;
  resolved_core_variant_id: string | null;
  woo_product_id: number | null;
  woo_variation_id: number | null;
  warning: string | null;
}> {
  const { data, error } = await supabase.rpc("resolve_core_operational_unit_cost", {
    p_core_product_id: product?.id ?? null,
    p_core_variant_id: variant?.id ?? null,
    p_woo_product_id: wooProductId ?? product?.woo_product_id ?? null,
    p_woo_variation_id: wooVariationId ?? variant?.woo_variation_id ?? null,
  });
  if (error) {
    console.warn("resolve_core_operational_unit_cost failed", error?.message);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    unit_cost: Number(row?.unit_cost ?? 0) || 0,
    cost_source: row?.cost_source ?? "zero_fallback",
    policy_id: row?.policy_id ?? null,
    resolved_core_product_id: row?.core_product_id ?? null,
    resolved_core_variant_id: row?.core_variant_id ?? null,
    woo_product_id: row?.woo_product_id ?? null,
    woo_variation_id: row?.woo_variation_id ?? null,
    warning: row?.warning ?? null,
  };
}

// Unified replenishment routing engine.
// Calls the SQL RPC route_core_replenishment_candidate which is the single
// source of truth for policy decisions AND idempotent event upsert.
async function routeReplenishment(
  supabase: any,
  args: {
    source_type: string;
    source_key: string;               // free-form idempotency key per origin
    source_id?: string | null;        // uuid when applicable (pending_item.id)
    product: any;
    variant: any;
    woo_product_id?: number | null;
    woo_variation_id?: number | null;
    woo_order_id?: number | null;
    woo_order_item_id?: number | null;
    quantity?: number | null;
    unit_cost?: number | null;
    amount?: number | null;
    cost_source?: string | null;
    created_by?: string | null;
    dry_run?: boolean;
  },
): Promise<any> {
  const { data, error } = await supabase.rpc("route_core_replenishment_candidate", {
    p_source_type: args.source_type,
    p_source_key: args.source_key,
    p_source_id: args.source_id ?? null,
    p_core_product_id: args.product?.id ?? null,
    p_core_variant_id: args.variant?.id ?? null,
    p_woo_product_id: args.woo_product_id ?? args.product?.woo_product_id ?? null,
    p_woo_variation_id: args.woo_variation_id ?? args.variant?.woo_variation_id ?? null,
    p_woo_order_id: args.woo_order_id ?? null,
    p_woo_order_item_id: args.woo_order_item_id ?? null,
    p_quantity: args.quantity ?? null,
    p_unit_cost: args.unit_cost ?? null,
    p_amount: args.amount ?? null,
    p_cost_source: args.cost_source ?? null,
    p_created_by: args.created_by ?? null,
    p_dry_run: args.dry_run ?? false,
  });
  if (error) {
    console.warn("route_core_replenishment_candidate failed", error?.message);
    return { route_action: "allow_internal_factory", allow_internal_need: true, severity: "allow" };
  }
  return data ?? { route_action: "allow_internal_factory", allow_internal_need: true, severity: "allow" };
}




serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json({ error: "missing_token" }, 401);
  const { data: userData } = await supabase.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) return json({ error: "invalid_token" }, 401);
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roleSet = new Set((roles ?? []).map((r: any) => r.role));
  if (!roleSet.has("admin") && !roleSet.has("manager")) return json({ error: "forbidden" }, 403);

  // Parse body
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  let mode: string = "process_sales";
  let pendingIds: string[] | undefined;
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (body?.period_start) periodStart = String(body.period_start);
    if (body?.period_end) periodEnd = String(body.period_end);
    if (body?.mode) mode = String(body.mode);
    if (Array.isArray(body?.pending_ids)) pendingIds = body.pending_ids.map(String);
  } catch { /* ignore */ }

  if (mode === "reprocess_pending") {
    return await runReprocess(supabase, userId, pendingIds);
  }
  return await runProcessSales(supabase, userId, periodStart, periodEnd);
});

// ============================================================
// PROCESS SALES
// ============================================================
async function runProcessSales(
  supabase: any,
  userId: string,
  periodStart: string | null,
  periodEnd: string | null,
) {
  const summary: any = {
    orders_checked: 0,
    items_checked: 0,
    movements_created: 0,
    pending_items_created: 0,
    reversals_created: 0,
    errors_count: 0,
    skipped_existing: 0,
    by_fund: { general: 0, non_restockable: 0, pending: 0 },
    by_reason: {} as Record<string, number>,
    errors: [] as any[],
  };

  let runId: string | null = null;
  try {
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
      supabase.from("core_product_variants").select("id, core_product_id, variant_sku, woo_sku, woo_variation_id, status, size, variant_label, cost_override_enabled, cost_structure_id, variant_unit_cost_usd"),
      supabase.from("core_restock_control").select("sku, woo_product_id, woo_variation_id, core_product_id, core_variant_id, status, reason"),
      supabase.from("core_fabrication_fund_movements").select("source_order_id, source_order_item_id, movement_type, id, amount, fund_id, currency").not("source_order_item_id", "is", null),
      supabase.from("core_fabrication_fund_pending_items").select("source_order_id, source_order_item_id, id, status"),
    ]);

    const generalFundUSD = (funds ?? []).find((f: any) => f.fund_type === "general" && f.currency === "USD" && !f.core_product_id);
    const nonRestockFundUSD = (funds ?? []).find((f: any) => f.fund_type === "non_restockable" && f.currency === "USD" && !f.core_product_id);
    if (!generalFundUSD || !nonRestockFundUSD) return json({ error: "missing_base_funds" }, 500);

    const skuToVariant = new Map<string, any>();
    for (const v of coreVariants ?? []) {
      if (v.variant_sku) skuToVariant.set(String(v.variant_sku).trim().toLowerCase(), v);
      if (v.woo_sku) skuToVariant.set(String(v.woo_sku).trim().toLowerCase(), v);
    }
    const variationIdToVariant = new Map<number, any>();
    for (const v of coreVariants ?? []) {
      if (v.woo_variation_id) variationIdToVariant.set(Number(v.woo_variation_id), v);
    }
    const skuToProduct = new Map<string, any>();
    for (const p of coreProducts ?? []) {
      if (p.core_sku) skuToProduct.set(String(p.core_sku).trim().toLowerCase(), p);
      if (p.woo_sku) skuToProduct.set(String(p.woo_sku).trim().toLowerCase(), p);
    }
    const wooProductIdToProduct = new Map<number, any>();
    for (const p of coreProducts ?? []) {
      if (p.woo_product_id) wooProductIdToProduct.set(Number(p.woo_product_id), p);
    }
    const productById = new Map<string, any>();
    for (const p of coreProducts ?? []) productById.set(p.id, p);

    const activeRestock = (restock ?? []).filter((r: any) => r.status === "active");
    const restockSkuSet = new Set(
      activeRestock.filter((r: any) => r.sku).map((r: any) => String(r.sku).trim().toLowerCase())
    );
    const restockWooProdSet = new Set(activeRestock.filter((r: any) => r.woo_product_id).map((r: any) => Number(r.woo_product_id)));
    const restockWooVarSet = new Set(activeRestock.filter((r: any) => r.woo_variation_id).map((r: any) => Number(r.woo_variation_id)));
    const restockCoreProdSet = new Set(activeRestock.filter((r: any) => r.core_product_id).map((r: any) => r.core_product_id));
    const restockCoreVarSet = new Set(activeRestock.filter((r: any) => r.core_variant_id).map((r: any) => r.core_variant_id));

    const movKey = (oid: number | null, iid: number | null, mt: string) => `${oid}|${iid}|${mt}`;
    const movByKey = new Map<string, any>();
    for (const m of existingMovs ?? []) movByKey.set(movKey(m.source_order_id, m.source_order_item_id, m.movement_type), m);

    const pendKey = (oid: number | null, iid: number | null) => `${oid}|${iid}`;
    const pendByKey = new Map<string, any>();
    for (const p of existingPend ?? []) pendByKey.set(pendKey(p.source_order_id, p.source_order_item_id), p);

    const { data: runRow } = await supabase.from("core_fabrication_fund_runs").insert({
      run_type: "process_sales",
      status: "completed",
      summary: {},
      period_start: periodStart,
      period_end: periodEnd,
      created_by: userId,
    }).select().single();
    runId = runRow?.id ?? null;

    const fundDeltas = new Map<string, number>();
    const pendingInserts: any[] = [];
    const pendingUpdates: { id: string; reason: string; suggested: string; order_status: string | null }[] = [];
    const movementInserts: any[] = [];
    const resolvedPendingIds: string[] = [];

    const incReason = (r: string) => { summary.by_reason[r] = (summary.by_reason[r] ?? 0) + 1; };

    const pageSize = 1000;
    let from = 0;
    while (true) {
      let q = supabase
        .from("orders")
        .select("order_id, order_status, order_datetime")
        .in("order_status", Array.from(CONFIRMED_STATUSES));
      if (periodStart) q = q.gte("order_datetime", periodStart);
      if (periodEnd) q = q.lte("order_datetime", periodEnd);
      const { data: orders, error: ordErr } = await q.order("order_id", { ascending: true }).range(from, from + pageSize - 1);
      if (ordErr) throw ordErr;
      if (!orders || orders.length === 0) break;
      summary.orders_checked += orders.length;

      const orderIds = orders.map((o: any) => o.order_id);
      const orderById = new Map(orders.map((o: any) => [o.order_id, o]));
      const { data: items } = await supabase
        .from("order_items")
        .select("order_id, line_item_id, sku, parent_sku, product_id, variation_id, product_name, quantity, line_total, line_total_usd, unit_price")
        .in("order_id", orderIds);

      for (const it of items ?? []) {
        summary.items_checked += 1;
        const oid = it.order_id;
        const iid = it.line_item_id;
        const order = orderById.get(oid);
        if (!order) continue;

        if (movByKey.has(movKey(oid, iid, "sale_generated")) || movByKey.has(movKey(oid, iid, "sale_generated_non_restockable"))) {
          summary.skipped_existing += 1;
          continue;
        }

        const skuLower = (it.sku || it.parent_sku || "").toString().trim().toLowerCase();
        const wooProdId = it.product_id ? Number(it.product_id) : null;
        const wooVarId = it.variation_id ? Number(it.variation_id) : null;

        // Resolve product/variant by SKU, then by Woo IDs
        let variant: any = skuLower ? skuToVariant.get(skuLower) : null;
        if (!variant && wooVarId) variant = variationIdToVariant.get(wooVarId);
        let product: any = variant ? productById.get(variant.core_product_id) : (skuLower ? skuToProduct.get(skuLower) : null);
        if (!product && wooProdId) product = wooProductIdToProduct.get(wooProdId);

        const queuePending = (reason: string, suggested: string) => {
          const key = pendKey(oid, iid);
          const existing = pendByKey.get(key);
          if (existing) {
            if (existing.status === "ignored" || existing.status === "resolved" || existing.status === "processed") return;
            pendingUpdates.push({ id: existing.id, reason, suggested, order_status: order?.order_status ?? null });
          } else {
            pendingInserts.push({
              source_order_id: oid, source_order_item_id: iid,
              woo_product_id: wooProdId, woo_variation_id: wooVarId,
              woo_sku: it.sku ?? it.parent_sku ?? null,
              product_name: it.product_name ?? null,
              quantity: it.quantity ?? null, revenue: it.line_total_usd ?? null,
              order_status: order?.order_status ?? null,
              reason, suggested_action: suggested, status: "pending",
              fabrication_fund_run_id: runId,
            });
            pendByKey.set(key, { id: "queued", status: "pending" });
          }
          summary.pending_items_created += 1;
          incReason(reason);
        };

        if (!skuLower && !wooProdId) { queuePending("missing_sku", "Asignar SKU al producto Woo"); continue; }
        if (!product) {
          // Has variation_id but no Core mapping for that variation
          if (wooVarId && !variant) {
            queuePending("variation_not_mapped", "Asociar la variante Woo a una variante Core");
          } else {
            queuePending("product_not_in_core", "Crear Producto Core o asociar al SKU/Woo ID");
          }
          continue;
        }
        // Producto resuelto pero variante Woo sin mapear → auto-crear desde SKU padre / Woo IDs
        if (wooVarId && !variant) {
          const autoSize = deriveSizeFromItem(it, product);
          if (!autoSize) {
            queuePending(
              "variation_not_mapped",
              `No se pudo derivar talla automáticamente del SKU "${it.sku ?? ""}" (parent "${it.parent_sku ?? ""}"). Asociar variante manualmente.`,
            );
            continue;
          }
          const wooSku = (it.sku ?? "").toString().trim() || null;
          const variantSku = wooSku ? wooSku.replace(/\s+/g, "-") : null;
          const { data: createdVar, error: createVarErr } = await supabase
            .from("core_product_variants")
            .insert({
              core_product_id: product.id,
              size: autoSize,
              variant_label: autoSize,
              status: "active",
              woo_variation_id: wooVarId,
              woo_sku: wooSku,
              variant_sku: variantSku,
            })
            .select("id, core_product_id, variant_sku, woo_sku, woo_variation_id, status, size, variant_label, cost_override_enabled, cost_structure_id, variant_unit_cost_usd")
            .single();
          if (createVarErr || !createdVar) {
            queuePending(
              "variation_not_mapped",
              `Falló auto-creación de variante para wooVarId ${wooVarId}: ${createVarErr?.message ?? "desconocido"}`,
            );
            continue;
          }
          // Registrar y cachear para próximos ítems del mismo run
          variationIdToVariant.set(Number(wooVarId), createdVar);
          if (createdVar.variant_sku) skuToVariant.set(createdVar.variant_sku.toLowerCase(), createdVar);
          if (createdVar.woo_sku) skuToVariant.set(createdVar.woo_sku.toLowerCase(), createdVar);
          variant = createdVar;
          summary.by_reason["variant_auto_created"] = (summary.by_reason["variant_auto_created"] ?? 0) + 1;
        }

        const resolved = await resolveVariantUnitCost(supabase, product, variant, wooProdId, wooVarId);
        const unitCost = resolved.unit_cost;

        const qtyPre = Number(it.quantity ?? 0) || 0;

        // Central routing engine: single point of decision + idempotent event upsert.
        const route = await routeReplenishment(supabase, {
          source_type: "woo_order_item",
          source_key: `woo_order_item:${oid}:${iid}`,
          product,
          variant,
          woo_product_id: wooProdId,
          woo_variation_id: wooVarId,
          woo_order_id: oid,
          woo_order_item_id: iid,
          quantity: qtyPre,
          unit_cost: unitCost || null,
          amount: unitCost && qtyPre ? +(qtyPre * unitCost).toFixed(4) : null,
          cost_source: resolved.cost_source,
          created_by: userId,
        });

        const action = route?.route_action ?? "allow_internal_factory";
        if (!route?.allow_internal_need) {
          summary.by_reason[`policy_${action}`] = (summary.by_reason[`policy_${action}`] ?? 0) + 1;
          continue;
        }

        if (!unitCost || unitCost <= 0) {
          queuePending(
            "unit_cost_missing",
            `Sin costo resuelto (source=${resolved.cost_source}). Configura estructura, costo manual en política o costo unitario.`,
          );
          continue;
        }


        const isNonRestock =
          (skuLower && restockSkuSet.has(skuLower)) ||
          (wooProdId && restockWooProdSet.has(wooProdId)) ||
          (wooVarId && restockWooVarSet.has(wooVarId)) ||
          restockCoreProdSet.has(product.id) ||
          (variant && restockCoreVarSet.has(variant.id)) ||
          product.is_restockable === false ||
          (variant && variant.status === "inactive");

        const qty = Number(it.quantity ?? 0) || 0;
        if (qty <= 0) { queuePending("sync_error", "Cantidad inválida en la línea de pedido"); continue; }

        const amount = +(qty * unitCost).toFixed(4);
        const fund = isNonRestock ? nonRestockFundUSD : generalFundUSD;
        const movementType = isNonRestock ? "sale_generated_non_restockable" : "sale_generated";

        movementInserts.push({
          fund_id: fund.id,
          fabrication_fund_run_id: runId,
          movement_type: movementType,
          source: "woocommerce",
          source_order_id: oid,
          source_order_item_id: iid,
          woo_product_id: wooProdId,
          woo_variation_id: wooVarId,
          core_product_id: product.id,
          core_variant_id: variant?.id ?? null,
          sku: it.sku ?? it.parent_sku ?? null,
          product_name: it.product_name ?? product.name ?? null,
          quantity: qty,
          unit_cost_snapshot: unitCost,
          cost_snapshot_data: {
            ...(product.cost_snapshot ?? {}),
            cost_source: resolved.cost_source,
            policy_id: resolved.policy_id,
            policy_action: action,
            replenishment_route: null,
            lifecycle_status: null,
            resolved_core_product_id: resolved.resolved_core_product_id ?? product.id,
            resolved_core_variant_id: resolved.resolved_core_variant_id ?? variant?.id ?? null,
            resolved_variant_id: variant?.id ?? null,
            woo_product_id: resolved.woo_product_id ?? wooProdId ?? null,
            woo_variation_id: resolved.woo_variation_id ?? wooVarId ?? null,
            warning: resolved.warning,
          },

          amount,
          currency: product.currency || "USD",
          reason: isNonRestock ? "Venta confirmada (no restockeable)" : "Venta confirmada",
          status: "posted",
          created_by: userId,
        });

        fundDeltas.set(fund.id, (fundDeltas.get(fund.id) ?? 0) + amount);
        movByKey.set(movKey(oid, iid, movementType), { source_order_id: oid, source_order_item_id: iid, movement_type: movementType });
        if (isNonRestock) summary.by_fund.non_restockable += 1; else summary.by_fund.general += 1;

        const existingPendRow = pendByKey.get(pendKey(oid, iid));
        if (existingPendRow && existingPendRow.id !== "queued" && existingPendRow.status === "pending") {
          resolvedPendingIds.push(existingPendRow.id);
        }
      }

      if (orders.length < pageSize) break;
      from += pageSize;
    }

    const chunk = <T,>(arr: T[], n: number) => { const out: T[][] = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
    for (const batch of chunk(movementInserts, 500)) {
      const { error, count } = await supabase.from("core_fabrication_fund_movements").insert(batch, { count: "exact" });
      if (error) {
        for (const row of batch) {
          const { error: e1 } = await supabase.from("core_fabrication_fund_movements").insert(row);
          if (!e1) summary.movements_created += 1;
          else if ((e1 as any).code === "23505") summary.skipped_existing += 1;
          else { summary.errors_count += 1; summary.errors.push({ error: e1.message }); }
        }
      } else {
        summary.movements_created += count ?? batch.length;
      }
    }
    for (const batch of chunk(pendingInserts, 500)) {
      const { error } = await supabase.from("core_fabrication_fund_pending_items").insert(batch);
      if (error) { summary.errors_count += 1; summary.errors.push({ error: error.message }); }
    }
    for (const u of pendingUpdates) {
      await supabase.from("core_fabrication_fund_pending_items")
        .update({ reason: u.reason, suggested_action: u.suggested, order_status: u.order_status, fabrication_fund_run_id: runId })
        .eq("id", u.id);
    }
    if (resolvedPendingIds.length > 0) {
      for (const batch of chunk(resolvedPendingIds, 500)) {
        await supabase.from("core_fabrication_fund_pending_items")
          .update({ status: "processed", resolved_at: new Date().toISOString(), resolved_by: userId })
          .in("id", batch);
      }
    }
    for (const [fundId, delta] of fundDeltas) {
      const cur = await currentFund(supabase, fundId);
      await supabase.from("core_fabrication_funds").update({ available_amount: roundAmt(cur + delta) }).eq("id", fundId);
    }

    // Reversals
    const revInserts: any[] = [];
    const revOriginalIds: string[] = [];
    const revFundDeltas = new Map<string, number>();
    let from2 = 0;
    while (true) {
      const { data: orders2 } = await supabase
        .from("orders").select("order_id, order_status")
        .in("order_status", Array.from(REVERTING_STATUSES))
        .order("order_id", { ascending: true }).range(from2, from2 + pageSize - 1);
      if (!orders2 || orders2.length === 0) break;
      const orderIds2 = orders2.map((o: any) => o.order_id);
      const orderStatusMap = new Map(orders2.map((o: any) => [o.order_id, o.order_status]));
      const { data: movs } = await supabase
        .from("core_fabrication_fund_movements")
        .select("id, source_order_id, source_order_item_id, fund_id, amount, currency, sku, product_name, core_product_id, core_variant_id, movement_type, status")
        .in("source_order_id", orderIds2)
        .in("movement_type", ["sale_generated", "sale_generated_non_restockable"])
        .neq("status", "reversed");

      for (const m of movs ?? []) {
        if (movByKey.has(movKey(m.source_order_id, m.source_order_item_id, "reversal"))) continue;
        const status = orderStatusMap.get(m.source_order_id);
        revInserts.push({
          fund_id: m.fund_id, fabrication_fund_run_id: runId, movement_type: "reversal", source: "system",
          source_order_id: m.source_order_id, source_order_item_id: m.source_order_item_id,
          core_product_id: m.core_product_id, core_variant_id: m.core_variant_id,
          sku: m.sku, product_name: m.product_name, quantity: null,
          amount: -Number(m.amount), currency: m.currency,
          related_movement_id: m.id, reason: `Reverso por estado ${status}`,
          status: "posted", created_by: userId,
        });
        revOriginalIds.push(m.id);
        revFundDeltas.set(m.fund_id, (revFundDeltas.get(m.fund_id) ?? 0) - Number(m.amount));
        movByKey.set(movKey(m.source_order_id, m.source_order_item_id, "reversal"), { id: "queued" });
      }
      if (orders2.length < pageSize) break;
      from2 += pageSize;
    }
    for (const batch of chunk(revInserts, 500)) {
      const { error, count } = await supabase.from("core_fabrication_fund_movements").insert(batch, { count: "exact" });
      if (error) {
        for (const row of batch) {
          const { error: e1 } = await supabase.from("core_fabrication_fund_movements").insert(row);
          if (!e1) summary.reversals_created += 1;
          else if ((e1 as any).code !== "23505") { summary.errors_count += 1; summary.errors.push({ error: e1.message }); }
        }
      } else {
        summary.reversals_created += count ?? batch.length;
      }
    }
    if (revOriginalIds.length > 0) {
      for (const batch of chunk(revOriginalIds, 500)) {
        await supabase.from("core_fabrication_fund_movements").update({ status: "reversed" }).in("id", batch);
      }
    }
    for (const [fundId, delta] of revFundDeltas) {
      const cur = await currentFund(supabase, fundId);
      await supabase.from("core_fabrication_funds").update({ available_amount: roundAmt(cur + delta) }).eq("id", fundId);
    }

    const finalStatus = summary.errors_count > 0 ? "completed_warnings" : "completed";
    if (runId) {
      await supabase.from("core_fabrication_fund_runs").update({
        status: finalStatus,
        orders_checked: summary.orders_checked, items_checked: summary.items_checked,
        movements_created: summary.movements_created, pending_items_created: summary.pending_items_created,
        reversals_created: summary.reversals_created, errors_count: summary.errors_count,
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
}

// ============================================================
// REPROCESS PENDING
// ============================================================
async function runReprocess(supabase: any, userId: string, pendingIds?: string[]) {
  const summary: any = {
    pending_processed: 0, movements_created: 0, pending_skipped: 0,
    errors_count: 0, errors: [] as any[], by_fund: { general: 0, non_restockable: 0 },
  };

  let runId: string | null = null;
  try {
    const { data: runRow } = await supabase.from("core_fabrication_fund_runs").insert({
      run_type: "reprocess_pending", status: "completed", summary: {}, created_by: userId,
    }).select().single();
    runId = runRow?.id ?? null;

    // Build pending query
    let pq = supabase.from("core_fabrication_fund_pending_items").select("*").neq("status", "processed").neq("status", "ignored");
    if (pendingIds && pendingIds.length > 0) {
      pq = pq.in("id", pendingIds);
    } else {
      // Only auto-process resolved/linked/non_restockable
      pq = pq.in("status", ["linked", "non_restockable", "resolved"]);
    }
    const { data: pendings, error: pErr } = await pq;
    if (pErr) throw pErr;

    const variantIds = Array.from(new Set((pendings ?? []).map((p: any) => p.linked_core_variant_id).filter(Boolean)));
    const [{ data: funds }, { data: coreProducts }, { data: coreVariants }] = await Promise.all([
      supabase.from("core_fabrication_funds").select("id, fund_type, currency, core_product_id, available_amount"),
      supabase.from("core_products").select("id, name, unit_cost, currency, cost_snapshot, is_restockable"),
      variantIds.length
        ? supabase.from("core_product_variants").select("id, cost_override_enabled, cost_structure_id, variant_unit_cost_usd").in("id", variantIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const generalFund = (funds ?? []).find((f: any) => f.fund_type === "general" && f.currency === "USD" && !f.core_product_id);
    const nonRestockFund = (funds ?? []).find((f: any) => f.fund_type === "non_restockable" && f.currency === "USD" && !f.core_product_id);
    if (!generalFund || !nonRestockFund) return json({ error: "missing_base_funds" }, 500);
    const productById = new Map<string, any>();
    for (const p of coreProducts ?? []) productById.set(p.id, p);
    const variantById = new Map<string, any>();
    for (const v of coreVariants ?? []) variantById.set(v.id, v);

    const fundDeltas = new Map<string, number>();
    const movementInserts: any[] = [];
    const resolvedIds: string[] = [];
    const skippedUpdates: { id: string; reason: string }[] = [];

    for (const p of pendings ?? []) {
      // Decide path
      const isNonRestock = !!p.marked_non_restockable;
      let product: any = null;
      if (p.linked_core_product_id) product = productById.get(p.linked_core_product_id);

      // Non-restockable can have no linked product → bill at line revenue divided? No, must have product.
      if (!product) {
        skippedUpdates.push({ id: p.id, reason: "unit_cost_missing" });
        summary.pending_skipped += 1;
        continue;
      }
      const variant = p.linked_core_variant_id ? variantById.get(p.linked_core_variant_id) : null;
      const resolved = await resolveVariantUnitCost(supabase, product, variant, p.woo_product_id, p.woo_variation_id);
      const unitCost = resolved.unit_cost;

      // Fase 2B-1: política
      const policyAct = await resolveReplenishmentAction(supabase, product, variant, p.woo_product_id, p.woo_variation_id);
      const action = policyAct?.action ?? "allow_internal_factory";
      if (action !== "allow_internal_factory") {
        await insertPolicyEvent(supabase, {
          source_type: "fabrication_fund",
          source_id: p.id,
          woo_order_id: p.source_order_id ?? null,
          woo_order_item_id: p.source_order_item_id ?? null,
          core_product_id: product?.id ?? null,
          core_variant_id: variant?.id ?? null,
          woo_product_id: p.woo_product_id ?? null,
          woo_variation_id: p.woo_variation_id ?? null,
          policy_id: policyAct?.policy_id ?? null,
          action, severity: policyAct?.severity ?? "review",
          message: policyAct?.message ?? null,
          warning: policyAct?.warning ?? null,
          quantity: Number(p.quantity ?? 0) || null,
          unit_cost: unitCost || null,
          amount: unitCost && p.quantity ? +(Number(p.quantity) * unitCost).toFixed(4) : null,
          cost_source: resolved.cost_source,
          replacement_product_id: policyAct?.replacement_product_id ?? null,
          replacement_woo_product_id: policyAct?.replacement_woo_product_id ?? null,
          replacement_behavior: policyAct?.replacement_behavior ?? null,
          external_supplier_name: policyAct?.external_supplier_name ?? null,
          external_supplier_unit_cost_usd: policyAct?.external_supplier_unit_cost_usd ?? null,
          status: "open", created_by: userId,
        });
        skippedUpdates.push({ id: p.id, reason: `policy_${action}` });
        summary.pending_skipped += 1;
        continue;
      }

      if (!unitCost || unitCost <= 0) {
        skippedUpdates.push({ id: p.id, reason: "unit_cost_missing" });
        summary.pending_skipped += 1;
        continue;
      }

      const qty = Number(p.quantity ?? 0) || 0;
      if (qty <= 0) {
        skippedUpdates.push({ id: p.id, reason: "sync_error" });
        summary.pending_skipped += 1;
        continue;
      }
      const fund = isNonRestock ? nonRestockFund : generalFund;
      const movementType = isNonRestock ? "sale_generated_non_restockable" : "sale_generated";
      const amount = +(qty * unitCost).toFixed(4);

      movementInserts.push({
        fund_id: fund.id, fabrication_fund_run_id: runId,
        movement_type: movementType, source: "reprocess_pending",
        source_order_id: p.source_order_id, source_order_item_id: p.source_order_item_id,
        woo_product_id: p.woo_product_id, woo_variation_id: p.woo_variation_id,
        core_product_id: product.id, core_variant_id: p.linked_core_variant_id ?? null,
        sku: p.woo_sku, product_name: p.product_name ?? product.name,
        quantity: qty, unit_cost_snapshot: unitCost,
        cost_snapshot_data: {
          ...(product.cost_snapshot ?? {}),
          cost_source: resolved.cost_source,
          policy_id: resolved.policy_id,
          resolved_core_product_id: resolved.resolved_core_product_id ?? product.id,
          resolved_core_variant_id: resolved.resolved_core_variant_id ?? p.linked_core_variant_id ?? null,
          resolved_variant_id: p.linked_core_variant_id ?? null,
          woo_product_id: resolved.woo_product_id ?? p.woo_product_id ?? null,
          woo_variation_id: resolved.woo_variation_id ?? p.woo_variation_id ?? null,
          warning: resolved.warning,
        },
        amount, currency: product.currency || "USD",
        reason: isNonRestock ? "Reprocesado (no restockeable)" : "Reprocesado tras resolver pendiente",
        status: "posted", created_by: userId,
      });

      fundDeltas.set(fund.id, (fundDeltas.get(fund.id) ?? 0) + amount);
      resolvedIds.push(p.id);
      if (isNonRestock) summary.by_fund.non_restockable += 1; else summary.by_fund.general += 1;
    }

    const chunk = <T,>(arr: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };
    for (const batch of chunk(movementInserts, 500)) {
      const { error, count } = await supabase.from("core_fabrication_fund_movements").insert(batch, { count: "exact" });
      if (error) {
        for (const row of batch) {
          const { error: e1 } = await supabase.from("core_fabrication_fund_movements").insert(row);
          if (!e1) summary.movements_created += 1;
          else if ((e1 as any).code === "23505") {
            // Duplicate movement; still mark pending resolved
          } else { summary.errors_count += 1; summary.errors.push({ error: e1.message }); }
        }
      } else {
        summary.movements_created += count ?? batch.length;
      }
    }
    if (resolvedIds.length > 0) {
      for (const batch of chunk(resolvedIds, 500)) {
        await supabase.from("core_fabrication_fund_pending_items")
          .update({ status: "processed", resolved_at: new Date().toISOString(), resolved_by: userId, last_action_at: new Date().toISOString(), last_action_by: userId })
          .in("id", batch);
      }
      summary.pending_processed = resolvedIds.length;
    }
    for (const u of skippedUpdates) {
      await supabase.from("core_fabrication_fund_pending_items")
        .update({ reason: u.reason, last_action_at: new Date().toISOString(), last_action_by: userId })
        .eq("id", u.id);
    }
    for (const [fundId, delta] of fundDeltas) {
      const cur = await currentFund(supabase, fundId);
      await supabase.from("core_fabrication_funds").update({ available_amount: roundAmt(cur + delta) }).eq("id", fundId);
    }

    if (runId) {
      await supabase.from("core_fabrication_fund_runs").update({
        status: summary.errors_count > 0 ? "completed_warnings" : "completed",
        movements_created: summary.movements_created,
        pending_items_created: 0,
        reversals_created: 0,
        errors_count: summary.errors_count,
        summary,
      }).eq("id", runId);
    }
    return json({ ok: true, run_id: runId, summary });
  } catch (e) {
    console.error("reprocess-pending error:", e);
    if (runId) {
      await supabase.from("core_fabrication_fund_runs").update({
        status: "failed", summary: { ...summary, error: String((e as Error).message) },
      }).eq("id", runId);
    }
    return json({ error: String((e as Error).message) }, 500);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function roundAmt(n: number) { return Math.round(n * 10000) / 10000; }

// Deriva la talla de un line item Woo cuando no hay variante mapeada en Core.
function deriveSizeFromItem(it: any, _product: any): string | null {
  const sku = (it?.sku ?? "").toString().trim();
  const parent = (it?.parent_sku ?? "").toString().trim();
  const name = (it?.product_name ?? "").toString();
  const SIZE_RE = /^(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|\d{1,3})$/i;

  if (parent && sku && sku.toUpperCase().startsWith(parent.toUpperCase())) {
    const tail = sku.slice(parent.length).replace(/^[\s\-_]+/, "").trim();
    const firstToken = tail.split(/[\s\-_]/)[0];
    if (firstToken && SIZE_RE.test(firstToken)) return firstToken.toUpperCase();
  }
  if (sku) {
    const tokens = sku.split(/[\s\-_]/).filter(Boolean);
    const last = tokens[tokens.length - 1];
    if (last && SIZE_RE.test(last)) return last.toUpperCase();
  }
  const m = name.match(/talla\s+([A-Z0-9]+)/i);
  if (m && SIZE_RE.test(m[1])) return m[1].toUpperCase();
  return null;
}
async function currentFund(supabase: any, id: string) {
  const { data } = await supabase.from("core_fabrication_funds").select("available_amount").eq("id", id).single();
  return Number(data?.available_amount ?? 0);
}
