// Generate / regenerate individual production units (QR) for a Production Order.
// Idempotent: never duplicates units. Re-runs only create missing ones.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_STATUSES = ["open", "in_production", "partially_completed", "draft"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const production_order_id: string | undefined = body.production_order_id;
    const allow_draft: boolean = !!body.allow_draft;
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

    // Identify caller (best effort)
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

    const { data: processes } = await supa
      .from("core_production_order_processes")
      .select("*")
      .eq("production_order_id", production_order_id)
      .order("process_order");

    const { data: existing } = await supa
      .from("core_production_units")
      .select("id, unit_code, production_order_line_id, size")
      .eq("production_order_id", production_order_id);

    const existingByLine: Record<string, number> = {};
    for (const u of existing ?? []) {
      const key = u.production_order_line_id ?? "_";
      existingByLine[key] = (existingByLine[key] ?? 0) + 1;
    }

    const createdUnits: any[] = [];
    let skipped = 0;

    // Detectar multiproducto: si las líneas tienen más de un sku distinto,
    // incluir el SKU del producto en unit_code para evitar colisiones
    // (ej. dos productos con talla L generarían el mismo código).
    const distinctSkus = Array.from(
      new Set((lines ?? []).map((l: any) => l.sku).filter(Boolean)),
    );
    const isMultiProduct = distinctSkus.length > 1;

    for (const line of lines ?? []) {
      const need = Number(line.quantity_ordered) || 0;
      const have = existingByLine[line.id] ?? 0;
      const toCreate = Math.max(0, need - have);
      if (toCreate === 0) { skipped += have; continue; }

      const sizeTag = (line.size ?? line.variant_label ?? "X").toString().toUpperCase().replace(/\s+/g, "");
      const productTag = isMultiProduct
        ? `-${String(line.sku ?? "P").toUpperCase().replace(/\s+/g, "")}`
        : "";

      for (let i = 0; i < toCreate; i++) {
        const seq = have + i + 1;
        const unit_code = `${order.order_code}${productTag}-${sizeTag}-${String(seq).padStart(3, "0")}`;
        const qr_token = crypto.randomUUID().replace(/-/g, "");
        const qr_payload = `/core/escaneo?unit=${qr_token}`;

        const { data: ins, error: insErr } = await supa
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
        if (insErr) {
          return new Response(JSON.stringify({ error: insErr.message, unit_code }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        createdUnits.push(ins);

        if (processes?.length) {
          const procRows = processes.map((p: any) => ({
            production_unit_id: ins.id,
            production_order_process_id: p.id,
            process_name: p.process_name,
            process_type: p.process_type,
            process_order: p.process_order,
            adds_to_payroll: p.adds_to_payroll,
            suggested_role: p.suggested_role,
            rate_snapshot: p.rate_snapshot,
            status: "pending",
          }));
          await supa.from("core_production_unit_processes").insert(procRows);
        }
      }
    }

    // Audit log
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
