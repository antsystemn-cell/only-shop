-- Add weight column to product_variants table
ALTER TABLE public.product_variants
ADD COLUMN weight text NULL;