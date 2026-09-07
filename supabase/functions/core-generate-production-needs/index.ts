import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json({ error: "missing_token" }, 401);
  const { data: userData } = await supabase.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) return json({ error: "invalid_token" }, 401);
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roleSet = new Set((roles ?? []).map((r: any) => r.role));
  if (!roleSet.has("admin") && !roleSet.has("manager")) return json({ error: "forbidden" }, 403);

  let dryRun = false;
  let routeOnly = false;
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (body?.dry_run === true) dryRun = true;
    if (body?.route_only === true) routeOnly = true;
    if (body?.period_start) periodStart = String(body.period_start);
    if (body?.period_end) periodEnd = String(body.period_end);
  } catch { /* ignore */ }

  const summary: any = { by_skip_reason: {}, samples: [] };
  let movementsChecked = 0;
  let needsCreated = 0;
  let needsUpdated = 0;
  let movementsLinked = 0;
  let reversalsDetected = 0;
  let skippedExisting = 0;
  let blockedCount = 0;
  let nonRestockableSkipped = 0;

  // 1. Fetch eligible movements: sale_generated + posted
  let mq = supabase
    .from("core_fabrication_fund_movements")
    .select("id, fund_id, source_order_id, source_order_item_id, woo_product_id, woo_variation_id, core_product_id, core_variant_id, sku, product_name, quantity, amount, currency, created_at, movement_type, status, related_movement_id")
    .eq("movement_type", "sale_generated")
    .eq("status", "posted")
    .order("created_at", { ascending: true })
    .limit(5000);
  if (periodStart) mq = mq.gte("created_at", periodStart);
  if (periodEnd) mq = mq.lte("created_at", periodEnd);
  const { data: movements, error: mErr } = await mq;
  if (mErr) return json({ error: mErr.message }, 500);
  movementsChecked = movements?.length ?? 0;

  // 2. Reversal detection: any movement_type='reversal' with related_movement_id targeting our movements
  const movIds = (movements ?? []).map((m: any) => m.id);

  // Safe chunked "in" helper: never send hundreds of ids in a single request,
  // and NEVER swallow an error (a failed history check would regenerate history).
  const CHUNK_SIZE = 150;
  async function chunkedIn<T = any>(
    table: string,
    columns: string,
    column: string,
    ids: (string | number)[],
    extra?: (q: any) => any,
  ): Promise<{ rows: T[]; error: any }> {
    const rows: T[] = [];
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const slice = ids.slice(i, i + CHUNK_SIZE);
      let q: any = supabase.from(table).select(columns).in(column, slice);
      if (extra) q = extra(q);
      const { data, error } = await q;
      if (error) return { rows: [], error };
      rows.push(...((data ?? []) as T[]));
    }
    return { rows, error: null };
  }

  async function abortRun(message: string, detail?: string) {
    if (runId) {
      await supabase.from("core_production_need_runs")
        .update({ status: "failed", summary: { error: message, detail: detail ?? null } })
        .eq("id", runId);
    }
    return json({
      error: "history_validation_failed",
      message: "No se pudo validar el historial de partidas. No se generó ninguna necesidad.",
      detail: detail ?? message,
    }, 500);
  }

  let runId: string | null = null;

  let reversedSet = new Set<string>();
  if (movIds.length > 0) {
    const { rows: revs, error: revErr } = await chunkedIn<any>(
      "core_fabrication_fund_movements",
      "related_movement_id",
      "related_movement_id",
      movIds,
      (q) => q.eq("movement_type", "reversal"),
    );
    if (revErr) return await abortRun("reversal_lookup_failed", revErr.message);
    revs.forEach((r: any) => r.related_movement_id && reversedSet.add(r.related_movement_id));
  }
  reversalsDetected = reversedSet.size;

  // 3. Already-linked movements
  let linkedSet = new Set<string>();
  if (movIds.length > 0) {
    const { rows: links, error: linkErr } = await chunkedIn<any>(
      "core_production_need_sources",
      "fabrication_fund_movement_id",
      "fabrication_fund_movement_id",
      movIds,
    );
    if (linkErr) return await abortRun("linked_lookup_failed", linkErr.message);
    links.forEach((l: any) => l.fabrication_fund_movement_id && linkedSet.add(l.fabrication_fund_movement_id));
  }

  // Sanity check: if the database already holds historical links but this run
  // believes nothing was ever processed, something went wrong — never write.
  const { count: historicalLinks, error: histErr } = await supabase
    .from("core_production_need_sources")
    .select("id", { count: "exact", head: true })
    .not("fabrication_fund_movement_id", "is", null);
  if (histErr) return await abortRun("historical_link_count_failed", histErr.message);
  if ((historicalLinks ?? 0) > 0 && linkedSet.size === 0 && movIds.length > 0) {
    return json({
      error: "anomalous_result",
      message: "Resultado anómalo detectado. La generación ha sido cancelada para evitar duplicados.",
      historical_links: historicalLinks,
      movements_checked: movementsChecked,
    }, 409);
  }


  // 4. Active restock blocks
  const { data: blocks, error: blocksErr } = await supabase
    .from("core_restock_control")
    .select("core_product_id, core_variant_id, woo_product_id, woo_variation_id, sku, status")
    .eq("status", "active");
  if (blocksErr) return await abortRun("restock_control_lookup_failed", blocksErr.message);
  const blockedVariants = new Set<string>();
  const blockedProducts = new Set<string>();
  const blockedWooVar = new Set<number>();
  const blockedWooProd = new Set<number>();
  const blockedSku = new Set<string>();
  (blocks ?? []).forEach((b: any) => {
    if (b.core_variant_id) blockedVariants.add(b.core_variant_id);
    if (b.core_product_id) blockedProducts.add(b.core_product_id);
    if (b.woo_variation_id) blockedWooVar.add(Number(b.woo_variation_id));
    if (b.woo_product_id) blockedWooProd.add(Number(b.woo_product_id));
    if (b.sku) blockedSku.add(b.sku);
  });

  // Create run record (skip if dryRun)
  if (!dryRun) {
    const { data: run, error: runErr } = await supabase
      .from("core_production_need_runs")
      .insert({ run_type: "generate_from_movements", status: "running", created_by: userId })
      .select("id")
      .single();
    if (runErr) return json({ error: runErr.message }, 500);
    runId = run?.id ?? null;
  }


  // Group eligible movements by core_variant_id
  type Grp = {
    core_product_id: string;
    core_variant_id: string;
    qty: number;
    last_sale_at: string;
    movements: any[];
    sku?: string;
    product_name?: string;
  };
  const groups = new Map<string, Grp>();
  const skipReason = (r: string) => { summary.by_skip_reason[r] = (summary.by_skip_reason[r] || 0) + 1; };

  for (const m of movements ?? []) {
    if (reversedSet.has(m.id)) { skipReason("reversed"); continue; }
    if (linkedSet.has(m.id)) { skippedExisting++; continue; }
    if (!m.core_variant_id || !m.core_product_id) { blockedCount++; skipReason("missing_core_ids"); continue; }
    // restock control
    const isBlocked =
      blockedVariants.has(m.core_variant_id) ||
      blockedProducts.has(m.core_product_id) ||
      (m.woo_variation_id && blockedWooVar.has(Number(m.woo_variation_id))) ||
      (m.woo_product_id && blockedWooProd.has(Number(m.woo_product_id))) ||
      (m.sku && blockedSku.has(m.sku));
    if (isBlocked) { nonRestockableSkipped++; skipReason("non_restockable"); continue; }

    const key = m.core_variant_id as string;
    const existing = groups.get(key);
    const qty = Number(m.quantity ?? 0);
    if (existing) {
      existing.qty += qty;
      existing.movements.push(m);
      if (m.created_at > existing.last_sale_at) existing.last_sale_at = m.created_at;
    } else {
      groups.set(key, {
        core_product_id: m.core_product_id,
        core_variant_id: m.core_variant_id,
        qty,
        last_sale_at: m.created_at,
        movements: [m],
        sku: m.sku,
        product_name: m.product_name,
      });
    }
  }

  // Fetch variant + product info for each group (chunked, errors abort)
  const variantIds = Array.from(groups.keys());
  const variantInfo = new Map<string, any>();
  if (variantIds.length > 0) {
    const { rows: variants, error: vErr } = await chunkedIn<any>(
      "core_product_variants",
      "id, size, variant_label, variant_sku, woo_sku, core_product_id",
      "id",
      variantIds,
    );
    if (vErr) return await abortRun("variant_lookup_failed", vErr.message);
    variants.forEach((v: any) => variantInfo.set(v.id, v));
  }
  const productIds = Array.from(new Set(Array.from(groups.values()).map(g => g.core_product_id)));
  const productInfo = new Map<string, any>();
  if (productIds.length > 0) {
    const { rows: prods, error: pErr } = await chunkedIn<any>(
      "core_products",
      "id, name, core_sku, product_priority",
      "id",
      productIds,
    );
    if (pErr) return await abortRun("product_lookup_failed", pErr.message);
    prods.forEach((p: any) => productInfo.set(p.id, p));
  }


  // ---- Central routing engine: evaluate every group BEFORE creating needs.
  // dry_run must never write; the RPC honours p_dry_run.
  const routingBuckets: Record<string, number> = {};
  const routingSamples: any[] = [];
  const allowedGroups: any[] = [];
  for (const g of groups.values()) {
    const v = variantInfo.get(g.core_variant_id);
    const p = productInfo.get(g.core_product_id);
    const firstMov = g.movements[0];
    const { data: routeRes, error: routeErr } = await supabase.rpc("route_core_replenishment_candidate", {
      p_source_type: "fabrication_fund_movement_group",
      p_source_key: `variant:${g.core_variant_id}`,
      p_source_id: null,
      p_core_product_id: g.core_product_id,
      p_core_variant_id: g.core_variant_id,
      p_woo_product_id: firstMov?.woo_product_id ?? null,
      p_woo_variation_id: firstMov?.woo_variation_id ?? null,
      p_woo_order_id: firstMov?.source_order_id ?? null,
      p_woo_order_item_id: firstMov?.source_order_item_id ?? null,
      p_quantity: g.qty,
      p_unit_cost: null,
      p_amount: null,
      p_cost_source: null,
      p_created_by: userId,
      p_dry_run: dryRun,
    });
    void routeErr;
    let action: string;
    let allow: boolean;
    if (routeErr || !routeRes) {
      action = "allow_internal_factory";
      allow = true;
    } else {
      action = (routeRes as any).route_action ?? "allow_internal_factory";
      allow = !!(routeRes as any).allow_internal_need;
    }
    routingBuckets[action] = (routingBuckets[action] ?? 0) + 1;
    if (routingSamples.length < 20) {
      routingSamples.push({
        core_variant_id: g.core_variant_id,
        qty: g.qty,
        action,
        allow,
      });
    }
    if (allow) {
      allowedGroups.push({ g, v, p });
    } else {
      skipReason(`policy_routed:${action}`);
    }
  }

  if (dryRun || routeOnly) {
    const newUnits = allowedGroups.reduce((acc: number, x: any) => acc + Number(x.g.qty || 0), 0);
    const existingVariantIds = new Set<string>();
    if (allowedGroups.length > 0) {
      const { rows: openNeeds, error: onErr } = await chunkedIn<any>(
        "core_production_needs",
        "core_variant_id",
        "core_variant_id",
        allowedGroups.map((x: any) => x.g.core_variant_id),
        (q) => q.eq("need_type", "sale_generated").in("status", ["pending", "review", "approved", "partially_converted"]),
      );
      if (onErr) return await abortRun("open_needs_lookup_failed", onErr.message);
      openNeeds.forEach((n: any) => existingVariantIds.add(n.core_variant_id));
    }
    const toUpdate = allowedGroups.filter((x: any) => existingVariantIds.has(x.g.core_variant_id)).length;
    return json({
      dry_run: dryRun,
      route_only: routeOnly,
      movements_checked: movementsChecked,
      movements_already_processed: skippedExisting,
      movements_new: (movements ?? []).length - skippedExisting - reversalsDetected - blockedCount - nonRestockableSkipped,
      movements_blocked: blockedCount + nonRestockableSkipped,
      movements_reversed: reversalsDetected,
      historical_links: historicalLinks ?? 0,
      needs_to_create: allowedGroups.length - toUpdate,
      needs_to_update: toUpdate,
      new_units: newUnits,
      eligible_groups: groups.size,
      routed_allowed: allowedGroups.length,
      routing_buckets: routingBuckets,
      routing_samples: routingSamples,
      groups_preview: Array.from(groups.values()).slice(0, 20).map(g => ({
        core_variant_id: g.core_variant_id,
        qty: g.qty,
        movements: g.movements.length,
      })),
      skipped_existing: skippedExisting,
      blocked: blockedCount,
      non_restockable: nonRestockableSkipped,
      reversals_detected: reversalsDetected,
      by_skip_reason: summary.by_skip_reason,
    });
  }


  // Process only routed-allowed groups.
  // Need + source links are created by a single atomic RPC: a movement that is
  // already linked can never generate demand again.
  for (const { g, v, p } of allowedGroups) {
    const priority = p?.product_priority === "core" || p?.product_priority === "essential" ? "alta" : "media";

    const { data: res, error: rpcErr } = await supabase.rpc("core_create_need_from_movements", {
      p_core_product_id: g.core_product_id,
      p_core_variant_id: g.core_variant_id,
      p_movement_ids: g.movements.map((m: any) => m.id),
      p_sku: p?.core_sku ?? g.sku ?? null,
      p_variant_sku: v?.variant_sku ?? v?.woo_sku ?? null,
      p_product_name: p?.name ?? g.product_name ?? null,
      p_variant_label: v?.variant_label ?? null,
      p_size: v?.size ?? null,
      p_priority: priority,
      p_run_id: runId,
      p_user_id: userId,
    });

    if (rpcErr) { blockedCount++; skipReason("atomic_create_failed:" + rpcErr.message); continue; }

    const action = (res as any)?.action;
    if (action === "created") needsCreated++;
    else if (action === "updated") needsUpdated++;
    else { skippedExisting++; continue; }
    movementsLinked += Number((res as any)?.movements_linked ?? 0);
  }


  // Finalize run
  if (runId) {
    await supabase.from("core_production_need_runs").update({
      status: "completed",
      movements_checked: movementsChecked,
      needs_created: needsCreated,
      needs_updated: needsUpdated,
      movements_linked: movementsLinked,
      reversals_detected: reversalsDetected,
      skipped_existing: skippedExisting,
      blocked_count: blockedCount,
      non_restockable_skipped: nonRestockableSkipped,
      summary,
    }).eq("id", runId);
  }

  return json({
    run_id: runId,
    movements_checked: movementsChecked,
    needs_created: needsCreated,
    needs_updated: needsUpdated,
    movements_linked: movementsLinked,
    reversals_detected: reversalsDetected,
    skipped_existing: skippedExisting,
    blocked_count: blockedCount,
    non_restockable_skipped: nonRestockableSkipped,
    by_skip_reason: summary.by_skip_reason,
  });
});
