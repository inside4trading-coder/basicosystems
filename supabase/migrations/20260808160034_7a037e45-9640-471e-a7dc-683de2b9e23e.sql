ALTER TABLE public.esp_fabrication_requests
  ADD COLUMN IF NOT EXISTS pos_sale_id uuid,
  ADD COLUMN IF NOT EXISTS pos_sale_item_id uuid,
  ADD COLUMN IF NOT EXISTS pos_sale_number text,
  ADD COLUMN IF NOT EXISTS pos_location_id uuid,
  ADD COLUMN IF NOT EXISTS pos_location_name text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_esp_fab_pos_sale_item
  ON public.esp_fabrication_requests (pos_sale_item_id)
  WHERE pos_sale_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_esp_fab_source_type_status
  ON public.esp_fabrication_requests (source_type, status);

CREATE OR REPLACE FUNCTION public.esp_create_pos_restock_candidate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sale record;
  v_loc record;
  v_variant record;
  v_label text;
BEGIN
  SELECT id, sale_number, location_id, status, created_by
    INTO v_sale
    FROM public.esp_sales
   WHERE id = NEW.sale_id;

  IF v_sale.id IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(v_sale.status,'') = 'cancelled' THEN RETURN NEW; END IF;
  IF NEW.woo_order_item_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT id, name, inventory_mode INTO v_loc
    FROM public.esp_locations WHERE id = v_sale.location_id;

  IF v_loc.id IS NULL THEN RETURN NEW; END IF;
  IF v_loc.inventory_mode NOT IN ('own_stock','linked_stock') THEN RETURN NEW; END IF;

  SELECT id, variant_sku, size, color INTO v_variant
    FROM public.esp_product_variants WHERE id = NEW.variant_id;

  v_label := NULLIF(TRIM(COALESCE(NEW.variant_label_snapshot,
              CONCAT_WS(' · ', v_variant.size, v_variant.color))), '');

  INSERT INTO public.esp_fabrication_requests(
    source_type, status, priority, quantity,
    product_id, variant_id, sku, product_name, variant_label,
    pos_sale_id, pos_sale_item_id, pos_sale_number, pos_location_id, pos_location_name,
    notes, created_by
  ) VALUES (
    'pos_restock', 'pending_approval', 'normal', GREATEST(COALESCE(NEW.quantity,1),1),
    NEW.product_id, NEW.variant_id,
    COALESCE(NEW.sku_snapshot, v_variant.variant_sku),
    NEW.product_name_snapshot,
    v_label,
    v_sale.id, NEW.id, v_sale.sale_number, v_loc.id, v_loc.name,
    CONCAT('Restock sugerido por venta POS ', COALESCE(v_sale.sale_number,''), ' · ', v_loc.name),
    v_sale.created_by
  )
  ON CONFLICT (pos_sale_item_id) WHERE pos_sale_item_id IS NOT NULL
  DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_esp_sale_items_pos_restock ON public.esp_sale_items;
CREATE TRIGGER trg_esp_sale_items_pos_restock
AFTER INSERT ON public.esp_sale_items
FOR EACH ROW EXECUTE FUNCTION public.esp_create_pos_restock_candidate();