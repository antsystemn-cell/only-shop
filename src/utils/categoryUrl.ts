/**
 * Returns the URL slug for an OT category.
 * Uses seo_alias if available, otherwise falls back to internal_id.
 */
export function getCategorySlug(cat: { seo_alias?: string | null; internal_id: string }): string {
  return cat.seo_alias || cat.internal_id;
}

/**
 * Returns the full path for a category page.
 */
export function getCategoryPath(cat: { seo_alias?: string | null; internal_id: string }): string {
  return `/category/${getCategorySlug(cat)}`;
}
