// ─── Amazon OTAPI Provider Category Service ─────────────────
// Handles provider-native category tree loading, normalization,
// caching, breadcrumb resolution, and product listing for Amazon via OTAPI.

import { supabase } from "@/integrations/supabase/client";
import { cachedFetch, CACHE_TTL } from "@/services/apiCache";
import { searchItems, type SearchResponse, type SearchParams, type SearchProperty } from "@/services/otApi";

// ─── Normalized Types ───────────────────────────────────────

export interface NormalizedCategory {
  id: string;
  providerType: "Amazon";
  title: string;
  slug: string;
  parentId: string | null;
  depth: number;
  hasChildren: boolean;
  children?: NormalizedCategory[];
  iconUrl?: string;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
}

export interface CategoryListingState {
  items: SearchResponse["items"];
  totalCount: number;
  subCategories: NormalizedCategory[];
  breadcrumbs: BreadcrumbItem[];
  searchProperties: SearchProperty[];
}

// ─── OTAPI Proxy Caller ─────────────────────────────────────

async function getOtApiLanguage(): Promise<string> {
  try {
    const { data } = await supabase
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", "otapi_default_language")
      .maybeSingle();
    const raw = data?.setting_value;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return typeof parsed === "string" && parsed.trim() ? parsed.trim() : "khk";
  } catch {
    return "khk";
  }
}

async function callProxy<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const cleanParams: Record<string, unknown> = { language: await getOtApiLanguage() };
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) cleanParams[k] = v;
  }

  const { data, error } = await supabase.functions.invoke("ot-api", {
    body: { action, params: cleanParams },
  });
  if (error) throw new Error(`Amazon provider API error: ${error.message}`);
  if (data?.ErrorCode && data.ErrorCode !== "Ok") {
    throw new Error(`OTAPI [${data.ErrorCode}]: ${data.ErrorDescription || "Unknown"}`);
  }
  return data as T;
}

// ─── Slug Helper ────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff\u1800-\u18af]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "category";
}

// ─── Provider Info (Root Category Discovery) ────────────────

/** Get the Amazon provider's RootCategoryId from OTAPI */
export async function getAmazonRootCategoryId(): Promise<string> {
  return cachedFetch("amazon:provider-root", async () => {
    const start = Date.now();
    const data = await callProxy<any>("getProviderInfo", { providerType: "Amazon" });
    const result = data?.Result || data;
    const rootId = result?.RootCategoryId || result?.ProviderInfo?.RootCategoryId;
    console.log(`[amazonProvider] getProviderInfo duration=${Date.now() - start}ms rootCategoryId=${rootId}`);
    if (!rootId) throw new Error("Could not determine Amazon root category ID from OTAPI");
    return rootId as string;
  }, CACHE_TTL.STATIC_CONFIG);
}

// ─── Category Normalization ─────────────────────────────────

function normalizeCategory(raw: any, parentId: string | null, depth: number): NormalizedCategory {
  const id = raw.Id || raw.CategoryId || "";
  const title = raw.Name || raw.Title || raw.DisplayName || id;
  const hasChildren = raw.HasChildren !== false && raw.IsLeaf !== true;
  return {
    id,
    providerType: "Amazon",
    title,
    slug: slugify(title),
    parentId,
    depth,
    hasChildren,
    iconUrl: raw.IconUrl || raw.PictureUrl,
  };
}

function extractCategoryList(data: any): any[] {
  // OTAPI returns categories in various shapes
  const result = data?.Result || data;
  const items = result?.Items || result?.Content || result?.CategoryInfoList;
  if (Array.isArray(items)) return items;
  if (items?.Content) return Array.isArray(items.Content) ? items.Content : [items.Content];
  if (Array.isArray(result)) return result;
  return [];
}

// ─── Subcategory Fetching ───────────────────────────────────

/** Fetch direct children of a provider category */
export async function getProviderSubcategories(
  categoryId: string,
  depth: number = 0
): Promise<NormalizedCategory[]> {
  const cacheKey = `amazon:subcats:${categoryId}`;
  return cachedFetch(cacheKey, async () => {
    const start = Date.now();
    const data = await callProxy<any>("getProviderCategorySubcategories", { categoryId });
    const rawList = extractCategoryList(data);
    const normalized = rawList
      .filter((c: any) => !c.IsHidden)
      .map((c: any) => normalizeCategory(c, categoryId, depth));
    console.log(`[amazonProvider] subcategories categoryId=${categoryId} count=${normalized.length} duration=${Date.now() - start}ms`);
    return normalized;
  }, CACHE_TTL.CATEGORIES);
}

