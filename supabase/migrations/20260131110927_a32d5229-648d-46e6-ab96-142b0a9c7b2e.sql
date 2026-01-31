-- Create categories storage bucket for category images
INSERT INTO storage.buckets (id, name, public)
VALUES ('categories', 'categories', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to category images
CREATE POLICY "Public can view category images"
ON storage.objects FOR SELECT
USING (bucket_id = 'categories');

-- Allow admins to upload category images
CREATE POLICY "Admins can upload category images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'categories' AND is_admin(auth.uid()));

-- Allow admins to update category images
CREATE POLICY "Admins can update category images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'categories' AND is_admin(auth.uid()));

-- Allow admins to delete category images
CREATE POLICY "Admins can delete category images"
ON storage.objects FOR DELETE
USING (bucket_id = 'categories' AND is_admin(auth.uid()));