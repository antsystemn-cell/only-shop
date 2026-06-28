
-- Stock locations configuration table
CREATE TABLE public.stock_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#625AFA',
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.stock_locations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_locations TO authenticated;
GRANT ALL ON public.stock_locations TO service_role;

ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active stock locations"
  ON public.stock_locations FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage stock locations"
  ON public.stock_locations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER stock_locations_updated_at
  BEFORE UPDATE ON public.stock_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-location stock tracking
CREATE TABLE public.product_location_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.stock_locations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, location_id)
);

CREATE INDEX idx_pls_product ON public.product_location_stock(product_id);
CREATE INDEX idx_pls_location ON public.product_location_stock(location_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_location_stock TO authenticated;
GRANT ALL ON public.product_location_stock TO service_role;

ALTER TABLE public.product_location_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view location stock"
  ON public.product_location_stock FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage location stock"
  ON public.product_location_stock FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER product_location_stock_updated_at
  BEFORE UPDATE ON public.product_location_stock
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.stock_locations (name, description, color, display_order) VALUES
  ('Агуулах салбар', 'Үндсэн агуулахад буй бараа', '#625AFA', 1),
  ('Жолоочид өгч явуулсан', 'Жолоочид хүлээлгэн өгсөн бараа', '#F59E0B', 2),
  ('Замд яваа', 'Хүргэлтийн замд буй бараа', '#3B82F6', 3);