/** Get category metadata */
export async function getProviderCategory(categoryId: string): Promise<NormalizedCategory | null> {
  const cacheKey = `amazon:cat-meta:${categoryId}`;
  return cachedFetch(cacheKey, async () => {
    const start = Date.now();
    const data = await callProxy<any>("getProviderCategory", { categoryId });
    const result = data?.Result || data;
    if (!result) return null;
    const cat = normalizeCategory(result, result.ParentId || null, 0);
    console.log(`[amazonProvider] getCategory categoryId=${categoryId} title="${cat.title}" duration=${Date.now() - start}ms`);
    return cat;
  }, CACHE_TTL.CATEGORIES);
}

// ─── Breadcrumb / Root Path ─────────────────────────────────

/** Get breadcrumb path from root to given category */
export async function getCategoryRootPath(categoryId: string): Promise<BreadcrumbItem[]> {
  const cacheKey = `amazon:rootpath:${categoryId}`;
  return cachedFetch(cacheKey, async () => {
    const start = Date.now();
    const data = await callProxy<any>("getProviderCategoryRootPath", { categoryId });
    const result = data?.Result || data;
    const items = Array.isArray(result) ? result : result?.Items || result?.Content || [];
    const breadcrumbs: BreadcrumbItem[] = (Array.isArray(items) ? items : [items])
      .filter(Boolean)
      .map((b: any) => ({ id: b.Id || b.CategoryId, name: b.Name || b.Title || "" }));
    console.log(`[amazonProvider] rootPath categoryId=${categoryId} depth=${breadcrumbs.length} duration=${Date.now() - start}ms`);
    return breadcrumbs;
  }, CACHE_TTL.CATEGORIES);
}

// ─── Product Listing Under Category ─────────────────────────

/** Search products within an Amazon provider category */
export async function searchAmazonCategoryProducts(
  categoryId: string,
  params: {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    properties?: Record<string, string>;
    query?: string;
  } = {}
): Promise<CategoryListingState> {
  const searchParams: SearchParams = {
    categoryId,
    provider: "Amazon",
    page: params.page || 0,
    pageSize: params.pageSize || 40,
    orderBy: params.orderBy || "Volume:Desc",
    query: params.query,
    properties: params.properties,
  };

  const result = await searchItems(searchParams);

  // Normalize subcategories from search response
  const subCategories: NormalizedCategory[] = result.subCategories.map((sc) => ({
    id: sc.id,
    providerType: "Amazon" as const,
    title: sc.name,
    slug: slugify(sc.name),
    parentId: categoryId,
    depth: 0,
    hasChildren: !sc.isLeaf,
    iconUrl: sc.iconUrl,
  }));

  return {
    items: result.items,
    totalCount: result.totalCount,
    subCategories,
    breadcrumbs: result.breadcrumbs,
    searchProperties: result.searchProperties,
  };
}

// ─── Full Catalog Preload (Background) ──────────────────────

/** Optional: preload brief catalog for background cache warming */
export async function preloadBriefCatalog(): Promise<NormalizedCategory[]> {
  const cacheKey = "amazon:brief-catalog";
  return cachedFetch(cacheKey, async () => {
    const start = Date.now();
    const data = await callProxy<any>("getProviderBriefCatalog", { providerType: "Amazon" });
    const rawList = extractCategoryList(data);
    
    function flattenTree(items: any[], parentId: string | null, depth: number): NormalizedCategory[] {
      const result: NormalizedCategory[] = [];
      for (const item of items) {
        const cat = normalizeCategory(item, parentId, depth);
        const children = item.SubCategories || item.Children || item.ChildCategories;
        if (children && Array.isArray(children) && children.length > 0) {
          cat.hasChildren = true;
          const childCats = flattenTree(children, cat.id, depth + 1);
          cat.children = childCats.filter((c) => c.parentId === cat.id);
          result.push(cat, ...childCats);
        } else {
          result.push(cat);
        }
      }
      return result;
    }
    
    const normalized = flattenTree(rawList, null, 0);
    console.log(`[amazonProvider] briefCatalog total=${normalized.length} duration=${Date.now() - start}ms`);
    return normalized;
  }, CACHE_TTL.CATEGORY_MENU);
}
