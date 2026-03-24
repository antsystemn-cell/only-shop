// ─── Ultra-Fast Marketplace Gateway Cache ─────────────────────
// L1: In-memory TTL cache with SWR
// L2: Request deduplication (single-flight)
// L3: Concurrency control + performance monitoring

interface CacheEntry<T> {
  data: T;
  createdAt: number;
  ttl: number;
}

interface PerfEntry {
  key: string;
  duration: number;
  timestamp: number;
  cacheHit: boolean;
  method?: string;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

// ─── Concurrency Limiter ────────────────────────────────────
const MAX_CONCURRENT = 4;
let activeRequests = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waitQueue.push(() => {
      activeRequests++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeRequests--;
  if (waitQueue.length > 0) {
    const next = waitQueue.shift()!;
    next();
  }
}

// ─── Performance Monitoring ─────────────────────────────────
const perfLog: PerfEntry[] = [];
const MAX_PERF_LOG = 200;
let totalRequests = 0;
let cacheHits = 0;

// ─── Per-method call tracking ───────────────────────────────
const methodCallCounts = new Map<string, number>();
const methodCacheHits = new Map<string, number>();

export function getPerformanceStats() {
  const hitRate = totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 0;
  const recentSlow = perfLog.filter((e) => e.duration > 1500).slice(-20);
  const avgDuration = perfLog.length > 0
    ? Math.round(perfLog.reduce((s, e) => s + e.duration, 0) / perfLog.length)
    : 0;

  // Top methods by call count
  const topMethods = Array.from(methodCallCounts.entries())
    .map(([method, count]) => ({
      method,
      totalCalls: count,
      cacheHits: methodCacheHits.get(method) || 0,
      hitRate: count > 0 ? Math.round(((methodCacheHits.get(method) || 0) / count) * 100) : 0,
    }))
    .sort((a, b) => b.totalCalls - a.totalCalls);

  return {
    cacheSize: cache.size,
    inflightSize: inflight.size,
    activeRequests,
    queuedRequests: waitQueue.length,
    totalRequests,
    cacheHits,
    cacheHitRate: `${hitRate}%`,
    avgResponseTime: `${avgDuration}ms`,
    recentRequests: perfLog.slice(-20),
    slowRequests: recentSlow,
    topMethods: topMethods.slice(0, 15),
    savedApiCalls: cacheHits, // Each cache hit = 1 saved OTAPI paid call
  };
}

function logPerf(key: string, duration: number, cacheHit: boolean) {
  totalRequests++;
  if (cacheHit) cacheHits++;

  // Extract method from cache key (e.g., "search:..." → "search", "product:..." → "product")
  const method = key.split(":")[0] || key;
  methodCallCounts.set(method, (methodCallCounts.get(method) || 0) + 1);
  if (cacheHit) {
    methodCacheHits.set(method, (methodCacheHits.get(method) || 0) + 1);
  }

  perfLog.push({ key, duration, timestamp: Date.now(), cacheHit, method });
  if (perfLog.length > MAX_PERF_LOG) perfLog.splice(0, perfLog.length - MAX_PERF_LOG);

  if (!cacheHit && duration > 1500) {
    console.warn(`[Gateway] SLOW: ${key} took ${duration}ms`);
  }
}

// ─── Cache Logic ────────────────────────────────────────────

// SWR window: serve stale data for up to 10 minutes beyond TTL
const SWR_WINDOW = 10 * 60 * 1000;

function isStale<T>(entry: CacheEntry<T>): boolean {
  return Date.now() - entry.createdAt > entry.ttl;
}

function isExpired<T>(entry: CacheEntry<T>): boolean {
  return Date.now() - entry.createdAt > entry.ttl + SWR_WINDOW;
}

/**
 * Gateway cached fetch with:
 * - L1 in-memory TTL cache
 * - Stale-while-revalidate (10min window)
 * - Request deduplication (single-flight)
 * - Concurrency limiting (max 4 concurrent OTAPI calls)
 * - Performance monitoring with per-method tracking
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  const start = Date.now();

  // L1: Check in-memory cache
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (existing && !isExpired(existing)) {
    if (isStale(existing)) {
      // SWR: return stale data immediately, refresh in background
      revalidateInBackground(key, fetcher, ttl);
    }
    logPerf(key, Date.now() - start, true);
    return existing.data;
  }

  // L2: Request deduplication
  const existingRequest = inflight.get(key);
  if (existingRequest) {
    const result = await (existingRequest as Promise<T>);
    logPerf(key, Date.now() - start, false);
    return result;
  }

  // Execute with concurrency control
  const promise = executeFetch(key, fetcher, ttl);
  inflight.set(key, promise);

  try {
    const result = await promise;
    logPerf(key, Date.now() - start, false);
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
  // Wait for concurrency slot
  await acquireSlot();

  try {
    const data = await fetcher();
    cache.set(key, { data, createdAt: Date.now(), ttl });
    return data;
  } catch (error) {
    // On error, return stale data if available (any age)
    const stale = cache.get(key) as CacheEntry<T> | undefined;
    if (stale) {
      console.warn(`[Gateway] Fetch failed for ${key}, returning stale data`);
      return stale.data;
    }
    throw error;
  } finally {
    releaseSlot();
  }
}

function revalidateInBackground<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): void {
  if (inflight.has(key)) return;

  const promise = (async () => {
    await acquireSlot();
    try {
      const data = await fetcher();
      cache.set(key, { data, createdAt: Date.now(), ttl });
    } catch (err) {
      console.warn(`[Gateway] Background revalidation failed for ${key}:`, err);
    } finally {
      releaseSlot();
      inflight.delete(key);
    }
  })();

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
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/**
 * Clear entire cache
 */
export function clearAllCache(): void {
  cache.clear();
  totalRequests = 0;
  cacheHits = 0;
  perfLog.length = 0;
  methodCallCounts.clear();
  methodCacheHits.clear();
}

// Cache TTL constants (milliseconds) — AGGRESSIVELY OPTIMIZED
export const CACHE_TTL = {
  SEARCH_RESULTS: 10 * 60 * 1000,       // 10min for search/category lists
  PRODUCT_DETAIL: 20 * 60 * 1000,       // 20min for product details
  CATEGORIES: 2 * 60 * 60 * 1000,       // 2hr for category metadata
  CATEGORY_MENU: 4 * 60 * 60 * 1000,    // 4hr for category menu/tree
  PRICE_CONFIG: 30 * 60 * 1000,         // 30min for price config
  BLOCKED_VENDORS: 60 * 60 * 1000,      // 1hr for blocked vendors
  STATIC_CONFIG: 2 * 60 * 60 * 1000,    // 2hr for static configs
  CATEGORY_SEARCH_PROPS: 60 * 60 * 1000, // 1hr for category search properties
  ITEM_CARD: 20 * 60 * 1000,            // 20min for individual item cards
  DESCRIPTION: 60 * 60 * 1000,          // 1hr for product descriptions
} as const;
