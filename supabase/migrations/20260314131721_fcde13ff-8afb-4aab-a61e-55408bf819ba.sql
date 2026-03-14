-- Fix categories missing external_id/provider_type: extract number from 'otc-XXXX'
UPDATE ot_categories 
SET 
  external_id = REPLACE(internal_id, 'otc-', ''),
  provider_type = 'Taobao',
  is_active = false
WHERE source_type = 'otapi-provider' 
  AND (external_id IS NULL OR provider_type IS NULL)
  AND internal_id LIKE 'otc-%';

-- Also ensure manual categories go back to hidden
UPDATE ot_categories 
SET is_active = false 
WHERE source_type = 'manual' AND is_active = true;