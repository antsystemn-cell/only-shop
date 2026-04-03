
-- Extend orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS alternate_phone text,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS fulfillment_status text NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS address_text text,
  ADD COLUMN IF NOT EXISTS delivery_note text,
  ADD COLUMN IF NOT EXISTS map_lat numeric,
  ADD COLUMN IF NOT EXISTS map_lng numeric,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS internal_note text,
  ADD COLUMN IF NOT EXISTS affects_inventory boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inventory_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid,
  ADD COLUMN IF NOT EXISTS updated_by_user_id uuid;

-- Backfill fulfillment_status from existing status enum
UPDATE public.orders SET fulfillment_status = CASE
  WHEN status = 'pending' THEN 'confirmed'
  WHEN status = 'processing' THEN 'preparing'
  WHEN status = 'shipped' THEN 'out_for_delivery'
  WHEN status = 'delivered' THEN 'delivered'
  WHEN status = 'cancelled' THEN 'cancelled'
  ELSE 'confirmed'
END WHERE fulfillment_status = 'confirmed';

-- Extend order_items table
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid,
  ADD COLUMN IF NOT EXISTS product_name_snapshot text,
  ADD COLUMN IF NOT EXISTS sku_snapshot text,
  ADD COLUMN IF NOT EXISTS variant_name_snapshot text,
  ADD COLUMN IF NOT EXISTS color_snapshot text,
  ADD COLUMN IF NOT EXISTS size_snapshot text,
  ADD COLUMN IF NOT EXISTS line_total numeric;

UPDATE public.order_items SET line_total = total_price WHERE line_total IS NULL;

-- Order status logs
CREATE TABLE IF NOT EXISTS public.order_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_payment_status text,
  new_payment_status text,
  old_fulfillment_status text,
  new_fulfillment_status text,
  changed_by_user_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_status_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage order_status_logs"
  ON public.order_status_logs FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Order staff can manage order_status_logs"
  ON public.order_status_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'order_staff'));

CREATE POLICY "Users can view own order status logs"
  ON public.order_status_logs FOR SELECT TO authenticated
  USING (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));

CREATE INDEX idx_order_status_logs_order_id ON public.order_status_logs(order_id);

-- Inventory adjustments
CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  adjustment_type text NOT NULL DEFAULT 'order',
  quantity_change integer NOT NULL,
  note text,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage inventory_adjustments"
  ON public.inventory_adjustments FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Order staff can manage inventory_adjustments"
  ON public.inventory_adjustments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'order_staff'));

CREATE INDEX idx_inventory_adjustments_product ON public.inventory_adjustments(product_id);
CREATE INDEX idx_inventory_adjustments_order ON public.inventory_adjustments(order_id);

-- Role permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_key text NOT NULL,
  is_allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, permission_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage role_permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated can read role_permissions"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (true);

-- Default permissions
INSERT INTO public.role_permissions (role, permission_key, is_allowed) VALUES
  ('order_staff', 'orders.view', true),
  ('order_staff', 'orders.create', true),
  ('order_staff', 'orders.edit', true),
  ('order_staff', 'orders.update_payment_status', true),
  ('order_staff', 'orders.update_fulfillment_status', true),
  ('order_staff', 'orders.add_notes', true),
  ('order_staff', 'delivery.access', true),
  ('order_staff', 'orders.save_draft', true),
  ('admin', 'orders.view', true),
  ('admin', 'orders.create', true),
  ('admin', 'orders.edit', true),
  ('admin', 'orders.delete', true),
  ('admin', 'orders.update_payment_status', true),
  ('admin', 'orders.update_fulfillment_status', true),
  ('admin', 'orders.add_notes', true),
  ('admin', 'delivery.access', true),
  ('admin', 'orders.save_draft', true),
  ('admin', 'users.manage', true),
  ('admin', 'settings.manage', true)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Indexes on orders
CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON public.orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON public.orders(assigned_to_user_id);

-- RLS for order_staff on orders
CREATE POLICY "Order staff can view all orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'order_staff'));

CREATE POLICY "Order staff can create orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'order_staff'));

CREATE POLICY "Order staff can update orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'order_staff'));

-- RLS for order_staff on order_items
CREATE POLICY "Order staff can view all order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'order_staff'));

CREATE POLICY "Order staff can create order items"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'order_staff'));

CREATE POLICY "Order staff can update order items"
  ON public.order_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'order_staff'));

CREATE POLICY "Order staff can delete order items"
  ON public.order_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'order_staff'));
