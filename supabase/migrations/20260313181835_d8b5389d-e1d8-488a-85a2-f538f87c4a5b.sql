
-- Recently viewed products table
CREATE TABLE public.recently_viewed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'local',
  provider_product_id text NOT NULL,
  canonical_key text NOT NULL,
  title_snapshot text,
  image_snapshot text,
  price_snapshot numeric,
  currency text DEFAULT '₮',
  product_url text,
  first_viewed_at timestamptz NOT NULL DEFAULT now(),
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  view_count integer NOT NULL DEFAULT 1
);

-- Unique constraint for dedup
ALTER TABLE public.recently_viewed ADD CONSTRAINT recently_viewed_user_canonical_key UNIQUE (user_id, canonical_key);

-- Indexes for fast queries
CREATE INDEX idx_recently_viewed_user_last ON public.recently_viewed (user_id, last_viewed_at DESC);
CREATE INDEX idx_recently_viewed_user_provider ON public.recently_viewed (user_id, provider, last_viewed_at DESC);

-- RLS
ALTER TABLE public.recently_viewed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own history"
  ON public.recently_viewed FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own history"
  ON public.recently_viewed FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own history"
  ON public.recently_viewed FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own history"
  ON public.recently_viewed FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
