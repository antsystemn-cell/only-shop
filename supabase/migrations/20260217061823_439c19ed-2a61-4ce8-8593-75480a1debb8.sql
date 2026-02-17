
-- Add show_categories flag to provider_strip_items so admin can toggle category strip per provider
ALTER TABLE public.provider_strip_items 
ADD COLUMN IF NOT EXISTS show_categories boolean DEFAULT true;

-- Add a "home" provider_type sections support - we'll use existing sections table
-- Add provider label to display in section titles on home page
ALTER TABLE public.provider_sections
ADD COLUMN IF NOT EXISTS show_on_home boolean DEFAULT false;
