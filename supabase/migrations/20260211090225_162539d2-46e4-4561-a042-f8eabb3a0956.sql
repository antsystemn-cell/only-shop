
-- OT API category tree table
CREATE TABLE public.ot_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  internal_id text NOT NULL UNIQUE,
  external_id text,
  parent_internal_id text,
  name_mn text,
  name_en text,
  name_ru text,
  name_zh text,
  icon_url text,
  icon_class text,
  provider_type text,
  seo_alias text,
  item_ids text[] DEFAULT '{}'::text[],
  is_parent_on_provider boolean DEFAULT false,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  depth integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for tree traversal
CREATE INDEX idx_ot_categories_parent ON public.ot_categories(parent_internal_id);
CREATE INDEX idx_ot_categories_provider ON public.ot_categories(provider_type);
CREATE INDEX idx_ot_categories_internal_id ON public.ot_categories(internal_id);

-- Enable RLS
ALTER TABLE public.ot_categories ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view active OT categories"
  ON public.ot_categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage OT categories"
  ON public.ot_categories FOR ALL
  USING (is_admin(auth.uid()));

-- Timestamp trigger
CREATE TRIGGER update_ot_categories_updated_at
  BEFORE UPDATE ON public.ot_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
