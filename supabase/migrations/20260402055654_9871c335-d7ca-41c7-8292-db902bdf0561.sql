
DROP POLICY IF EXISTS "Authenticated users can upload image search files" ON storage.objects;

CREATE POLICY "Authenticated users can upload image search files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'image-search' 
  AND (storage.foldername(name))[1] = 'searches'
);
