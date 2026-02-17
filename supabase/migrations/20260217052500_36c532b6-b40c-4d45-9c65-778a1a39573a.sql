
-- Provider sections: admin-managed product sections for each provider page
CREATE TABLE public.provider_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_type TEXT NOT NULL, -- 'Poizon', 'Taobao', 'all'
  title TEXT NOT NULL,
  icon_name TEXT, -- lucide icon name
  search_query TEXT, -- search keyword to use
  category_id TEXT, -- OT category ID to filter by
  order_by TEXT DEFAULT 'Volume:Desc',
  page_size INTEGER DEFAULT 12,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.provider_sections ENABLE ROW LEVEL SECURITY;

-- Public read access (everyone can see sections)
CREATE POLICY "Provider sections are publicly readable"
ON public.provider_sections FOR SELECT USING (true);

-- Admin-only write
CREATE POLICY "Only admins can manage provider sections"
ON public.provider_sections FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Provider strip items: admin-managed provider buttons in the top strip
CREATE TABLE public.provider_strip_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE, -- URL slug like 'poizon', 'taobao'
  provider_type TEXT NOT NULL, -- maps to OTAPI provider
  logo_url TEXT,
  bg_color TEXT DEFAULT '#10b981', -- background color for the strip
  text_color TEXT DEFAULT '#ffffff',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_strip_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Provider strip items are publicly readable"
ON public.provider_strip_items FOR SELECT USING (true);

CREATE POLICY "Only admins can manage provider strip items"
ON public.provider_strip_items FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Insert default provider strip items
INSERT INTO public.provider_strip_items (name, slug, provider_type, logo_url, display_order) VALUES
  ('ONLY', 'home', 'all', NULL, 0),
  ('POIZON', 'poizon', 'Poizon', NULL, 1),
  ('TAOBAO', 'taobao', 'Taobao', NULL, 2);

-- Insert default sections for Poizon
INSERT INTO public.provider_sections (provider_type, title, icon_name, search_query, display_order) VALUES
  ('Poizon', 'Танд санал болгох', 'sparkles', 'trending', 0),
  ('Poizon', 'Өнөөдрийн онцлох', 'star', 'popular', 1),
  ('Poizon', 'Гутал & Пүүз', 'footprints', 'shoes sneakers', 2),
  ('Poizon', 'Үнэртэй ус', 'droplets', 'perfume fragrance', 3),
  ('Poizon', 'Хувцас', 'shirt', 'clothing fashion', 4),
  ('Poizon', 'Гэр ахуй', 'home', 'home living', 5),
  ('Poizon', 'Хүүхдийн бараа', 'baby', 'kids children', 6);

-- Insert default sections for Taobao  
INSERT INTO public.provider_sections (provider_type, title, icon_name, search_query, display_order) VALUES
  ('Taobao', 'Танд санал болгох', 'sparkles', 'trending popular', 0),
  ('Taobao', 'Өнөөдрийн онцлох', 'star', 'hot sale', 1),
  ('Taobao', 'Электроник', 'smartphone', 'electronics gadgets', 2),
  ('Taobao', 'Гэр ахуй', 'home', 'home kitchen', 3),
  ('Taobao', 'Хувцас & Загвар', 'shirt', 'fashion clothing', 4),
  ('Taobao', 'Гоо сайхан', 'heart', 'beauty cosmetics', 5),
  ('Taobao', 'Спорт', 'dumbbell', 'sports fitness', 6);

-- Trigger for updated_at
CREATE TRIGGER update_provider_sections_updated_at
BEFORE UPDATE ON public.provider_sections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_provider_strip_items_updated_at
BEFORE UPDATE ON public.provider_strip_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
