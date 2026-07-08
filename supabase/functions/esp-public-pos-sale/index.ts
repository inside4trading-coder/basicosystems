import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { slug, token, pin, items, payment_method_id, notes, customer_name } = await req.json();
    if (!slug || !token || !payment_method_id || !Array.isArray(items) || items.length === 0) {
      return json({ error: 'invalid' }, 400);
    }

    const { data: loc } = await admin
      .from('esp_locations')
      .select('id,name,public_pos_enabled,public_pos_token,public_pos_pin')
      .eq('public_pos_slug', slug)
      .maybeSingle();
    if (!loc || !loc.public_pos_enabled || loc.public_pos_token !== token) return json({ error: 'invalid' }, 401);
    if (loc.public_pos_pin && loc.public_pos_pin !== pin) return json({ error: 'invalid_pin' }, 401);

    // Resolve channel for this location
    const { data: channels } = await admin
      .from('esp_sales_channels')
      .select('id,location_id,is_active')
      .eq('is_active', true);
    const channel = (channels || []).find((c: any) => c.location_id === loc.id) || (channels || [])[0] || null;

    // Server-side price + stock validation: re-fetch variants and prices
    const variantIds = items.map((i: any) => String(i.variant_id));
    const { data: variants } = await admin
      .from('esp_product_variants')
      .select('id,product_id,variant_sku,size,color,price_eur,status')
      .in('id', variantIds);
    const { data: products } = await admin
      .from('esp_products')
      .select('id,name,price_eur,status,is_sellable');

    const rpcItems = items.map((it: any) => {
      const v = (variants || []).find((x: any) => x.id === it.variant_id);
      const p = v ? (products || []).find((x: any) => x.id === v.product_id) : null;
      if (!v || !p || v.status !== 'active' || p.status !== 'active' || !p.is_sellable) {
        throw new Error('Producto no disponible');
      }
      const price = Number(v.price_eur ?? p.price_eur ?? 0);
      const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
      return { variant_id: v.id, quantity: qty, unit_price_eur: price };
    });

    const finalNotes = [customer_name ? `Cliente: ${customer_name}` : null, notes || null, `POS público (${loc.name})`]
      .filter(Boolean).join(' · ');

    const { data, error } = await admin.rpc('esp_register_pos_sale', {
      p_channel_id: channel?.id || null,
      p_location_id: loc.id,
      p_payment_method_id: payment_method_id,
      p_items: rpcItems,
      p_notes: finalNotes,
      p_payment_reference: null,
      p_allow_negative: false,
    });
    if (error) return json({ error: error.message }, 400);

    await admin
      .from('esp_locations')
      .update({ public_pos_last_used_at: new Date().toISOString() })
      .eq('id', loc.id);

    return json({ ok: true, sale: data, items: rpcItems });
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
