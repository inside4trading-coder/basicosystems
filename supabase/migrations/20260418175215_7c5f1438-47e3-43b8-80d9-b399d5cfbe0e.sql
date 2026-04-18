CREATE OR REPLACE FUNCTION public.refresh_customers_order_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  WITH stats AS (
    SELECT
      LOWER(customer_email) AS email_lower,
      COUNT(*)::int AS cnt,
      SUM(COALESCE(total_amount_usd, total_amount, 0))::numeric AS spent
    FROM orders
    WHERE customer_email IS NOT NULL
      AND customer_email <> ''
      AND order_status IN ('completed', 'processing', 'on-hold')
    GROUP BY LOWER(customer_email)
  )
  UPDATE customers_cache cc
  SET
    orders_count = GREATEST(COALESCE(cc.woo_orders_count, 0), COALESCE(stats.cnt, 0)),
    total_spent  = GREATEST(COALESCE(cc.woo_total_spent, 0), COALESCE(stats.spent, 0))
  FROM stats
  WHERE LOWER(cc.email) = stats.email_lower;
END;
$function$;

SELECT public.refresh_customers_order_stats();