-- Create separate wishlist table for external/OT products (string IDs)
CREATE TABLE IF NOT EXISTS public.ot_wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id TEXT NOT NULL,
  provider_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

ALTER TABLE public.ot_wishlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own ot_wishlists" ON public.ot_wishlists;
CREATE POLICY "Users can view own ot_wishlists"
ON public.ot_wishlists
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own ot_wishlists" ON public.ot_wishlists;
CREATE POLICY "Users can insert own ot_wishlists"
ON public.ot_wishlists
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own ot_wishlists" ON public.ot_wishlists;
CREATE POLICY "Users can delete own ot_wishlists"
ON public.ot_wishlists
FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ot_wishlists_user_id ON public.ot_wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_ot_wishlists_product_id ON public.ot_wishlists(product_id);