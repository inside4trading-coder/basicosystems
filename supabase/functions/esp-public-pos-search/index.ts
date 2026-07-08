import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { slug, token, pin, query } = await req.json();
    if (!slug || !token || !query) return json({ error: 'invalid' }, 400);

    const { data: loc } = await admin
      .from('esp_locations')
      .select('id,inventory_mode,linked_location_id,public_pos_enabled,public_pos_token,public_pos_pin')
      .eq('public_pos_slug', slug)
      .maybeSingle();
    if (!loc || !loc.public_pos_enabled || loc.public_pos_token !== token) return json({ error: 'invalid' }, 401);
    if (loc.public_pos_pin && loc.public_pos_pin !== pin) return json({ error: 'invalid_pin' }, 401);

    const invLocId = loc.inventory_mode === 'linked_stock' && loc.linked_location_id ? loc.linked_location_id : loc.id;
    const q = String(query).trim();

    const { data: variant } = await admin
      .from('esp_product_variants')
      .select('id,product_id,variant_sku,size,color,scan_code,barcode,qr_code,price_eur,status')
      .or(`scan_code.eq.${q},variant_sku.eq.${q},barcode.eq.${q},qr_code.eq.${q}`)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (!variant) return json({ error: 'not_found' }, 404);

    const { data: product } = await admin
      .from('esp_products')
      .select('id,name,sku,price_eur,status,is_sellable')
      .eq('id', variant.product_id)
      .maybeSingle();
    if (!product || product.status !== 'active' || !product.is_sellable) return json({ error: 'not_found' }, 404);

    const { data: stock } = await admin
      .from('esp_inventory_stock')
      .select('quantity_on_hand')
      .eq('variant_id', variant.id)
      .eq('location_id', invLocId)
      .maybeSingle();

    return json({
      variant_id: variant.id,
      product_name: product.name,
      variant_label: [product.name, variant.size, variant.color].filter(Boolean).join(' · '),
      color: variant.color,
      size: variant.size,
      sku: variant.variant_sku,
      price_eur: Number(variant.price_eur ?? product.price_eur ?? 0),
      stock_in_location: stock?.quantity_on_hand ?? 0,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
