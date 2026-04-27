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
  v_user_id UUID := auth.uid();
  v_item JSONB;
  v_product_id UUID;
  v_variant_id UUID;
  v_qty INTEGER;
  v_current_stock INTEGER;
  v_new_stock INTEGER;
  v_allow_negative BOOLEAN := false;
  v_movement_type TEXT;
  v_status_value public.order_status;
BEGIN
  SELECT COALESCE((setting_value->>'enabled')::boolean, false)
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

  -- Map fulfillment_status / payment_status to valid order_status enum
  v_status_value := CASE
    WHEN p_fulfillment_status = 'delivered' THEN 'delivered'::public.order_status
    WHEN p_fulfillment_status = 'shipped' THEN 'shipped'::public.order_status
    WHEN p_fulfillment_status = 'cancelled' THEN 'cancelled'::public.order_status
    WHEN p_fulfillment_status IN ('processing','confirmed','packed') THEN 'processing'::public.order_status
    WHEN p_payment_status = 'paid' THEN 'delivered'::public.order_status
    ELSE 'pending'::public.order_status
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
    v_status_value,
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
    IF p_affects_inventory AND v_product_id IS NOT NULL THEN
      IF v_variant_id IS NOT NULL THEN
        SELECT stock INTO v_current_stock FROM public.product_variants WHERE id = v_variant_id FOR UPDATE;
        v_new_stock := COALESCE(v_current_stock,0) - v_qty;
        IF v_new_stock < 0 AND NOT v_allow_negative THEN
          RAISE EXCEPTION 'Үлдэгдэл хүрэлцэхгүй байна (variant %): үлдэгдэл %, хасагдах %', v_variant_id, v_current_stock, v_qty;
        END IF;
        UPDATE public.product_variants SET stock = v_new_stock, updated_at = now() WHERE id = v_variant_id;

        INSERT INTO public.stock_movements (
          product_id, variant_id, movement_type, quantity_change,
          quantity_before, quantity_after, reason, reference_type, reference_id, created_by_user_id
        ) VALUES (
          v_product_id, v_variant_id, v_movement_type, -v_qty,
          COALESCE(v_current_stock,0), v_new_stock,
          CASE WHEN p_is_historical THEN 'historical_sale' ELSE 'manual_sale' END,
          'order', v_order_id, v_user_id
        );
      ELSE
        SELECT stock INTO v_current_stock FROM public.products WHERE id = v_product_id FOR UPDATE;
        v_new_stock := COALESCE(v_current_stock,0) - v_qty;
        IF v_new_stock < 0 AND NOT v_allow_negative THEN
          RAISE EXCEPTION 'Үлдэгдэл хүрэлцэхгүй байна (product %): үлдэгдэл %, хасагдах %', v_product_id, v_current_stock, v_qty;
        END IF;
        UPDATE public.products SET stock = v_new_stock, updated_at = now() WHERE id = v_product_id;

        INSERT INTO public.stock_movements (
          product_id, variant_id, movement_type, quantity_change,
          quantity_before, quantity_after, reason, reference_type, reference_id, created_by_user_id
        ) VALUES (
          v_product_id, NULL, v_movement_type, -v_qty,
          COALESCE(v_current_stock,0), v_new_stock,
          CASE WHEN p_is_historical THEN 'historical_sale' ELSE 'manual_sale' END,
          'order', v_order_id, v_user_id
        );
      END IF;
    END IF;
  END LOOP;

  IF p_affects_inventory THEN
    UPDATE public.orders SET inventory_applied_at = now() WHERE id = v_order_id;
  END IF;

  RETURN v_order_id;
END;
$$;