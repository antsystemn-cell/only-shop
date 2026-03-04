
-- Allow anonymous uploads for image search (non-authenticated users)
CREATE POLICY "Anyone can upload image search files"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'image-search');
