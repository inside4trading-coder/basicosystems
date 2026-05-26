ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS line_total_original numeric,
  ADD COLUMN IF NOT EXISTS line_total_currency text,
  ADD COLUMN IF NOT EXISTS exchange_rate numeric,
  ADD COLUMN IF NOT EXISTS line_total_usd numeric;

-- Backfill from orders for existing rows
UPDATE public.order_items oi
SET line_total_original = COALESCE(oi.line_total_original, oi.line_total),
    line_total_currency = COALESCE(oi.line_total_currency, o.order_currency),
    exchange_rate = COALESCE(oi.exchange_rate, o.exchange_rate),
    line_total_usd = COALESCE(
      oi.line_total_usd,
      CASE
        WHEN COALESCE(o.order_currency, 'USD') = 'USD' THEN oi.line_total
        WHEN o.exchange_rate IS NOT NULL AND o.exchange_rate > 1 THEN oi.line_total / o.exchange_rate
        ELSE NULL
      END
    )
FROM public.orders o
WHERE oi.order_id = o.order_id;