
-- Update orders_count and total_spent from local orders table
UPDATE customers_cache cc
SET
  orders_count = stats.cnt,
  total_spent = stats.spent
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

-- Also update last_order_date from orders table
UPDATE customers_cache cc
SET
  last_order_date = stats.last_date
FROM (
  SELECT
    customer_email,
    MAX(order_datetime) as last_date
  FROM orders
  WHERE customer_email IS NOT NULL
  GROUP BY customer_email
) stats
WHERE cc.email = stats.customer_email
  AND (cc.last_order_date IS NULL OR stats.last_date > cc.last_order_date);
