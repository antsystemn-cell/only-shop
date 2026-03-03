
-- Create storage bucket for provider logos
INSERT INTO storage.buckets (id, name, public) VALUES ('provider-logos', 'provider-logos', true);

-- Public read access
CREATE POLICY "Anyone can view provider logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'provider-logos');

-- Admin upload/update/delete
CREATE POLICY "Admins can upload provider logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'provider-logos' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can update provider logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'provider-logos' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete provider logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'provider-logos' AND public.is_admin(auth.uid()));
