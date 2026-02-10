-- Add OT user ID column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ot_user_id text;

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_profiles_ot_user_id ON public.profiles(ot_user_id) WHERE ot_user_id IS NOT NULL;