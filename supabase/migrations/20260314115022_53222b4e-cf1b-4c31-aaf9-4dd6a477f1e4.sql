
-- Add source_type column to classify categories as official OTAPI or manually created
ALTER TABLE public.ot_categories 
ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'otapi-provider';

-- Add comment for documentation
COMMENT ON COLUMN public.ot_categories.source_type IS 'Category source: otapi-provider (from OTAPI sync) or manual (admin-created)';

-- Update existing categories: those with external_id are from OTAPI, those without are manual
UPDATE public.ot_categories 
SET source_type = 'manual' 
WHERE external_id IS NULL AND internal_id NOT LIKE 'otc-%';
