-- Add price column to product_variants for absolute pricing (not adjustment)
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS price numeric DEFAULT NULL;

-- Add name column for variant display name  
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS name text DEFAULT NULL;

-- Update existing variants: calculate absolute price from product base + adjustment
UPDATE public.product_variants pv
SET price = COALESCE(
  (SELECT p.price FROM public.products p WHERE p.id = pv.product_id) + COALESCE(pv.price_adjustment, 0),
  0
)
WHERE pv.price IS NULL;

-- Add comment explaining the new pricing model
COMMENT ON COLUMN public.product_variants.price IS 'Absolute variant price. When set, this is the full price shown to customers.';
COMMENT ON COLUMN public.product_variants.price_adjustment IS 'DEPRECATED: Use price column instead. Kept for backward compatibility.';
COMMENT ON COLUMN public.product_variants.name IS 'Display name for the variant (e.g., "Pro Max 256GB Blue")';