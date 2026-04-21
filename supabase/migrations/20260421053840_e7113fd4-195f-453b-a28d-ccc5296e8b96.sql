-- Auto-populate delivery_cost_paid & packaging_cost_total from product defaults
-- when order_items are inserted

CREATE OR REPLACE FUNCTION public.trg_apply_product_logistics_to_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deliv numeric := 0;
  v_pack numeric := 0;
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT COALESCE(default_delivery_cost,0) * NEW.quantity,
           COALESCE(packaging_cost,0) * NEW.quantity
      INTO v_deliv, v_pack
      FROM products WHERE id = NEW.product_id;

    IF v_deliv > 0 OR v_pack > 0 THEN
      UPDATE orders
         SET delivery_cost_paid = COALESCE(delivery_cost_paid,0) + v_deliv,
             packaging_cost_total = COALESCE(packaging_cost_total,0) + v_pack
       WHERE id = NEW.order_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_order_items_apply_logistics ON public.order_items;
CREATE TRIGGER trg_order_items_apply_logistics
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.trg_apply_product_logistics_to_order();

-- Backfill: recompute delivery_cost_paid & packaging_cost_total for all orders
-- from current product defaults (only where currently 0, to preserve manual overrides)
WITH agg AS (
  SELECT oi.order_id,
         SUM(COALESCE(p.default_delivery_cost,0) * oi.quantity) AS deliv,
         SUM(COALESCE(p.packaging_cost,0) * oi.quantity) AS pack
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
   GROUP BY oi.order_id
)
UPDATE orders o
   SET delivery_cost_paid = agg.deliv,
       packaging_cost_total = agg.pack
  FROM agg
 WHERE o.id = agg.order_id
   AND COALESCE(o.delivery_cost_paid,0) = 0
   AND COALESCE(o.packaging_cost_total,0) = 0;

-- Recalc profit for all affected orders
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM orders WHERE delivery_cost_paid > 0 OR packaging_cost_total > 0 LOOP
    PERFORM public.recalc_order_profit(r.id);
  END LOOP;
END $$;