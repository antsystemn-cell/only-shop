
CREATE TABLE public.catalog_item_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id text NOT NULL UNIQUE,
  title_override text,
  variant_overrides jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_item_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage overrides" ON public.catalog_item_overrides
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Anyone can read overrides" ON public.catalog_item_overrides
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE TRIGGER update_catalog_item_overrides_updated_at
  BEFORE UPDATE ON public.catalog_item_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
