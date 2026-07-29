// Generate / regenerate individual production units (QR) for a Production Order.
// Idempotent: never duplicates units. Re-runs only create missing ones.
// Multiproduct-aware: processes are resolved per line from its product's cost-structure.
// Supports repair_missing_processes:true to backfill unit_processes on existing
// units that were created with 0 processes (and have no scan/work history).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_STATUSES = [
  "open", "in_production", "partially_completed", "draft",
];

const PROCESS_ITEM_TYPES = new Set(["labor", "technical_process", "process"]);

function isProcessItem(it: any): boolean {
  if (PROCESS_ITEM_TYPES.has(String(it.item_type ?? "").toLowerCase())) return true;
  const sec = String(it.section ?? "").toLowerCase();
  if (sec.includes("labor") || sec.includes("process")) return true;
  if (it.adds_to_payroll) return true;
  return false;
}

// Cache resolved processes per (productId|variantId) to avoid N+1.
// If the variant has cost_override_enabled + cost_structure_id, we use the
// variant's own structure processes; otherwise fallback to the product's
// base structure; otherwise fallback to order-level processes.
async function resolveProcessesForLine(
  supa: any,
  line: any,
  costStructureCache: Map<string, any[]>,
  orderLevelProcesses: any[],
): Promise<any[]> {
  const productId = line.core_product_id;
  const variantId = line.core_variant_id ?? null;
  if (!productId) {
    // No product on line → fallback to order-level (legacy single-product)
    return orderLevelProcesses;
  }

  const cacheKey = `${productId}|${variantId ?? ""}`;
  if (costStructureCache.has(cacheKey)) {
    return costStructureCache.get(cacheKey)!;
  }

  // 1) Variant override?
  let csId: string | null = null;
  if (variantId) {
    const { data: variant } = await supa
      .from("core_product_variants")
      .select("cost_override_enabled, cost_structure_id")
      .eq("id", variantId)
      .maybeSingle();
    if (variant?.cost_override_enabled && variant.cost_structure_id) {
      csId = variant.cost_structure_id;
    }
  }

  // 2) Fallback: product base structure
  if (!csId) {
    const { data: prod } = await supa
      .from("core_products")
      .select("cost_structure_id")
      .eq("id", productId)
      .maybeSingle();
    csId = prod?.cost_structure_id ?? null;
  }

  if (!csId) {
    // No cost-structure linked → fallback to order-level
    costStructureCache.set(cacheKey, orderLevelProcesses);
    return orderLevelProcesses;
  }

  const { data: items } = await supa
    .from("core_cost_structure_items")
    .select(
      "name,process_name,item_type,section,adds_to_payroll,suggested_role,sort_order,process_order,unit_cost,currency",
    )
    .eq("cost_structure_id", csId)
    .order("sort_order", { ascending: true });

  const rows = (items ?? [])
    .filter(isProcessItem)
    .map((it: any, idx: number) => ({
      // shape compatible with order-level processes
      id: null, // virtual; not from core_production_order_processes
      process_name: it.process_name ?? it.name ?? `Proceso ${idx + 1}`,
      process_type: it.item_type ?? it.section ?? null,
      process_order: it.process_order ?? it.sort_order ?? idx,
      adds_to_payroll: !!it.adds_to_payroll,
      suggested_role: it.suggested_role ?? null,
      rate_snapshot: { unit_cost: it.unit_cost, currency: it.currency },
    }));

  // If the variant/product structure has no process items, fall back to
  // order-level so units are not created with 0 processes when a base
  // structure clearly exists.
  const effective = rows.length ? rows : orderLevelProcesses;
  costStructureCache.set(cacheKey, effective);
  return effective;
}

