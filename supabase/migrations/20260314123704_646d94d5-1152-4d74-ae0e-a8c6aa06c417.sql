
-- Insert Amazon root category
INSERT INTO ot_categories (internal_id, name_mn, name_en, provider_type, depth, display_order, is_active, source_type, is_parent_on_provider)
VALUES ('amazon-root', 'Amazon', 'Amazon', 'Amazon', 0, 9999, true, 'otapi-provider', true)
ON CONFLICT (internal_id) DO NOTHING;

-- Re-parent all depth-0 Amazon categories under the root
UPDATE ot_categories
SET parent_internal_id = 'amazon-root', depth = 1
WHERE provider_type = 'Amazon' AND depth = 0 AND internal_id != 'amazon-root';

-- Bump depth-1 Amazon categories to depth 2
UPDATE ot_categories
SET depth = 2
WHERE provider_type = 'Amazon' AND depth = 1 AND parent_internal_id != 'amazon-root' AND internal_id != 'amazon-root';
