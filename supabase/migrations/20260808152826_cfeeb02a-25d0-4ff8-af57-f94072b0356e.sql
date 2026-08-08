ALTER TABLE public.esp_material_items
  ADD COLUMN IF NOT EXISTS replenishment_priority text NOT NULL DEFAULT 'normal';

ALTER TABLE public.esp_material_items
  DROP CONSTRAINT IF EXISTS esp_material_items_replenishment_priority_check;

ALTER TABLE public.esp_material_items
  ADD CONSTRAINT esp_material_items_replenishment_priority_check
  CHECK (replenishment_priority IN ('normal','low'));

UPDATE public.esp_material_items SET replenishment_priority = 'normal' WHERE replenishment_priority IS NULL;