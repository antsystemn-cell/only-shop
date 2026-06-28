
DROP POLICY IF EXISTS "Admins can manage location stock" ON public.product_location_stock;

CREATE POLICY "Admins and order staff can manage location stock"
ON public.product_location_stock
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'order_staff'::app_role))
WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'order_staff'::app_role));
