
-- Create the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================
-- Price Configuration
-- ============================================
CREATE TABLE public.price_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  config_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.price_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage price config" ON public.price_config FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Anyone can read price config" ON public.price_config FOR SELECT USING (true);

INSERT INTO public.price_config (config_key, config_value, description) VALUES
  ('exchange_rates', '{"CNY_MNT": 480, "USD_MNT": 3450}', 'Валютын ханш'),
  ('provider_markups', '{"taobao": 15, "poizon": 20, "1688": 12, "default": 15}', 'Нийлүүлэгч тус бүрийн нэмэгдэл хувь'),
  ('round_prices', '{"enabled": true, "precision": 0}', 'Үнэ бүхэл тоо болгох'),
  ('discount_rules', '{"bulk_discount": [{"min_qty": 5, "discount_pct": 3}, {"min_qty": 10, "discount_pct": 5}]}', 'Хөнгөлөлтийн дүрэм'),
  ('price_tiers', '{"tiers": [{"min": 0, "max": 50000, "markup_pct": 20}, {"min": 50001, "max": 200000, "markup_pct": 15}, {"min": 200001, "max": null, "markup_pct": 10}]}', 'Үнийн шатлал');

-- ============================================
-- Content Pages
-- ============================================
CREATE TABLE public.content_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content text,
  page_type text NOT NULL DEFAULT 'page',
  status text NOT NULL DEFAULT 'draft',
  seo_title text,
  seo_description text,
  seo_image text,
  display_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.content_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage content pages" ON public.content_pages FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Anyone can view published content" ON public.content_pages FOR SELECT USING (status = 'published');

-- ============================================
-- Catalog Collections
-- ============================================
CREATE TABLE public.catalog_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'manual',
  rules jsonb DEFAULT '[]'::jsonb,
  item_ids text[] DEFAULT '{}'::text[],
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.catalog_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage collections" ON public.catalog_collections FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Anyone can view active collections" ON public.catalog_collections FOR SELECT USING (is_active = true);

-- ============================================
-- Catalog Restrictions
-- ============================================
CREATE TABLE public.catalog_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restriction_type text NOT NULL,
  target_id text NOT NULL,
  target_name text,
  reason text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.catalog_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage restrictions" ON public.catalog_restrictions FOR ALL USING (is_admin(auth.uid()));

-- ============================================
-- Admin Settings
-- ============================================
CREATE TABLE public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text NOT NULL DEFAULT 'general',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage settings" ON public.admin_settings FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Anyone can read settings" ON public.admin_settings FOR SELECT USING (true);

INSERT INTO public.admin_settings (setting_key, setting_value, category, description) VALUES
  ('site_name', '"Only"', 'general', 'Сайтын нэр'),
  ('site_description', '"Only - Таны худалдааны платформ"', 'general', 'Сайтын тайлбар'),
  ('default_order_status', '"pending"', 'orders', 'Захиалгын анхдагч төлөв'),
  ('auto_confirm_orders', 'false', 'orders', 'Захиалга автоматаар баталгаажуулах'),
  ('order_notification_email', '""', 'orders', 'Захиалгын мэдэгдэл имэйл'),
  ('seo_default_title', '"Only - Онлайн дэлгүүр"', 'seo', 'SEO анхдагч гарчиг'),
  ('seo_default_description', '"Only - Монголын шилдэг онлайн худалдааны платформ"', 'seo', 'SEO анхдагч тайлбар'),
  ('social_og_image', '""', 'seo', 'Social sharing зураг');

-- ============================================
-- Audit Log
-- ============================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can create audit logs" ON public.audit_logs FOR INSERT WITH CHECK (is_admin(auth.uid()));

-- ============================================
-- Newsletter Subscribers
-- ============================================
CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text,
  is_active boolean DEFAULT true,
  source text DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage subscribers" ON public.newsletter_subscribers FOR ALL USING (is_admin(auth.uid()));

-- Triggers
CREATE TRIGGER update_price_config_updated_at BEFORE UPDATE ON public.price_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_content_pages_updated_at BEFORE UPDATE ON public.content_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON public.catalog_collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.admin_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
