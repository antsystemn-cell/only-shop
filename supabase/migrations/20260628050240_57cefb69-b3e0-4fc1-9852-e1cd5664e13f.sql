
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS purchase_cost_cny numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exchange_rate_cny numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cargo_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pickup_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fb_boost_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_cost_note text;
