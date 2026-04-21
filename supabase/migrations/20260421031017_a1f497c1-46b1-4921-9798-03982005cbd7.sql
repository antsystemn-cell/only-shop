-- 1. PRODUCTS өртгийн талбарууд
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS landed_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packaging_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_delivery_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_margin_threshold numeric DEFAULT 15;

-- 2. PRODUCT_VARIANTS өртгийн талбарууд
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS landed_cost numeric DEFAULT 0;

-- 3. ORDER_ITEMS-д хүргэлтийн зардал
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS delivery_cost numeric NOT NULL DEFAULT 0;

-- 4. ORDERS-д ашгийн талбарууд
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_cost_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packaging_cost_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_profit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_profit numeric NOT NULL DEFAULT 0;

-- 5. Үр дүнтэй өртөг буцаах функц (variant > product, landed > cost)
CREATE OR REPLACE FUNCTION public.get_product_effective_cost(
  p_product_id uuid,
  p_variant_id uuid DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cost numeric := 0;
  v_v_landed numeric;
  v_v_cost numeric;
  v_p_landed numeric;
  v_p_cost numeric;
  v_p_additional numeric;
BEGIN
  IF p_variant_id IS NOT NULL THEN
    SELECT landed_cost, cost_price INTO v_v_landed, v_v_cost
      FROM product_variants WHERE id = p_variant_id;
    IF COALESCE(v_v_landed,0) > 0 THEN RETURN v_v_landed; END IF;
    IF COALESCE(v_v_cost,0) > 0 THEN RETURN v_v_cost; END IF;
  END IF;
  IF p_product_id IS NOT NULL THEN
    SELECT landed_cost, cost_price, COALESCE(additional_cost,0)
      INTO v_p_landed, v_p_cost, v_p_additional
      FROM products WHERE id = p_product_id;
    IF COALESCE(v_p_landed,0) > 0 THEN RETURN v_p_landed + v_p_additional; END IF;
    IF COALESCE(v_p_cost,0) > 0 THEN RETURN v_p_cost + v_p_additional; END IF;
  END IF;
  RETURN 0;
END;
$$;

-- 6. Захиалгын ашгийг дахин тооцох функц
CREATE OR REPLACE FUNCTION public.recalc_order_profit(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_revenue numeric := 0;
  v_cost numeric := 0;
  v_delivery_paid numeric := 0;
  v_packaging numeric := 0;
  v_discount numeric := 0;
  v_delivery_fee numeric := 0;
  v_gross numeric;
  v_net numeric;
BEGIN
  SELECT COALESCE(SUM(unit_price * quantity), 0),
         COALESCE(SUM(unit_cost * quantity), 0)
    INTO v_revenue, v_cost
    FROM order_items WHERE order_id = p_order_id;

  SELECT COALESCE(delivery_cost_paid, 0),
         COALESCE(packaging_cost_total, 0),
         COALESCE(discount_amount, 0),
         COALESCE(delivery_fee, 0)
    INTO v_delivery_paid, v_packaging, v_discount, v_delivery_fee
    FROM orders WHERE id = p_order_id;

  v_gross := v_revenue - v_cost;
  v_net := v_revenue + v_delivery_fee - v_discount - v_cost - v_delivery_paid - v_packaging;

  UPDATE orders SET
    cost_amount = v_cost,
    gross_profit = v_gross,
    net_profit = v_net,
    estimated_profit = v_net
   WHERE id = p_order_id;
END;
$$;

-- 7. Trigger: order_items өөрчлөгдөхөд recalc
CREATE OR REPLACE FUNCTION public.trg_recalc_order_profit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_order_profit(OLD.order_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_order_profit(NEW.order_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS recalc_profit_on_items ON public.order_items;
CREATE TRIGGER recalc_profit_on_items
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_order_profit();

-- 8. Trigger: orders өөрчлөгдөхөд (delivery_cost_paid г.м.) recalc
CREATE OR REPLACE FUNCTION public.trg_recalc_order_self()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (NEW.delivery_cost_paid IS DISTINCT FROM OLD.delivery_cost_paid)
     OR (NEW.packaging_cost_total IS DISTINCT FROM OLD.packaging_cost_total)
     OR (NEW.discount_amount IS DISTINCT FROM OLD.discount_amount)
     OR (NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee) THEN
    PERFORM public.recalc_order_profit(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recalc_profit_on_order ON public.orders;
CREATE TRIGGER recalc_profit_on_order
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_order_self();

-- 9. Backfill: одоо байгаа order_items-д cost-г бөглөх (хэрэв 0 бол)
UPDATE public.order_items oi SET unit_cost = c.eff_cost,
       line_cost = c.eff_cost * oi.quantity
  FROM (
    SELECT oi2.id,
           public.get_product_effective_cost(oi2.product_id, oi2.variant_id) AS eff_cost
      FROM public.order_items oi2
     WHERE COALESCE(oi2.unit_cost,0) = 0
  ) c
 WHERE oi.id = c.id AND c.eff_cost > 0;

-- 10. Backfill: бүх захиалгын ашгийг дахин тооцох
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.orders LOOP
    PERFORM public.recalc_order_profit(r.id);
  END LOOP;
END $$;