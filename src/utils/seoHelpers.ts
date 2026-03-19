// ─── Centralized SEO Helpers ────────────────────────────────
// Provides consistent fallback logic for SEO images, titles, descriptions

const DEFAULT_SEO_IMAGE = "https://only.mn/pwa-icon-512.png";
const SITE_NAME = "Онли";
const SITE_URL = "https://only.mn";

/**
 * Get the best SEO image from a context (product, category, page).
 * Always returns an absolute URL.
 */
export function getSeoImage(
  context:
    | { type: "product"; images?: (string | null | undefined)[] | null; imageUrl?: string | null }
    | { type: "category"; imageUrl?: string | null; firstProductImage?: string | null }
    | { type: "page"; coverImage?: string | null }
    | { type: "default" }
): string {
  let url: string | null | undefined;

  switch (context.type) {
    case "product":
      url = context.images?.[0] || context.imageUrl || null;
      break;
    case "category":
      url = context.imageUrl || context.firstProductImage || null;
      break;
    case "page":
      url = context.coverImage || null;
      break;
    default:
      url = null;
  }

  return ensureAbsoluteUrl(url) || DEFAULT_SEO_IMAGE;
}

/**
 * Ensure a URL is absolute. Filters out base64 and blob URLs.
 */
function ensureAbsoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("blob:")) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  // Relative URL → make absolute
  return `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export { DEFAULT_SEO_IMAGE, SITE_NAME, SITE_URL };
