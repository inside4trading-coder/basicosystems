ALTER TABLE public.core_cost_structures ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE public.core_cost_structures ADD COLUMN IF NOT EXISTS total_packaging numeric NOT NULL DEFAULT 0;
ALTER TABLE public.core_cost_structure_items DROP CONSTRAINT IF EXISTS core_cs_items_section_check;
ALTER TABLE public.core_cost_structure_items ADD CONSTRAINT core_cs_items_section_check CHECK (section IN ('raw_material','labor','technical_process','variable_cost','logistics','packaging','other'));