async function insertUnitProcessesIfMissing(
  supa: any,
  unitId: string,
  resolvedProcesses: any[],
) {
  if (!resolvedProcesses.length) return 0;
  // Check what already exists for this unit
  const { data: existing } = await supa
    .from("core_production_unit_processes")
    .select("process_name, process_order")
    .eq("production_unit_id", unitId);

  const seen = new Set(
    (existing ?? []).map(
      (e: any) => `${e.process_order}|${String(e.process_name).toLowerCase()}`,
    ),
  );

  const rows = resolvedProcesses
    .filter((p: any) => !seen.has(`${p.process_order}|${String(p.process_name).toLowerCase()}`))
    .map((p: any) => ({
      production_unit_id: unitId,
      production_order_process_id: p.id ?? null,
      process_name: p.process_name,
      process_type: p.process_type,
      process_order: p.process_order,
      adds_to_payroll: p.adds_to_payroll,
      suggested_role: p.suggested_role,
      rate_snapshot: p.rate_snapshot,
      status: "pending",
    }));

  if (!rows.length) return 0;
  const { error } = await supa.from("core_production_unit_processes").insert(rows);
  if (error) throw error;
  return rows.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const production_order_id: string | undefined = body.production_order_id;
    const allow_draft: boolean = !!body.allow_draft;
    const repair_missing_processes: boolean = !!body.repair_missing_processes;
    if (!production_order_id) {
      return new Response(JSON.stringify({ error: "production_order_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    let userId: string | null = null;
    if (authHeader.startsWith("Bearer ")) {
      const anon = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
      );
      const { data: u } = await anon.auth.getUser();
      userId = u?.user?.id ?? null;
    }

    const { data: order, error: oErr } = await supa
      .from("core_production_orders")
      .select("id, order_code, status, core_product_id, sku, product_name")
      .eq("id", production_order_id)
      .maybeSingle();
    if (oErr || !order) {
      return new Response(JSON.stringify({ error: "order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ALLOWED_STATUSES.includes(order.status)) {
      return new Response(JSON.stringify({ error: `Estado ${order.status} no permite generar unidades` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (order.status === "draft" && !allow_draft) {
      return new Response(JSON.stringify({ error: "Orden en borrador. Confirma con allow_draft=true." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: lines } = await supa
      .from("core_production_order_lines")
      .select("*")
      .eq("production_order_id", production_order_id);

    // Fase 2B-1: validar política antes de generar unidades (no aplica a repair)
    if (!repair_missing_processes) {
      const blocked: any[] = [];
      for (const line of lines ?? []) {
        const [{ data: p }, { data: v }] = await Promise.all([
          line.core_product_id ? supa.from("core_products").select("woo_product_id").eq("id", line.core_product_id).maybeSingle() : Promise.resolve({ data: null }),
          line.core_variant_id ? supa.from("core_product_variants").select("woo_variation_id").eq("id", line.core_variant_id).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        const { data: polData } = await supa.rpc("route_core_replenishment_candidate", {
          p_source_type: "production_units_preview",
          p_core_product_id: line.core_product_id ?? null,
          p_core_variant_id: line.core_variant_id ?? null,
          p_woo_product_id: (p as any)?.woo_product_id ?? null,
          p_woo_variation_id: (v as any)?.woo_variation_id ?? null,
          p_dry_run: true,
        });
        const pol = polData as any;
        const polAction = pol?.route_action ?? pol?.action ?? "allow_internal_factory";
        if (pol && polAction !== "allow_internal_factory") {
          blocked.push({ line_id: line.id, sku: line.sku, variant_sku: line.variant_sku, action: polAction, message: pol.message });
          // Nota: no se hace insert manual en core_replenishment_policy_events.
          // El motor central ya lo hará cuando se ejecute la generación real (no-dry-run).
        }
      }
      if (blocked.length) {
        return new Response(JSON.stringify({ error: "policy_blocked", blocked_lines: blocked, message: "La OP contiene líneas cuya política de reposición ya no permite fabricación interna." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: orderProcesses } = await supa
      .from("core_production_order_processes")
      .select("*")
      .eq("production_order_id", production_order_id)
      .order("process_order");

    const costStructureCache = new Map<string, any[]>();
    const orderLevelProcesses = orderProcesses ?? [];


    // ============== REPAIR MODE ==============
    if (repair_missing_processes) {
      const { data: units } = await supa
        .from("core_production_units")
        .select("id, unit_code, status, production_order_line_id, core_product_id")
        .eq("production_order_id", production_order_id);

      const repaired: any[] = [];
      const skipped: any[] = [];

      for (const u of units ?? []) {
        // Safety: only repair units without scan/work history and not in inventory
        const [{ count: scanCnt }, { count: workCnt }, { count: procCnt }] = await Promise.all([
          supa.from("core_production_scan_events").select("id", { count: "exact", head: true })
            .eq("production_unit_id", u.id),
          supa.from("core_production_work_entries").select("id", { count: "exact", head: true })
            .eq("production_unit_id", u.id),
          supa.from("core_production_unit_processes").select("id", { count: "exact", head: true })
            .eq("production_unit_id", u.id),
        ]);

        if ((scanCnt ?? 0) > 0 || (workCnt ?? 0) > 0) {
          skipped.push({ unit_code: u.unit_code, reason: "tiene escaneos o nómina" });
          continue;
        }
        if (u.status === "entered_inventory" || u.status === "completed") {
          skipped.push({ unit_code: u.unit_code, reason: `status=${u.status}` });
          continue;
        }
        if ((procCnt ?? 0) > 0) {
          skipped.push({ unit_code: u.unit_code, reason: "ya tiene procesos" });
          continue;
        }

        const line = (lines ?? []).find((l: any) => l.id === u.production_order_line_id);
        const resolved = line
          ? await resolveProcessesForLine(supa, line, costStructureCache, orderLevelProcesses)
          : orderLevelProcesses;
        const inserted = await insertUnitProcessesIfMissing(supa, u.id, resolved);
        repaired.push({ unit_code: u.unit_code, processes_inserted: inserted });
      }

      await supa.from("core_audit_logs").insert({
        action: "repair_unit_processes",
        table_name: "core_production_units",
        record_id: production_order_id,
        new_value: `repaired:${repaired.length} skipped:${skipped.length}`,
        performed_by: userId,
      });

      return new Response(
        JSON.stringify({ ok: true, mode: "repair", repaired, skipped }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ============== NORMAL GENERATION MODE ==============
    const { data: existing } = await supa
      .from("core_production_units")
      .select("id, unit_code, production_order_line_id, size")
      .eq("production_order_id", production_order_id);

    const existingByLine: Record<string, number> = {};
    const existingCodes = new Set<string>();
    for (const u of existing ?? []) {
      const key = u.production_order_line_id ?? "_";
      existingByLine[key] = (existingByLine[key] ?? 0) + 1;
      if (u.unit_code) existingCodes.add(String(u.unit_code));
    }

    const createdUnits: any[] = [];
    let skipped = 0;

    const distinctSkus = Array.from(
      new Set((lines ?? []).map((l: any) => l.sku).filter(Boolean)),
    );
    const isMultiProduct = distinctSkus.length > 1;

    // Contador global por clave de código (order|productTag|sizeTag): dos líneas
    // distintas con el mismo SKU+talla ya no colisionan en unit_code.
    const seqByCodeKey: Record<string, number> = {};

    for (const line of lines ?? []) {
      const need = Number(line.quantity_ordered) || 0;
      const have = existingByLine[line.id] ?? 0;
      const toCreate = Math.max(0, need - have);
      if (toCreate === 0) { skipped += have; continue; }

      const sizeTag = (line.size ?? line.variant_label ?? "X").toString().toUpperCase().replace(/\s+/g, "");
      const productTag = isMultiProduct
        ? `-${String(line.sku ?? "P").toUpperCase().replace(/\s+/g, "")}`
        : "";
      const codeKey = `${order.order_code}${productTag}-${sizeTag}`;
      if (seqByCodeKey[codeKey] === undefined) seqByCodeKey[codeKey] = 0;

      const nextFreeCode = (): string | null => {
        for (let guard = 0; guard < 5000; guard++) {
          seqByCodeKey[codeKey] += 1;
          const code = `${codeKey}-${String(seqByCodeKey[codeKey]).padStart(3, "0")}`;
          if (!existingCodes.has(code)) return code;
        }
        return null;
      };

      const resolvedProcesses = await resolveProcessesForLine(
        supa, line, costStructureCache, orderLevelProcesses,
      );

      for (let i = 0; i < toCreate; i++) {
        let ins: any = null;
        let lastErr: any = null;
        let unit_code: string | null = null;

        // Reintento defensivo ante 23505 (unit_code o qr_token duplicado).
        for (let attempt = 0; attempt < 5 && !ins; attempt++) {
          unit_code = nextFreeCode();
          if (!unit_code) {
            lastErr = { message: "No se pudo asignar un unit_code libre" };
            break;
          }
          const qr_token = crypto.randomUUID().replace(/-/g, "");
          const qr_payload = `/core/escaneo?unit=${qr_token}`;

          const { data, error: insErr } = await supa
            .from("core_production_units")
            .insert({
              unit_code,
              production_order_id,
              production_order_line_id: line.id,
              core_product_id: line.core_product_id ?? order.core_product_id,
              core_variant_id: line.core_variant_id,
              sku: line.sku ?? order.sku,
              variant_sku: line.variant_sku,
              variant_label: line.variant_label,
              size: line.size,
              status: "created",
              qr_token,
              qr_payload,
              qr_generated_at: new Date().toISOString(),
              qr_generated_by: userId,
              created_by: userId,
            })
            .select("id, unit_code")
            .single();

          if (!insErr) { ins = data; break; }
          lastErr = insErr;
          existingCodes.add(unit_code);
          if (insErr.code !== "23505") break;
        }

        if (!ins) {
          let product_name: string | null = null;
          if (line.core_product_id) {
            const { data: p } = await supa
              .from("core_products").select("name").eq("id", line.core_product_id).maybeSingle();
            product_name = (p as any)?.name ?? null;
          }
          return new Response(JSON.stringify({
            error: lastErr?.message ?? "Error creando unidad",
            production_order_id,
            line_id: line.id,
            sku: line.sku ?? order.sku ?? null,
            variant_sku: line.variant_sku ?? null,
            product_name: product_name ?? order.product_name ?? null,
            size: line.size ?? line.variant_label ?? null,
            unit_code,
            created_before_error: createdUnits.length,
            reason: lastErr?.code === "23505"
              ? "Código de unidad o QR duplicado"
              : (lastErr?.message ?? "Error desconocido al insertar la unidad"),
          }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        existingCodes.add(String(ins.unit_code));
        createdUnits.push(ins);

        await insertUnitProcessesIfMissing(supa, ins.id, resolvedProcesses);
      }
    }

    await supa.from("core_audit_logs").insert({
      action: "generate_production_units",
      table_name: "core_production_units",
      record_id: production_order_id,
      new_value: `created:${createdUnits.length} skipped_existing:${skipped}`,
      performed_by: userId,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        created: createdUnits.length,
        skipped_existing: skipped,
        units: createdUnits,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
