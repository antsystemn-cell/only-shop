-- =====================================================
-- PHASE A: Foundation for Admin Sales/Inventory/Expenses
-- =====================================================

-- 1.1 Extend orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'website_order',
  ADD COLUMN IF NOT EXISTS should_create_delivery BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS delivery_creation_mode TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS affects_analytics BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS affects_revenue BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_historical BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sale_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS cost_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_profit NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS internal_tags TEXT[] NOT NULL DEFAULT '{}';

-- Backfill existing rows
UPDATE public.orders
SET sale_date = created_at
WHERE sale_date IS NULL OR sale_date = '1970-01-01'::timestamptz;

-- Indexes for filters
CREATE INDEX IF NOT EXISTS idx_orders_source_type ON public.orders(source_type);
CREATE INDEX IF NOT EXISTS idx_orders_sale_date ON public.orders(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_is_manual ON public.orders(is_manual) WHERE is_manual = true;
CREATE INDEX IF NOT EXISTS idx_orders_is_historical ON public.orders(is_historical) WHERE is_historical = true;

-- 1.2 Extend order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_cost NUMERIC NOT NULL DEFAULT 0;

-- 1.3 Stock movements ledger
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'restock', 'manual_adjust', 'sale_deduction', 'website_order_deduction',
    'historical_deduction', 'return_to_stock', 'damaged_lost', 'cancellation_restore'
  )),
  quantity_before INTEGER NOT NULL,
  quantity_change INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  reason TEXT,
  note TEXT,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant ON public.stock_movements(variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON public.stock_movements(movement_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON public.stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON public.stock_movements(created_at DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage stock_movements"
  ON public.stock_movements FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Order staff can manage stock_movements"
  ON public.stock_movements FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'order_staff'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'order_staff'::app_role));

-- 1.4 Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  payment_method TEXT,
  note TEXT,
  attachment_url TEXT,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage expenses"
  ON public.expenses FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1.5 Inventory settings
INSERT INTO public.admin_settings (category, setting_key, setting_value, description)
VALUES
  ('inventory', 'allow_negative_stock', 'false'::jsonb, 'Allow stock to go below zero'),
  ('inventory', 'default_low_stock_threshold', '5'::jsonb, 'Default low stock alert threshold')
ON CONFLICT (setting_key) DO NOTHING;

-- 1.6 RPC: create_manual_sale (atomic)
CREATE OR REPLACE FUNCTION public.create_manual_sale(
  p_source_type TEXT,
  p_is_historical BOOLEAN,
  p_sale_date TIMESTAMPTZ,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT,
  p_payment_method TEXT,
  p_payment_status TEXT,
  p_fulfillment_status TEXT,
  p_should_create_delivery BOOLEAN,
  p_affects_inventory BOOLEAN,
  p_affects_analytics BOOLEAN,
  p_affects_revenue BOOLEAN,
  p_subtotal NUMERIC,
  p_discount_amount NUMERIC,
  p_delivery_fee NUMERIC,
  p_total NUMERIC,
  p_cost_amount NUMERIC,
  p_notes TEXT,
  p_internal_note TEXT,
  p_address_text TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_item JSONB;
  v_product_id UUID;
  v_variant_id UUID;
  v_qty INTEGER;
  v_current_stock INTEGER;
  v_allow_negative BOOLEAN;
  v_new_stock INTEGER;
  v_movement_type TEXT;
  v_user_id UUID := auth.uid();
BEGIN
  -- Permission check
  IF NOT (public.is_admin(v_user_id) OR public.has_role(v_user_id, 'order_staff'::app_role)) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT COALESCE((setting_value)::text::boolean, false)
    INTO v_allow_negative
    FROM public.admin_settings
   WHERE setting_key = 'allow_negative_stock'
   LIMIT 1;

  v_order_number := 'MAN-' || TO_CHAR(now(), 'YYYYMMDD') || '-' ||
                    LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  v_movement_type := CASE
    WHEN p_is_historical THEN 'historical_deduction'
    ELSE 'sale_deduction'
  END;

  -- Insert order
  INSERT INTO public.orders (
    order_number, source, source_type, is_manual, is_historical,
    sale_date, customer_name, customer_phone, customer_email,
    payment_method, payment_status, fulfillment_status, status,
    should_create_delivery, delivery_creation_mode, delivery_sync_status,
    affects_inventory, affects_analytics, affects_revenue,
    subtotal, discount_amount, delivery_fee, total, cost_amount,
    notes, internal_note, address_text,
    created_by_user_id
  ) VALUES (
    v_order_number,
    'admin',
    p_source_type,
    true,
    p_is_historical,
    p_sale_date,
    p_customer_name, p_customer_phone, p_customer_email,
    p_payment_method, p_payment_status, p_fulfillment_status,
    CASE WHEN p_payment_status = 'paid' THEN 'completed'::order_status ELSE 'pending'::order_status END,
    p_should_create_delivery,
    CASE WHEN p_should_create_delivery THEN 'manual' ELSE 'none' END,
    CASE WHEN p_should_create_delivery THEN 'pending' ELSE 'disabled' END,
    p_affects_inventory, p_affects_analytics, p_affects_revenue,
    p_subtotal, p_discount_amount, p_delivery_fee, p_total, p_cost_amount,
    p_notes, p_internal_note, p_address_text,
    v_user_id
  )
  RETURNING id INTO v_order_id;

  -- Iterate items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id','')::UUID;
    v_variant_id := NULLIF(v_item->>'variant_id','')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;

    -- Insert order_item
    INSERT INTO public.order_items (
      order_id, product_id, variant_id, quantity,
      unit_price, total_price, line_total, unit_cost, line_cost,
      product_snapshot, product_name_snapshot, sku_snapshot,
      variant_name_snapshot, color_snapshot, size_snapshot
    ) VALUES (
      v_order_id, v_product_id, v_variant_id, v_qty,
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC * v_qty,
      (v_item->>'unit_price')::NUMERIC * v_qty,
      COALESCE((v_item->>'unit_cost')::NUMERIC, 0),
      COALESCE((v_item->>'unit_cost')::NUMERIC, 0) * v_qty,
      COALESCE(v_item->'product_snapshot', '{}'::jsonb),
      v_item->>'product_name',
      v_item->>'sku',
      v_item->>'variant_name',
      v_item->>'color',
      v_item->>'size'
    );

    -- Inventory deduction
    IF p_affects_inventory THEN
      IF v_variant_id IS NOT NULL THEN
        SELECT stock INTO v_current_stock FROM public.product_variants WHERE id = v_variant_id FOR UPDATE;
        IF v_current_stock IS NULL THEN
          RAISE EXCEPTION 'Variant % not found', v_variant_id;
        END IF;
        v_new_stock := v_current_stock - v_qty;
        IF v_new_stock < 0 AND NOT v_allow_negative THEN
          RAISE EXCEPTION 'Insufficient stock for variant %: have %, need %', v_variant_id, v_current_stock, v_qty;
        END IF;
        UPDATE public.product_variants SET stock = v_new_stock WHERE id = v_variant_id;
      ELSIF v_product_id IS NOT NULL THEN
        SELECT stock INTO v_current_stock FROM public.products WHERE id = v_product_id FOR UPDATE;
        IF v_current_stock IS NULL THEN
          RAISE EXCEPTION 'Product % not found', v_product_id;
        END IF;
        v_new_stock := v_current_stock - v_qty;
        IF v_new_stock < 0 AND NOT v_allow_negative THEN
          RAISE EXCEPTION 'Insufficient stock for product %: have %, need %', v_product_id, v_current_stock, v_qty;
        END IF;
        UPDATE public.products SET stock = v_new_stock WHERE id = v_product_id;
      END IF;

      -- Stock movement log
      IF v_product_id IS NOT NULL OR v_variant_id IS NOT NULL THEN
        INSERT INTO public.stock_movements (
          product_id, variant_id, movement_type,
          quantity_before, quantity_change, quantity_after,
          reference_type, reference_id, reason, created_by_user_id
        ) VALUES (
          v_product_id, v_variant_id, v_movement_type,
          v_current_stock, -v_qty, v_new_stock,
          'order', v_order_id,
          CASE WHEN p_is_historical THEN 'Historical sale backfill' ELSE 'Manual sale' END,
          v_user_id
        );
      END IF;
    END IF;
  END LOOP;

  -- Mark inventory applied
  IF p_affects_inventory THEN
    UPDATE public.orders SET inventory_applied_at = now() WHERE id = v_order_id;
  END IF;

  RETURN v_order_id;
END;
$$;

-- 1.7 RPC: find_potential_duplicate_sale
CREATE OR REPLACE FUNCTION public.find_potential_duplicate_sale(
  p_phone TEXT,
  p_sale_date TIMESTAMPTZ,
  p_total NUMERIC
)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  sale_date TIMESTAMPTZ,
  total NUMERIC,
  customer_phone TEXT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, order_number, sale_date, total, customer_phone
    FROM public.orders
   WHERE customer_phone = p_phone
     AND ABS(EXTRACT(EPOCH FROM (sale_date - p_sale_date))) < 86400
     AND ABS(total - p_total) < 0.01
   ORDER BY sale_date DESC
   LIMIT 5;
$$;

-- 1.8 RPC: restore_sale_inventory (cancellation)
CREATE OR REPLACE FUNCTION public.restore_sale_inventory(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_current_stock INTEGER;
  v_user_id UUID := auth.uid();
BEGIN
  IF NOT (public.is_admin(v_user_id) OR public.has_role(v_user_id, 'order_staff'::app_role)) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Only restore once
  IF NOT EXISTS (
    SELECT 1 FROM public.orders
     WHERE id = p_order_id
       AND inventory_applied_at IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  FOR v_item IN
    SELECT product_id, variant_id, quantity
      FROM public.order_items
     WHERE order_id = p_order_id
  LOOP
    IF v_item.variant_id IS NOT NULL THEN
      SELECT stock INTO v_current_stock FROM public.product_variants WHERE id = v_item.variant_id FOR UPDATE;
      UPDATE public.product_variants SET stock = stock + v_item.quantity WHERE id = v_item.variant_id;
      INSERT INTO public.stock_movements (
        product_id, variant_id, movement_type,
        quantity_before, quantity_change, quantity_after,
        reference_type, reference_id, reason, created_by_user_id
      ) VALUES (
        v_item.product_id, v_item.variant_id, 'cancellation_restore',
        v_current_stock, v_item.quantity, v_current_stock + v_item.quantity,
        'order', p_order_id, 'Order cancelled — stock restored', v_user_id
      );
    ELSIF v_item.product_id IS NOT NULL THEN
      SELECT stock INTO v_current_stock FROM public.products WHERE id = v_item.product_id FOR UPDATE;
      UPDATE public.products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;
      INSERT INTO public.stock_movements (
        product_id, variant_id, movement_type,
        quantity_before, quantity_change, quantity_after,
        reference_type, reference_id, reason, created_by_user_id
      ) VALUES (
        v_item.product_id, NULL, 'cancellation_restore',
        v_current_stock, v_item.quantity, v_current_stock + v_item.quantity,
        'order', p_order_id, 'Order cancelled — stock restored', v_user_id
      );
    END IF;
  END LOOP;

  UPDATE public.orders SET inventory_applied_at = NULL WHERE id = p_order_id;
END;
$$;

-- 1.9 RPC: adjust_stock (manual restock / damage / etc.)
CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_product_id UUID,
  p_variant_id UUID,
  p_quantity_change INTEGER,
  p_movement_type TEXT,
  p_reason TEXT,
  p_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_stock INTEGER;
  v_new_stock INTEGER;
  v_allow_negative BOOLEAN;
  v_user_id UUID := auth.uid();
BEGIN
  IF NOT (public.is_admin(v_user_id) OR public.has_role(v_user_id, 'order_staff'::app_role)) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF p_movement_type NOT IN ('restock','manual_adjust','return_to_stock','damaged_lost') THEN
    RAISE EXCEPTION 'Invalid movement type: %', p_movement_type;
  END IF;

  SELECT COALESCE((setting_value)::text::boolean, false)
    INTO v_allow_negative
    FROM public.admin_settings WHERE setting_key = 'allow_negative_stock' LIMIT 1;

  IF p_variant_id IS NOT NULL THEN
    SELECT stock INTO v_current_stock FROM public.product_variants WHERE id = p_variant_id FOR UPDATE;
    IF v_current_stock IS NULL THEN RAISE EXCEPTION 'Variant not found'; END IF;
    v_new_stock := v_current_stock + p_quantity_change;
    IF v_new_stock < 0 AND NOT v_allow_negative THEN
      RAISE EXCEPTION 'Stock would go negative (% -> %)', v_current_stock, v_new_stock;
    END IF;
    UPDATE public.product_variants SET stock = v_new_stock WHERE id = p_variant_id;
  ELSIF p_product_id IS NOT NULL THEN
    SELECT stock INTO v_current_stock FROM public.products WHERE id = p_product_id FOR UPDATE;
    IF v_current_stock IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
    v_new_stock := v_current_stock + p_quantity_change;
    IF v_new_stock < 0 AND NOT v_allow_negative THEN
      RAISE EXCEPTION 'Stock would go negative (% -> %)', v_current_stock, v_new_stock;
    END IF;
    UPDATE public.products SET stock = v_new_stock WHERE id = p_product_id;
  ELSE
    RAISE EXCEPTION 'Must provide product_id or variant_id';
  END IF;

  INSERT INTO public.stock_movements (
    product_id, variant_id, movement_type,
    quantity_before, quantity_change, quantity_after,
    reference_type, reason, note, created_by_user_id
  ) VALUES (
    p_product_id, p_variant_id, p_movement_type,
    v_current_stock, p_quantity_change, v_new_stock,
    'manual', p_reason, p_note, v_user_id
  );
END;
$$;