
-- Homepage segments table
CREATE TABLE public.homepage_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  subtitle text DEFAULT '',
  provider_type text DEFAULT 'all',
  source_type text NOT NULL DEFAULT 'category_based',
  category_ids text[] DEFAULT '{}',
  search_query text DEFAULT '',
  search_order_by text DEFAULT 'Volume:Desc',
  manual_item_ids text[] DEFAULT '{}',
  item_count integer NOT NULL DEFAULT 24,
  pool_size integer NOT NULL DEFAULT 60,
  cache_duration_days integer NOT NULL DEFAULT 7,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  icon_name text DEFAULT NULL,
  logo_url text DEFAULT NULL,
  visible_on text NOT NULL DEFAULT 'both',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Homepage segment snapshots (cached product data)
CREATE TABLE public.homepage_segment_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id uuid NOT NULL REFERENCES public.homepage_segments(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]',
  item_count integer NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  version integer NOT NULL DEFAULT 1,
  generation_source text DEFAULT 'scheduled',
  otapi_calls_used integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.homepage_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_segment_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS: admins manage, anyone reads active
CREATE POLICY "Admins can manage homepage_segments" ON public.homepage_segments FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Anyone can read active homepage_segments" ON public.homepage_segments FOR SELECT TO public USING (is_active = true);

CREATE POLICY "Admins can manage homepage_segment_snapshots" ON public.homepage_segment_snapshots FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Anyone can read homepage_segment_snapshots" ON public.homepage_segment_snapshots FOR SELECT TO public USING (true);

-- Updated_at trigger
CREATE TRIGGER update_homepage_segments_updated_at BEFORE UPDATE ON public.homepage_segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Index for fast lookups
CREATE INDEX idx_homepage_segments_active ON public.homepage_segments(is_active, display_order);
CREATE INDEX idx_homepage_segment_snapshots_segment ON public.homepage_segment_snapshots(segment_id, generated_at DESC);
