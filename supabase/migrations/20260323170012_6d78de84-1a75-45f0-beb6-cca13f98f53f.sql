CREATE OR REPLACE FUNCTION public.refresh_customers_order_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE customers_cache cc
  SET
    orders_count = COALESCE(stats.cnt, 0),
    total_spent = COALESCE(stats.spent, 0)
  FROM (
    SELECT
      customer_email,
      COUNT(*) as cnt,
      SUM(COALESCE(total_amount_usd, total_amount, 0)) as spent
    FROM orders
    WHERE customer_email IS NOT NULL
    GROUP BY customer_email
  ) stats
  WHERE cc.email = stats.customer_email;
END;
$$;