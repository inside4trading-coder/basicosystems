-- Add columns to preserve WooCommerce source-of-truth values
ALTER TABLE customers_cache ADD COLUMN IF NOT EXISTS woo_orders_count integer DEFAULT 0;
ALTER TABLE customers_cache ADD COLUMN IF NOT EXISTS woo_total_spent numeric DEFAULT 0;

-- Copy current values as baseline
UPDATE customers_cache SET woo_orders_count = COALESCE(orders_count, 0), woo_total_spent = COALESCE(total_spent, 0);

-- Replace refresh function with GREATEST logic
CREATE OR REPLACE FUNCTION public.refresh_customers_order_stats()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- First, reset orders_count/total_spent to the WooCommerce baseline for ALL customers
  UPDATE customers_cache
  SET
    orders_count = COALESCE(woo_orders_count, 0),
    total_spent = COALESCE(woo_total_spent, 0);

  -- Then, for customers that have local orders, use GREATEST between Woo and local
  UPDATE customers_cache cc
  SET
    orders_count = GREATEST(COALESCE(cc.woo_orders_count, 0), stats.cnt),
    total_spent = GREATEST(COALESCE(cc.woo_total_spent, 0), stats.spent)
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
$function$;