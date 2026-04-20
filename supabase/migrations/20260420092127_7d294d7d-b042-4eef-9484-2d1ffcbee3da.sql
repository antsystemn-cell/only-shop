CREATE OR REPLACE FUNCTION public.swap_order_item_product(
  p_order_item_id uuid,
  p_new_product_id uuid,
  p_new_variant_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item record;
  v_order record;
  v_old_pid uuid;
  v_old_vid uuid;
  v_qty integer;
  v_before integer;
  v_after integer;
  v_new_product record;
  v_snapshot jsonb;
BEGIN
  IF NOT (public.is_admin(v_user_id) OR public.has_role(v_user_id, 'order_staff'::app_role)) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO v_item FROM order_items WHERE id = p_order_item_id;
  IF v_item IS NULL THEN RAISE EXCEPTION 'Order item not found'; END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_item.order_id;
  v_old_pid := v_item.product_id;
  v_old_vid := v_item.variant_id;
  v_qty := v_item.quantity;

  -- Restore old stock if inventory was applied
  IF v_order.inventory_applied_at IS NOT NULL THEN
    IF v_old_vid IS NOT NULL THEN
      SELECT stock INTO v_before FROM product_variants WHERE id = v_old_vid FOR UPDATE;
      v_after := v_before + v_qty;
      UPDATE product_variants SET stock = v_after WHERE id = v_old_vid;
      INSERT INTO stock_movements (product_id, variant_id, movement_type, quantity_before, quantity_change, quantity_after, reference_type, reference_id, reason, created_by_user_id)
      VALUES (v_old_pid, v_old_vid, 'cancellation_restore', v_before, v_qty, v_after, 'order', v_order.id, 'Барааг солихдоо хуучин үлдэгдлийг буцаасан', v_user_id);
    ELSIF v_old_pid IS NOT NULL THEN
      SELECT stock INTO v_before FROM products WHERE id = v_old_pid FOR UPDATE;
      v_after := v_before + v_qty;
      UPDATE products SET stock = v_after WHERE id = v_old_pid;
      INSERT INTO stock_movements (product_id, movement_type, quantity_before, quantity_change, quantity_after, reference_type, reference_id, reason, created_by_user_id)
      VALUES (v_old_pid, 'cancellation_restore', v_before, v_qty, v_after, 'order', v_order.id, 'Барааг солихдоо хуучин үлдэгдлийг буцаасан', v_user_id);
    END IF;
  END IF;

  -- Fetch new product
  SELECT id, name_mn, name, images, sku INTO v_new_product FROM products WHERE id = p_new_product_id;
  IF v_new_product IS NULL THEN RAISE EXCEPTION 'New product not found'; END IF;

  v_snapshot := jsonb_build_object(
    'name', v_new_product.name,
    'name_mn', v_new_product.name_mn,
    'images', to_jsonb(v_new_product.images)
  );

  -- Deduct new stock if inventory applied
  IF v_order.inventory_applied_at IS NOT NULL THEN
    IF p_new_variant_id IS NOT NULL THEN
      SELECT stock INTO v_before FROM product_variants WHERE id = p_new_variant_id FOR UPDATE;
      v_after := v_before - v_qty;
      UPDATE product_variants SET stock = v_after WHERE id = p_new_variant_id;
      INSERT INTO stock_movements (product_id, variant_id, movement_type, quantity_before, quantity_change, quantity_after, reference_type, reference_id, reason, created_by_user_id)
      VALUES (p_new_product_id, p_new_variant_id, 'sale_deduction', v_before, -v_qty, v_after, 'order', v_order.id, 'Барааг сольсон — шинэ үлдэгдлээс хассан', v_user_id);
    ELSE
      SELECT stock INTO v_before FROM products WHERE id = p_new_product_id FOR UPDATE;
      v_after := v_before - v_qty;
      UPDATE products SET stock = v_after WHERE id = p_new_product_id;
      INSERT INTO stock_movements (product_id, movement_type, quantity_before, quantity_change, quantity_after, reference_type, reference_id, reason, created_by_user_id)
      VALUES (p_new_product_id, 'sale_deduction', v_before, -v_qty, v_after, 'order', v_order.id, 'Барааг сольсон — шинэ үлдэгдлээс хассан', v_user_id);
    END IF;
  END IF;

  -- Update order_item
  UPDATE order_items SET
    product_id = p_new_product_id,
    variant_id = p_new_variant_id,
    product_snapshot = v_snapshot,
    product_name_snapshot = v_new_product.name_mn,
    sku_snapshot = v_new_product.sku
  WHERE id = p_order_item_id;
END;
$$;