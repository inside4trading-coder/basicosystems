
-- 1) Variantes: nuevas columnas (todas nullable/default seguras)
ALTER TABLE public.core_product_variants
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS normalized_color text,
  ADD COLUMN IF NOT EXISTS normalized_size text,
  ADD COLUMN IF NOT EXISTS variant_sku text,
  ADD COLUMN IF NOT EXISTS woo_attributes jsonb,
  ADD COLUMN IF NOT EXISTS cost_structure_id uuid,
  ADD COLUMN IF NOT EXISTS uses_parent_cost_structure boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cost_override_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS variant_unit_cost_usd numeric,
  ADD COLUMN IF NOT EXISTS cost_updated_at timestamptz;

-- FK a estructura de costo (SET NULL para no borrar cascada; sólo si no existe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'core_product_variants_cost_structure_id_fkey'
  ) THEN
    ALTER TABLE public.core_product_variants
      ADD CONSTRAINT core_product_variants_cost_structure_id_fkey
      FOREIGN KEY (cost_structure_id) REFERENCES public.core_cost_structures(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Reemplazar unique (core_product_id, size) por combinaciones que admitan color y por woo_variation_id
ALTER TABLE public.core_product_variants
  DROP CONSTRAINT IF EXISTS core_product_variants_core_product_id_size_key;

-- unique por (producto, size, color) — permite mismo talle en distintos colores
CREATE UNIQUE INDEX IF NOT EXISTS core_product_variants_product_size_color_uidx
  ON public.core_product_variants (core_product_id, size, COALESCE(color,''));

-- unique por woo_variation_id (cuando existe)
CREATE UNIQUE INDEX IF NOT EXISTS core_product_variants_woo_variation_uidx
  ON public.core_product_variants (woo_variation_id) WHERE woo_variation_id IS NOT NULL;

-- 2) Estructuras: variant_id opcional
ALTER TABLE public.core_cost_structures
  ADD COLUMN IF NOT EXISTS variant_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'core_cost_structures_variant_id_fkey'
  ) THEN
    ALTER TABLE public.core_cost_structures
      ADD CONSTRAINT core_cost_structures_variant_id_fkey
      FOREIGN KEY (variant_id) REFERENCES public.core_product_variants(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS core_cost_structures_variant_id_idx
  ON public.core_cost_structures (variant_id);

-- 3) Función de resolución de costo por variante
CREATE OR REPLACE FUNCTION public.resolve_core_variant_unit_cost(
  p_product_id uuid,
  p_variant_id uuid
) RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_variant record;
  v_sum numeric;
  v_base_id uuid;
  v_product_cost numeric;
BEGIN
  IF p_variant_id IS NOT NULL THEN
    SELECT * INTO v_variant FROM public.core_product_variants WHERE id = p_variant_id;
    IF v_variant.id IS NOT NULL
       AND v_variant.cost_override_enabled = true
       AND v_variant.cost_structure_id IS NOT NULL THEN
      SELECT COALESCE(SUM(subtotal), 0) INTO v_sum
        FROM public.core_cost_structure_items
        WHERE cost_structure_id = v_variant.cost_structure_id;
      RETURN COALESCE(v_sum, 0);
    END IF;
  END IF;

  -- estructura base del producto (variant_id NULL, activa preferida)
  SELECT id INTO v_base_id
    FROM public.core_cost_structures
   WHERE (variant_id IS NULL)
     AND (
       -- soporta esquemas con distintos nombres de vínculo a producto
       (to_jsonb((core_cost_structures)::record) ? 'core_product_id'
         AND (to_jsonb((core_cost_structures)::record)->>'core_product_id')::uuid = p_product_id)
       OR
       (to_jsonb((core_cost_structures)::record) ? 'product_id'
         AND (to_jsonb((core_cost_structures)::record)->>'product_id')::uuid = p_product_id)
     )
   ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, updated_at DESC
   LIMIT 1;

  IF v_base_id IS NOT NULL THEN
    SELECT COALESCE(SUM(subtotal), 0) INTO v_sum
      FROM public.core_cost_structure_items
      WHERE cost_structure_id = v_base_id;
    IF v_sum IS NOT NULL AND v_sum > 0 THEN
      RETURN v_sum;
    END IF;
  END IF;

  SELECT unit_cost INTO v_product_cost FROM public.core_products WHERE id = p_product_id;
  RETURN COALESCE(v_product_cost, 0);
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.resolve_core_variant_unit_cost(uuid, uuid) TO authenticated, service_role;
