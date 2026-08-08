ALTER TABLE public.esp_fabrication_requests
  ADD COLUMN IF NOT EXISTS manual_reason text,
  ADD COLUMN IF NOT EXISTS manual_reason_detail text,
  ADD COLUMN IF NOT EXISTS requires_shipping boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ship_to_name text,
  ADD COLUMN IF NOT EXISTS ship_to_phone text,
  ADD COLUMN IF NOT EXISTS ship_to_address text,
  ADD COLUMN IF NOT EXISTS ship_to_city text,
  ADD COLUMN IF NOT EXISTS ship_to_province text,
  ADD COLUMN IF NOT EXISTS ship_to_postal_code text,
  ADD COLUMN IF NOT EXISTS ship_to_country text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_esp_fab_manual_reason') THEN
    ALTER TABLE public.esp_fabrication_requests
      ADD CONSTRAINT chk_esp_fab_manual_reason CHECK (
        manual_reason IS NULL OR manual_reason IN (
          'reemplazo','error_pedido','defecto','cambio_talla','muestra','colaboracion','produccion_interna','pedido_especial','otro'
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_esp_fab_priority') THEN
    ALTER TABLE public.esp_fabrication_requests
      ADD CONSTRAINT chk_esp_fab_priority CHECK (priority IN ('normal','alta','urgente','low','high','urgent'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_esp_fab_source_type ON public.esp_fabrication_requests (source_type);