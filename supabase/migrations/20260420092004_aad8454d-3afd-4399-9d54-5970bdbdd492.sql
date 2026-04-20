CREATE OR REPLACE FUNCTION public.bank_import_deduct_stock(p_product_id uuid, p_qty integer, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_before integer;
  v_after integer;
BEGIN
  SELECT stock INTO v_before FROM products WHERE id = p_product_id FOR UPDATE;
  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;
  v_after := v_before - p_qty;
  UPDATE products SET stock = v_after WHERE id = p_product_id;
  INSERT INTO stock_movements (product_id, movement_type, quantity_before, quantity_change, quantity_after, reference_type, reason)
  VALUES (p_product_id, 'historical_deduction', v_before, -p_qty, v_after, 'manual', p_reason);
END;
$$;