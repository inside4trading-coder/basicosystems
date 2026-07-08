// BLOQUE 9 — Crea Órdenes de Producción desde Necesidades aprobadas
// o de forma manual. NO genera QR, ni nómina, ni mueve inventario.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FromNeedsBody {
  mode: "from_needs";
  need_ids: string[];
  // opcional: { [need_id]: cantidad } para conversión parcial
  quantities?: Record<string, number>;
  expected_date?: string | null;
  priority?: string;
  notes?: string;
  responsible_user_id?: string | null;
  allow_overproduction?: boolean;
}

interface ManualLine {
  core_variant_id: string;
  quantity: number;
}

interface ManualBody {
  mode: "manual";
  core_product_id: string;
  lines: ManualLine[];
  reason: string;
  priority?: string;
  expected_date?: string | null;
  notes?: string;
  responsible_user_id?: string | null;
}

type Body = FromNeedsBody | ManualBody;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // resolver user_id
    let userId: string | null = null;
    try {
      const jwt = authHeader.replace("Bearer ", "");
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
      );
      const { data } = await anonClient.auth.getUser(jwt);
      userId = data.user?.id ?? null;
    } catch (_) {}

    const body = (await req.json()) as Body;

    if (body.mode === "from_needs") {
      return await createFromNeeds(supabase, body, userId);
    }
    if (body.mode === "manual") {
      return await createManual(supabase, body, userId);
    }
    return json({ error: "Invalid mode" }, 400);
  } catch (err: any) {
    console.error("[core-create-production-order] error", err);
    return json({ error: String(err?.message ?? err) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function audit(
  supabase: any,
  table_name: string,
  record_id: string,
  action: string,
  field: string | null,
  oldVal: string | null,
  newVal: string | null,
  userId: string | null,
) {
  try {
    await supabase.from("core_audit_logs").insert({
      table_name,
      record_id,
      action,
      field_changed: field,
      old_value: oldVal,
      new_value: newVal,
      performed_by: userId,
    });
  } catch (e) {
    console.error("audit failed", e);
  }
}

async function fetchProcessesFromCostStructure(
  supabase: any,
  costStructureId: string | null,
) {
  if (!costStructureId) return [];
  const { data, error } = await supabase
    .from("core_cost_structure_items")
    .select(
      "name,process_name,item_type,section,adds_to_payroll,suggested_role,sort_order,process_order,unit_cost,currency",
    )
    .eq("cost_structure_id", costStructureId)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("fetch processes error", error);
    return [];
  }
  // Filtrar a procesos / mano de obra
  return (data ?? []).filter((it: any) =>
    ["labor", "technical_process", "process"].includes(
      String(it.item_type ?? "").toLowerCase(),
    ) ||
    String(it.section ?? "").toLowerCase().includes("labor") ||
    String(it.section ?? "").toLowerCase().includes("process") ||
    !!it.adds_to_payroll
  );
}

async function insertProcessesForOrder(
  supabase: any,
  orderId: string,
  coreProductId: string | null,
) {
  if (!coreProductId) return 0;
  const { data: prod } = await supabase
    .from("core_products")
    .select("cost_structure_id")
    .eq("id", coreProductId)
    .maybeSingle();
  const items = await fetchProcessesFromCostStructure(
    supabase,
    prod?.cost_structure_id ?? null,
  );
  if (!items.length) return 0;
  const rows = items.map((it: any, idx: number) => ({
    production_order_id: orderId,
    process_name: it.process_name ?? it.name ?? `Proceso ${idx + 1}`,
    process_type: it.item_type ?? it.section ?? null,
    process_order: it.process_order ?? it.sort_order ?? idx,
    adds_to_payroll: !!it.adds_to_payroll,
    suggested_role: it.suggested_role ?? null,
    rate_snapshot: { unit_cost: it.unit_cost, currency: it.currency },
    status: "pending",
  }));
  const { error } = await supabase
    .from("core_production_order_processes")
    .insert(rows);
  if (error) {
    console.error("insert processes error", error);
    return 0;
  }
  return rows.length;
}

async function createFromNeeds(
  supabase: any,
  body: FromNeedsBody,
  userId: string | null,
) {
  if (!body.need_ids?.length) {
    return json({ error: "need_ids requerido" }, 400);
  }

  const { data: needs, error: needsErr } = await supabase
    .from("core_production_needs")
    .select("*")
    .in("id", body.need_ids);
  if (needsErr) throw needsErr;
  if (!needs?.length) return json({ error: "Necesidades no encontradas" }, 404);

  // Validar todas approved y con pending > 0
  const invalid = needs.filter(
    (n: any) =>
      n.status !== "approved" || Number(n.quantity_pending ?? 0) <= 0,
  );
  if (invalid.length) {
    return json(
      {
        error:
          "Solo se pueden convertir necesidades en estado approved con quantity_pending > 0",
        invalid_ids: invalid.map((n: any) => n.id),
      },
      400,
    );
  }

  // BLOQUE 9.1 — UNA sola OP por lote. Agrupar líneas por (core_product_id, core_variant_id|variant_sku|size).
  let totalQty = 0;
  let isOverproduction = false;
  const linesMap = new Map<string, any>();

  for (const n of needs) {
    const requested =
      body.quantities?.[n.id] !== undefined
        ? Number(body.quantities[n.id])
        : Number(n.quantity_pending);
    if (requested <= 0) continue;
    if (
      requested >
        Number(n.quantity_approved) - Number(n.quantity_converted_to_order)
    ) {
      if (!body.allow_overproduction) {
        return json(
          {
            error:
              `La necesidad ${n.id} (${n.variant_sku}) excede lo aprobado pendiente. Use allow_overproduction:true.`,
            need_id: n.id,
          },
          400,
        );
      }
      isOverproduction = true;
    }
    totalQty += requested;

    const vkey =
      `${n.core_product_id ?? "np"}|${n.core_variant_id ?? n.variant_sku ?? n.size ?? "nv-" + n.id}`;
    if (linesMap.has(vkey)) {
      const existing = linesMap.get(vkey)!;
      existing.quantity_ordered = Number(existing.quantity_ordered) + requested;
      existing.quantity_pending = existing.quantity_ordered;
      existing._needs.push({ need: n, qty: requested });
    } else {
      linesMap.set(vkey, {
        core_product_id: n.core_product_id,
        core_variant_id: n.core_variant_id,
        sku: n.sku,
        product_name: n.product_name,
        variant_sku: n.variant_sku,
        variant_label: n.variant_label,
        size: n.size,
        quantity_ordered: requested,
        quantity_completed: 0,
        quantity_pending: requested,
        status: "pending",
        _needs: [{ need: n, qty: requested }],
      });
    }
  }

  if (totalQty <= 0) {
    return json({ error: "No hay cantidades > 0 para convertir" }, 400);
  }

  const linesArr = Array.from(linesMap.values());
  const distinctProductIds = Array.from(
    new Set(linesArr.map((l) => l.core_product_id).filter(Boolean)),
  );
  const distinctSkus = Array.from(
    new Set(linesArr.map((l) => l.sku).filter(Boolean)),
  );
  const isMultiProduct = distinctProductIds.length > 1;
  const headerProductId = isMultiProduct ? null : (distinctProductIds[0] ?? null);
  const headerSku = isMultiProduct
    ? `MULTI (${distinctSkus.length})`
    : (linesArr[0]?.sku ?? null);
  const headerName = isMultiProduct
    ? `Lote multiproducto · ${distinctProductIds.length} productos · ${linesArr.length} líneas`
    : (linesArr[0]?.product_name ?? null);

  const sampleNeed = needs[0];
  const { data: orderRow, error: orderErr } = await supabase
    .from("core_production_orders")
    .insert({
      status: "open",
      order_type: "from_needs",
      priority: body.priority ?? sampleNeed.priority ?? "media",
      core_product_id: headerProductId,
      sku: headerSku,
      product_name: headerName,
      total_quantity: totalQty,
      completed_quantity: 0,
      pending_quantity: totalQty,
      source: "needs",
      expected_date: body.expected_date ?? null,
      responsible_user_id: body.responsible_user_id ?? null,
      notes: body.notes ?? null,
      is_overproduction: isOverproduction,
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();
  if (orderErr) throw orderErr;

  // Resolver costo por línea con resolve_core_operational_unit_cost (Fase 2A):
  // variant_override → product_base → policy_manual_cost → external_supplier_cost
  // → core_product_manual_cost → product_unit_cost → zero.
  const productIds = Array.from(new Set(linesArr.map((l) => l.core_product_id).filter(Boolean)));
  const variantIdsAll = Array.from(new Set(linesArr.map((l) => l.core_variant_id).filter(Boolean)));
  const [{ data: productsInfo }, { data: variantsInfo }] = await Promise.all([
    productIds.length
      ? supabase.from("core_products").select("id, unit_cost, woo_product_id").in("id", productIds)
      : Promise.resolve({ data: [] as any[] }),
    variantIdsAll.length
      ? supabase.from("core_product_variants").select("id, cost_override_enabled, cost_structure_id, woo_variation_id").in("id", variantIdsAll)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const pInfoMap = new Map((productsInfo ?? []).map((p: any) => [p.id, p]));
  const vInfoMap = new Map((variantsInfo ?? []).map((v: any) => [v.id, v]));

  const linesToInsert: any[] = [];
  const costWarnings: any[] = [];
  for (const l of linesArr) {
    const p: any = l.core_product_id ? pInfoMap.get(l.core_product_id) : null;
    const v: any = l.core_variant_id ? vInfoMap.get(l.core_variant_id) : null;
    const { data: costData } = await supabase.rpc("resolve_core_operational_unit_cost", {
      p_core_product_id: l.core_product_id ?? null,
      p_core_variant_id: l.core_variant_id ?? null,
      p_woo_product_id: p?.woo_product_id ?? null,
      p_woo_variation_id: v?.woo_variation_id ?? null,
    });
    const row = Array.isArray(costData) ? costData[0] : costData;
    const unitCost = Number(row?.unit_cost ?? 0) || 0;
    const cost_source = row?.cost_source ?? "zero_fallback";
    if (row?.warning) {
      costWarnings.push({ core_product_id: l.core_product_id, core_variant_id: l.core_variant_id, cost_source, warning: row.warning });
    }
    linesToInsert.push({
      production_order_id: orderRow.id,
      core_product_id: l.core_product_id,
      core_variant_id: l.core_variant_id,
      sku: l.sku,
      variant_sku: l.variant_sku,
      variant_label: l.variant_label,
      size: l.size,
      quantity_ordered: l.quantity_ordered,
      quantity_completed: 0,
      quantity_pending: l.quantity_pending,
      status: "pending",
      estimated_unit_cost: unitCost || null,
      cost_source,
    });
  }

  const { error: linesErr } = await supabase
    .from("core_production_order_lines")
    .insert(linesToInsert);
  if (linesErr) throw linesErr;

  // Links + actualizar necesidades (sin duplicar: cada need se procesa una sola vez)
  const links: any[] = [];
  const processedNeedIds = new Set<string>();
  for (const l of linesArr) {
    for (const { need, qty } of l._needs) {
      links.push({
        production_order_id: orderRow.id,
        production_need_id: need.id,
        quantity_taken: qty,
        created_by: userId,
      });
      if (processedNeedIds.has(need.id)) continue;
      processedNeedIds.add(need.id);
      const newConverted = Number(need.quantity_converted_to_order) + qty;
      const newPending = Math.max(
        0,
        Number(need.quantity_approved) - newConverted,
      );
      const fullyConverted =
        newConverted >= Number(need.quantity_needed) && newPending === 0;
      await supabase
        .from("core_production_needs")
        .update({
          quantity_converted_to_order: newConverted,
          quantity_pending: newPending,
          status: fullyConverted
            ? "converted_to_order"
            : "partially_converted",
          updated_by: userId,
        })
        .eq("id", need.id);
      await audit(
        supabase,
        "core_production_needs",
        need.id,
        "convert_to_order",
        "quantity_converted_to_order",
        String(need.quantity_converted_to_order),
        String(newConverted),
        userId,
      );
    }
  }
  if (links.length) {
    await supabase.from("core_production_order_need_links").insert(links);
  }

  // Procesos: si es un único producto, los traemos de su estructura de costos.
  // Si es multiproducto, no insertamos procesos a nivel orden (cada unidad
  // queda sin procesos vinculados al header — los procesos por producto deben
  // resolverse por línea en un paso posterior si se requiere).
  let processCount = 0;
  if (!isMultiProduct && headerProductId) {
    processCount = await insertProcessesForOrder(
      supabase,
      orderRow.id,
      headerProductId,
    );
  }

  await audit(
    supabase,
    "core_production_orders",
    orderRow.id,
    "create_from_needs",
    null,
    null,
    orderRow.order_code,
    userId,
  );

  return json({
    created: [
      {
        id: orderRow.id,
        order_code: orderRow.order_code,
        total_quantity: totalQty,
        lines: linesToInsert.length,
        processes: processCount,
        is_overproduction: isOverproduction,
        multi_product: isMultiProduct,
        distinct_products: distinctProductIds.length,
      },
    ],
    count: 1,
  });
}

async function createManual(
  supabase: any,
  body: ManualBody,
  userId: string | null,
) {
  if (!body.core_product_id) return json({ error: "core_product_id requerido" }, 400);
  if (!body.lines?.length) return json({ error: "lines requerido" }, 400);
  if (!body.reason) return json({ error: "reason obligatorio" }, 400);
  if (body.lines.some((l) => !l.core_variant_id || Number(l.quantity) <= 0)) {
    return json({ error: "Cada línea requiere core_variant_id y quantity > 0" }, 400);
  }

  const { data: prod } = await supabase
    .from("core_products")
    .select("id,core_sku,name")
    .eq("id", body.core_product_id)
    .maybeSingle();
  if (!prod) return json({ error: "Producto no encontrado" }, 404);

  const variantIds = body.lines.map((l) => l.core_variant_id);
  const [{ data: variants }, { data: prodInfo }] = await Promise.all([
    supabase
      .from("core_product_variants")
      .select("id,variant_sku,variant_label,size,woo_variation_id,cost_override_enabled,cost_structure_id")
      .in("id", variantIds),
    supabase.from("core_products").select("id, unit_cost").eq("id", body.core_product_id).maybeSingle(),
  ]);
  const vmap = new Map((variants ?? []).map((v: any) => [v.id, v]));

  const totalQty = body.lines.reduce((a, l) => a + Number(l.quantity), 0);

  const { data: orderRow, error: orderErr } = await supabase
    .from("core_production_orders")
    .insert({
      status: "open",
      order_type: "manual",
      priority: body.priority ?? "media",
      core_product_id: body.core_product_id,
      sku: prod.core_sku,
      product_name: prod.name,
      total_quantity: totalQty,
      completed_quantity: 0,
      pending_quantity: totalQty,
      source: "manual",
      expected_date: body.expected_date ?? null,
      responsible_user_id: body.responsible_user_id ?? null,
      reason: body.reason,
      notes: body.notes ?? null,
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();
  if (orderErr) throw orderErr;

  const linesToInsert: any[] = [];
  for (const l of body.lines) {
    const v: any = vmap.get(l.core_variant_id);
    const { data: costData } = await supabase.rpc("resolve_core_variant_unit_cost", {
      p_product_id: body.core_product_id,
      p_variant_id: l.core_variant_id,
    });
    const unitCost = Number(costData ?? 0) || 0;
    let cost_source = "zero_fallback";
    if (unitCost > 0) {
      if (v && v.cost_override_enabled && v.cost_structure_id) {
        cost_source = "variant_override";
      } else {
        const legacy = Number((prodInfo as any)?.unit_cost ?? 0) || 0;
        cost_source = legacy > 0 && Math.abs(legacy - unitCost) < 1e-6
          ? "product_unit_cost"
          : "product_base";
      }
    }
    linesToInsert.push({
      production_order_id: orderRow.id,
      core_product_id: body.core_product_id,
      core_variant_id: l.core_variant_id,
      sku: prod.core_sku,
      variant_sku: v?.variant_sku ?? null,
      variant_label: v?.variant_label ?? null,
      size: v?.size ?? null,
      quantity_ordered: Number(l.quantity),
      quantity_completed: 0,
      quantity_pending: Number(l.quantity),
      status: "pending",
      estimated_unit_cost: unitCost || null,
      cost_source,
    });
  }
  const { error: linesErr } = await supabase
    .from("core_production_order_lines")
    .insert(linesToInsert);
  if (linesErr) throw linesErr;

  const processCount = await insertProcessesForOrder(
    supabase,
    orderRow.id,
    body.core_product_id,
  );

  await audit(
    supabase,
    "core_production_orders",
    orderRow.id,
    "create_manual",
    null,
    null,
    orderRow.order_code,
    userId,
  );

  return json({
    created: [
      {
        id: orderRow.id,
        order_code: orderRow.order_code,
        total_quantity: totalQty,
        lines: linesToInsert.length,
        processes: processCount,
      },
    ],
    count: 1,
  });
}
