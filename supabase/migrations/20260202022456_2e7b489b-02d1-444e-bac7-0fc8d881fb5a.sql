-- Add images column to product_variants table for variant-specific images
ALTER TABLE public.product_variants
ADD COLUMN images text[] DEFAULT '{}'::text[];