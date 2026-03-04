
-- Create a public storage bucket for image search uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('image-search', 'image-search', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload image search files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'image-search');

-- Allow public read access
CREATE POLICY "Image search files are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'image-search');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their image search files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'image-search' AND auth.uid()::text = (storage.foldername(name))[1]);
