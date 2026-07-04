-- Añadir campos de trazabilidad de costo resuelto por línea de OP
ALTER TABLE public.core_production_order_lines
  ADD COLUMN IF NOT EXISTS estimated_unit_cost numeric,
  ADD COLUMN IF NOT EXISTS cost_source text;

COMMENT ON COLUMN public.core_production_order_lines.estimated_unit_cost IS 'Costo unitario resuelto por resolve_core_variant_unit_cost al crear la línea.';
COMMENT ON COLUMN public.core_production_order_lines.cost_source IS 'Origen: variant_override | product_base | product_unit_cost | zero_fallback';