
-- Orders table
CREATE TABLE public.orders (
  order_id bigint PRIMARY KEY,
  order_number text,
  order_datetime timestamptz,
  order_date date,
  order_status text,
  sale_channel text DEFAULT 'web',
  billing_state text,
  subtotal_amount numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  shipping_amount numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  refunded_amount numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  total_amount_usd numeric,
  exchange_rate numeric,
  order_currency text DEFAULT 'USD',
  customer_email text,
  customer_phone text,
  payment_method text,
  synced_at timestamptz DEFAULT now()
);

-- Order items table
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id bigint REFERENCES public.orders(order_id) ON DELETE CASCADE NOT NULL,
  line_item_id bigint,
  sku text,
  parent_sku text,
  product_name text,
  quantity integer DEFAULT 0,
  unit_price numeric DEFAULT 0,
  line_total numeric DEFAULT 0,
  item_cost numeric,
  size text,
  color text,
  analytic_category text
);

-- Payments table
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id bigint REFERENCES public.orders(order_id) ON DELETE CASCADE NOT NULL,
  payment_slot integer DEFAULT 1,
  payment_method text,
  payment_bank text,
  payment_amount numeric DEFAULT 0,
  payment_currency text DEFAULT 'USD',
  payment_reference text
);

-- Product costs table
CREATE TABLE public.product_costs (
  sku text PRIMARY KEY,
  product_name text,
  analytic_category text,
  collection text,
  unit_cost_total numeric DEFAULT 0,
  suggested_price numeric,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;

-- RLS: orders - admin and manager full access, partner read-only
CREATE POLICY "Admin and manager full access on orders" ON public.orders FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Partner can read orders" ON public.orders FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'partner'));

-- RLS: order_items
CREATE POLICY "Admin and manager full access on order_items" ON public.order_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Partner can read order_items" ON public.order_items FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'partner'));

-- RLS: payments
CREATE POLICY "Admin and manager full access on payments" ON public.payments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Partner can read payments" ON public.payments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'partner'));

-- RLS: product_costs - admin and manager only
CREATE POLICY "Admin and manager full access on product_costs" ON public.product_costs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin and manager can read product_costs" ON public.product_costs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Indexes
CREATE INDEX idx_orders_date ON public.orders(order_date);
CREATE INDEX idx_orders_status ON public.orders(order_status);
CREATE INDEX idx_orders_email ON public.orders(customer_email);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_order_items_sku ON public.order_items(sku);
CREATE INDEX idx_payments_order ON public.payments(order_id);
