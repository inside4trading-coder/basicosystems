ALTER TABLE public.esp_fabrication_requests
  ADD COLUMN IF NOT EXISTS production_note_id uuid REFERENCES public.esp_production_notes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_esp_fab_production_note ON public.esp_fabrication_requests(production_note_id);