-- Create product_variants table for managing size, color, and dimensions
CREATE TABLE public.product_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size TEXT,
  color TEXT,
  color_hex TEXT,
  dimensions TEXT,
  price_adjustment NUMERIC DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  sku_suffix TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Admins can manage variants
CREATE POLICY "Admins can manage product variants"
ON public.product_variants
FOR ALL
USING (is_admin(auth.uid()));

-- Anyone can view active variants of active products
CREATE POLICY "Anyone can view active variants"
ON public.product_variants
FOR SELECT
USING (
  is_active = true 
  AND product_id IN (SELECT id FROM public.products WHERE is_active = true)
);

-- Create index for faster queries
CREATE INDEX idx_product_variants_product_id ON public.product_variants(product_id);

-- Add trigger for updated_at
CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();