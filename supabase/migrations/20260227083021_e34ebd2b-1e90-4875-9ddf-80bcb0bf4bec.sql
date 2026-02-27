
-- Create OT orders table for OTAPI marketplace orders
CREATE TABLE public.ot_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  delivery_type TEXT NOT NULL DEFAULT 'delivery',
  delivery_address JSONB,
  comment TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  item_count INTEGER NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ot_orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view own ot_orders"
  ON public.ot_orders FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own orders
CREATE POLICY "Users can create own ot_orders"
  ON public.ot_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow unauthenticated orders (guest checkout) - orders with null user_id
CREATE POLICY "Allow guest ot_orders insert"
  ON public.ot_orders FOR INSERT
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Allow guest ot_orders select by id"
  ON public.ot_orders FOR SELECT
  USING (user_id IS NULL);

-- Admins can view and update all orders
CREATE POLICY "Admins can view all ot_orders"
  ON public.ot_orders FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all ot_orders"
  ON public.ot_orders FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- Generate order number trigger
CREATE OR REPLACE FUNCTION public.generate_ot_order_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  NEW.order_number = 'OT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
    LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$function$;

CREATE TRIGGER generate_ot_order_number_trigger
  BEFORE INSERT ON public.ot_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_ot_order_number();

-- Updated_at trigger
CREATE TRIGGER update_ot_orders_updated_at
  BEFORE UPDATE ON public.ot_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
