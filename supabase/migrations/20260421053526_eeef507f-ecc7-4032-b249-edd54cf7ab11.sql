-- Backfill all order_items.unit_cost from current product/variant effective costs
UPDATE order_items oi
SET unit_cost = public.get_product_effective_cost(oi.product_id, oi.variant_id),
    line_cost = public.get_product_effective_cost(oi.product_id, oi.variant_id) * oi.quantity
WHERE oi.product_id IS NOT NULL
  AND public.get_product_effective_cost(oi.product_id, oi.variant_id) > 0;

-- Recalc all orders that had items updated
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT order_id FROM order_items WHERE unit_cost > 0 LOOP
    PERFORM public.recalc_order_profit(r.order_id);
  END LOOP;
END $$;

-- Trigger: when product cost changes, refresh unit_cost on its existing order_items
CREATE OR REPLACE FUNCTION public.trg_refresh_order_costs_on_product_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF (COALESCE(NEW.cost_price,0) IS DISTINCT FROM COALESCE(OLD.cost_price,0))
     OR (COALESCE(NEW.landed_cost,0) IS DISTINCT FROM COALESCE(OLD.landed_cost,0))
     OR (COALESCE(NEW.additional_cost,0) IS DISTINCT FROM COALESCE(OLD.additional_cost,0)) THEN
    UPDATE order_items SET
      unit_cost = public.get_product_effective_cost(product_id, variant_id),
      line_cost = public.get_product_effective_cost(product_id, variant_id) * quantity
    WHERE product_id = NEW.id;
    FOR r IN SELECT DISTINCT order_id FROM order_items WHERE product_id = NEW.id LOOP
      PERFORM public.recalc_order_profit(r.order_id);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_products_cost_change ON public.products;
CREATE TRIGGER trg_products_cost_change
AFTER UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_order_costs_on_product_change();

CREATE OR REPLACE FUNCTION public.trg_refresh_order_costs_on_variant_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF (COALESCE(NEW.cost_price,0) IS DISTINCT FROM COALESCE(OLD.cost_price,0))
     OR (COALESCE(NEW.landed_cost,0) IS DISTINCT FROM COALESCE(OLD.landed_cost,0)) THEN
    UPDATE order_items SET
      unit_cost = public.get_product_effective_cost(product_id, variant_id),
      line_cost = public.get_product_effective_cost(product_id, variant_id) * quantity
    WHERE variant_id = NEW.id;
    FOR r IN SELECT DISTINCT order_id FROM order_items WHERE variant_id = NEW.id LOOP
      PERFORM public.recalc_order_profit(r.order_id);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_variants_cost_change ON public.product_variants;
CREATE TRIGGER trg_variants_cost_change
AFTER UPDATE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_order_costs_on_variant_change();

-- Auto-set unit_cost when new order_item is inserted without one
CREATE OR REPLACE FUNCTION public.trg_set_order_item_cost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.unit_cost,0) = 0 AND NEW.product_id IS NOT NULL THEN
    NEW.unit_cost := public.get_product_effective_cost(NEW.product_id, NEW.variant_id);
    NEW.line_cost := NEW.unit_cost * NEW.quantity;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_order_items_set_cost ON public.order_items;
CREATE TRIGGER trg_order_items_set_cost
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.trg_set_order_item_cost();

-- Recalc trigger on order_items insert/update/delete (in case missing)
DROP TRIGGER IF EXISTS trg_order_items_recalc ON public.order_items;
CREATE TRIGGER trg_order_items_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_order_profit();

-- Recalc trigger on orders self-update (delivery/packaging changes)
DROP TRIGGER IF EXISTS trg_orders_recalc_self ON public.orders;
CREATE TRIGGER trg_orders_recalc_self
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_order_self();