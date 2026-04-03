DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orders'
      AND policyname = 'Admins can create orders'
  ) THEN
    CREATE POLICY "Admins can create orders"
    ON public.orders
    FOR INSERT
    TO authenticated
    WITH CHECK (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_items'
      AND policyname = 'Admins can create order items'
  ) THEN
    CREATE POLICY "Admins can create order items"
    ON public.order_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    );
  END IF;
END
$$;