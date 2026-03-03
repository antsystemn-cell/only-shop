
-- Warehouse items: manually-entered products with fixed MNT prices
CREATE TABLE public.warehouse_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id text NOT NULL UNIQUE,  -- e.g. "wh-133301"
  title text NOT NULL DEFAULT '',
  description text,
  image_url text,
  images text[] DEFAULT '{}',
  price_mnt numeric NOT NULL DEFAULT 0,  -- fixed MNT price (no conversion)
  original_price_mnt numeric,  -- optional strikethrough price
  stock integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  provider_type text DEFAULT 'warehouse',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.warehouse_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage warehouse items"
  ON public.warehouse_items FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Anyone can view active warehouse items"
  ON public.warehouse_items FOR SELECT
  USING (is_active = true);

CREATE TRIGGER update_warehouse_items_updated_at
  BEFORE UPDATE ON public.warehouse_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_warehouse_items_item_id ON public.warehouse_items (item_id);
