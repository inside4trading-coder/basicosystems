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
  let reversedSet = new Set<string>();
  if (movIds.length > 0) {
    const { data: revs } = await supabase
      .from("core_fabrication_fund_movements")
      .select("related_movement_id")
      .eq("movement_type", "reversal")
      .in("related_movement_id", movIds);
    (revs ?? []).forEach((r: any) => r.related_movement_id && reversedSet.add(r.related_movement_id));
  }
  reversalsDetected = reversedSet.size;

  // 3. Already-linked movements
  let linkedSet = new Set<string>();
  if (movIds.length > 0) {
    const { data: links } = await supabase
      .from("core_production_need_sources")
      .select("fabrication_fund_movement_id")
      .in("fabrication_fund_movement_id", movIds);
    (links ?? []).forEach((l: any) => l.fabrication_fund_movement_id && linkedSet.add(l.fabrication_fund_movement_id));
  }

  // 4. Active restock blocks
  const { data: blocks } = await supabase
    .from("core_restock_control")
    .select("core_product_id, core_variant_id, woo_product_id, woo_variation_id, sku, status")
    .eq("status", "active");
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
  let runId: string | null = null;
  if (!dryRun) {
    const { data: run } = await supabase
      .from("core_production_need_runs")
      .insert({ run_type: "generate_from_movements", status: "running", created_by: userId })
      .select("id")
      .single();
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

  // Fetch variant + product info for each group
  const variantIds = Array.from(groups.keys());
  const variantInfo = new Map<string, any>();
  if (variantIds.length > 0) {
    const { data: variants } = await supabase
      .from("core_product_variants")
      .select("id, size, variant_label, variant_sku, woo_sku, core_product_id")
      .in("id", variantIds);
    (variants ?? []).forEach((v: any) => variantInfo.set(v.id, v));
  }
  const productIds = Array.from(new Set(Array.from(groups.values()).map(g => g.core_product_id)));
  const productInfo = new Map<string, any>();
  if (productIds.length > 0) {
    const { data: prods } = await supabase
      .from("core_products")
      .select("id, name, core_sku, product_priority")
      .in("id", productIds);
    (prods ?? []).forEach((p: any) => productInfo.set(p.id, p));
  }

  if (dryRun) {
    return json({
      dry_run: true,
      movements_checked: movementsChecked,
      eligible_groups: groups.size,
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

  // Process groups
  for (const g of groups.values()) {
    const v = variantInfo.get(g.core_variant_id);
    const p = productInfo.get(g.core_product_id);
    const priority = p?.product_priority === "core" || p?.product_priority === "essential" ? "alta" : "media";

    // Find existing open auto need for this variant
    const { data: existingNeed } = await supabase
      .from("core_production_needs")
      .select("id, quantity_needed, quantity_approved, quantity_converted_to_order")
      .eq("core_variant_id", g.core_variant_id)
      .eq("need_type", "sale_generated")
      .in("status", ["pending", "review", "approved", "partially_converted"])
      .maybeSingle();

    let needId: string;
    if (existingNeed) {
      const newQtyNeeded = Number(existingNeed.quantity_needed) + g.qty;
      const pending = newQtyNeeded - Number(existingNeed.quantity_converted_to_order || 0);
      const { error: upErr } = await supabase
        .from("core_production_needs")
        .update({
          quantity_needed: newQtyNeeded,
          quantity_pending: pending,
          last_sale_at: g.last_sale_at,
          generation_run_id: runId,
          updated_by: userId,
        })
        .eq("id", existingNeed.id);
      if (upErr) { blockedCount++; skipReason("update_failed"); continue; }
      needId = existingNeed.id;
      needsUpdated++;
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("core_production_needs")
        .insert({
          need_type: "sale_generated",
          status: "pending",
          priority,
          core_product_id: g.core_product_id,
          core_variant_id: g.core_variant_id,
          sku: p?.core_sku ?? g.sku ?? null,
          variant_sku: v?.variant_sku ?? v?.woo_sku ?? null,
          product_name: p?.name ?? g.product_name ?? null,
          variant_label: v?.variant_label ?? null,
          size: v?.size ?? null,
          quantity_needed: g.qty,
          quantity_approved: 0,
          quantity_converted_to_order: 0,
          quantity_pending: g.qty,
          source: "auto_from_movements",
          last_sale_at: g.last_sale_at,
          generation_run_id: runId,
          created_by: userId,
          updated_by: userId,
        })
        .select("id")
        .single();
      if (insErr || !ins) { blockedCount++; skipReason("insert_failed:" + (insErr?.message || "")); continue; }
      needId = ins.id;
      needsCreated++;
    }

    // Link movements
    for (const m of g.movements) {
      const { error: linkErr } = await supabase
        .from("core_production_need_sources")
        .insert({
          production_need_id: needId,
          fabrication_fund_movement_id: m.id,
          source_order_id: m.source_order_id,
          source_order_item_id: m.source_order_item_id,
          quantity: Number(m.quantity ?? 0),
          amount: m.amount,
          currency: m.currency ?? "USD",
        });
      if (!linkErr) movementsLinked++;
    }

    // Audit
    await supabase.from("core_audit_logs").insert({
      table_name: "core_production_needs",
      record_id: needId,
      action: existingNeed ? "auto_update_from_movements" : "auto_create_from_movements",
      new_value: JSON.stringify({ qty_added: g.qty, movements: g.movements.length, run_id: runId }),
      performed_by: userData?.user?.email ?? userId,
    });
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
