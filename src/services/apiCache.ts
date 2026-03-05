// ─── Multi-level API Cache with Request Deduplication ─────────
// Level 1: In-memory TTL cache
// Level 2: Request deduplication (inflight tracking)
// Level 3: Stale-while-revalidate

interface CacheEntry<T> {
  data: T;
  createdAt: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

// Performance monitoring
const slowRequests: Array<{ key: string; duration: number; timestamp: number }> = [];

export function getCacheStats() {
  return {
    cacheSize: cache.size,
    inflightSize: inflight.size,
    slowRequests: slowRequests.slice(-20),
  };
}

function isStale<T>(entry: CacheEntry<T>): boolean {
  return Date.now() - entry.createdAt > entry.ttl;
}

function isExpired<T>(entry: CacheEntry<T>): boolean {
  // Allow stale data for up to 2x TTL (stale-while-revalidate window)
  return Date.now() - entry.createdAt > entry.ttl * 2;
}

/**
 * Cached fetch with deduplication and stale-while-revalidate.
 * 
 * @param key - Unique cache key
 * @param fetcher - Async function to fetch data
 * @param ttl - Time-to-live in milliseconds
 * @returns Cached or fresh data
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  // Level 1: Check in-memory cache
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  
  if (existing && !isExpired(existing)) {
    if (isStale(existing)) {
      // Stale-while-revalidate: return stale data, refresh in background
      revalidateInBackground(key, fetcher, ttl);
    }
    return existing.data;
  }

  // Level 2: Request deduplication
  const existingRequest = inflight.get(key);
  if (existingRequest) {
    return existingRequest as Promise<T>;
  }

  // Execute fetch with deduplication
  const promise = executeFetch(key, fetcher, ttl);
  inflight.set(key, promise);
  
  try {
    const result = await promise;
    return result;
  } finally {
    inflight.delete(key);
  }
}

async function executeFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  const start = Date.now();
  try {
    const data = await fetcher();
    const duration = Date.now() - start;
    
    // Store in cache
    cache.set(key, { data, createdAt: Date.now(), ttl });
    
    // Performance monitoring
    if (duration > 1500) {
      slowRequests.push({ key, duration, timestamp: Date.now() });
      console.warn(`[apiCache] Slow request: ${key} took ${duration}ms`);
      // Keep only last 50 slow requests
      if (slowRequests.length > 50) slowRequests.splice(0, slowRequests.length - 50);
    }
    
    return data;
  } catch (error) {
    // On error, return stale data if available
    const stale = cache.get(key) as CacheEntry<T> | undefined;
    if (stale) {
      console.warn(`[apiCache] Fetch failed for ${key}, returning stale data`);
      return stale.data;
    }
    throw error;
  }
}

function revalidateInBackground<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): void {
  // Don't revalidate if already in-flight
  if (inflight.has(key)) return;
  
  const promise = fetcher()
    .then((data) => {
      cache.set(key, { data, createdAt: Date.now(), ttl });
    })
    .catch((err) => {
      console.warn(`[apiCache] Background revalidation failed for ${key}:`, err);
    })
    .finally(() => {
      inflight.delete(key);
    });
  
  inflight.set(key, promise);
}

/**
 * Invalidate a specific cache entry
 */
export function invalidateCache(key: string): void {
  cache.delete(key);
}

/**
 * Invalidate all entries matching a prefix
 */
export function invalidateCacheByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Clear entire cache
 */
export function clearAllCache(): void {
  cache.clear();
}

// Cache TTL constants (milliseconds)
export const CACHE_TTL = {
  SEARCH_RESULTS: 60 * 1000,        // 60s for search/category lists
  PRODUCT_DETAIL: 2 * 60 * 1000,    // 120s for product details
  CATEGORIES: 30 * 60 * 1000,       // 30min for categories
  PRICE_CONFIG: 5 * 60 * 1000,      // 5min for price config
  BLOCKED_VENDORS: 10 * 60 * 1000,  // 10min for blocked vendors
} as const;
