// ─── Image URL Optimization ────────────────────────────────
// Use optimized thumbnail sizes for product grids vs detail pages

/**
 * Get optimized image URL for product grids (smaller images)
 */
export function getGridImageUrl(url: string): string {
  if (!url) return "/placeholder.svg";
  
  // Alicdn (Taobao/Tmall) - use 310px thumbnail
  if (url.includes("alicdn.com") && !url.includes("_310x310")) {
    // Replace existing size suffix or add one
    const base = url.replace(/_\d+x\d+q\d+\.jpg$/, "");
    return `${base}_310x310q90.jpg`;
  }
  
  // Poizon CDN - images are already reasonably sized
  return url;
}

/**
 * Get optimized image URL for product detail pages
 */
export function getDetailImageUrl(url: string): string {
  if (!url) return "/placeholder.svg";
  
  // Alicdn - use 600px version
  if (url.includes("alicdn.com") && !url.includes("_600x600")) {
    const base = url.replace(/_\d+x\d+q\d+\.jpg$/, "");
    return `${base}_600x600q90.jpg`;
  }
  
  return url;
}

/**
 * Preload an image in the background
 */
export function preloadImage(url: string): void {
  if (!url || url === "/placeholder.svg") return;
  const img = new Image();
  img.src = getGridImageUrl(url);
}

/**
 * Preload multiple images
 */
export function preloadImages(urls: string[], limit = 6): void {
  urls.slice(0, limit).forEach(preloadImage);
}
