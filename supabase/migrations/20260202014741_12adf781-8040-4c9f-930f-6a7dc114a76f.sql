-- Create brands table
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  logo_url text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view active brands"
ON public.brands
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage brands"
ON public.brands
FOR ALL
USING (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_brands_updated_at
BEFORE UPDATE ON public.brands
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create storage bucket for brand logos
INSERT INTO storage.buckets (id, name, public) VALUES ('brands', 'brands', true);

-- Storage policies for brand logos
CREATE POLICY "Anyone can view brand logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'brands');

CREATE POLICY "Admins can upload brand logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'brands' AND is_admin(auth.uid()));

CREATE POLICY "Admins can update brand logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'brands' AND is_admin(auth.uid()));

CREATE POLICY "Admins can delete brand logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'brands' AND is_admin(auth.uid()));