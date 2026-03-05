import { supabase } from "@/integrations/supabase/client";
import type {
  OtCategoryCard,
  OtSearchResult,
  OtItemFullInfo,
  OtProductCard,
  OtSearchItem,
  OtCategory,
} from "@/types/otApi";
import {
  getPriceConfig,
  calculateMntPrice,
  getOriginalCurrencyCode,
  getOriginalPriceValue,
  type PriceConfig,
} from "@/utils/priceCalculator";
import { cachedFetch, CACHE_TTL, invalidateCacheByPrefix } from "@/services/apiCache";

const DEFAULT_OTAPI_LANGUAGE = "khk";
const LANGUAGE_SETTING_CACHE_TTL = 5 * 60 * 1000;
let otApiLanguageCache: { value: string; expiresAt: number } | null = null;

async function getOtApiLanguage(): Promise<string> {
  if (otApiLanguageCache && otApiLanguageCache.expiresAt > Date.now()) {
    return otApiLanguageCache.value;
  }

  try {
    const { data } = await supabase
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", "otapi_default_language")
      .maybeSingle();

    const raw = data?.setting_value;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const value = typeof parsed === "string" && parsed.trim() ? parsed.trim() : DEFAULT_OTAPI_LANGUAGE;

    otApiLanguageCache = {
      value,
      expiresAt: Date.now() + LANGUAGE_SETTING_CACHE_TTL,
    };

    return value;
  } catch {
    return DEFAULT_OTAPI_LANGUAGE;
  }
}

export function resetOtApiLanguageCache() {
  otApiLanguageCache = null;
}
async function callProxy<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  // Validate required parameters for critical actions
  const requiredParams: Record<string, string[]> = {
    addItemToBasket: ["sessionId", "itemId", "quantity"],
    editBasketItemQuantity: ["sessionId", "orderLineId", "quantity"],
    removeBasketItem: ["sessionId", "orderLineId"],
    clearBasket: ["sessionId"],
    getBasket: ["sessionId"],
    runBasketChecking: ["sessionId"],
    getBasketCheckingResult: ["sessionId"],
  };

  const required = requiredParams[action];
  if (required) {
    for (const param of required) {
      const value = params[param];
      if (value === undefined || value === null || value === "") {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }
  }

  // Filter out undefined/null params before sending
  // Note: empty strings are kept for params like configurationId, fieldParameters that OTAPI requires
  const cleanParams: Record<string, unknown> = { language: await getOtApiLanguage() };
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      cleanParams[k] = v;
    }
  }

  const invoke = async (p: Record<string, unknown>) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s hard timeout
    
    try {
      const { data, error } = await supabase.functions.invoke("ot-api", {
        body: { action, params: p },
      });
      clearTimeout(timeoutId);
      if (error) throw new Error(`OT API proxy error: ${error.message}`);
      if (data?.success === false) throw new Error(data.error || "Unknown OT API error");
      if (data?.error && typeof data.error === "string") throw new Error(`OT API error: ${data.error}`);
      if (data?.ErrorCode === "SessionExpired") {
        throw new Error("SessionExpired");
      }
      return data as T;
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e?.name === "AbortError") {
        throw new Error("OT API timeout: request took longer than 6 seconds");
      }
      throw e;
    }
  };

  try {
    return await invoke(cleanParams);
  } catch (err: any) {
    // Auto-retry on SessionExpired: clear cached session, get fresh one, retry once
    // IMPORTANT: only retry if the action doesn't depend on basket state (basket is tied to session)
    const basketActions = ["createOrder", "getBasket", "runBasketChecking", "getBasketCheckingResult",
      "addItemToBasket", "editBasketItemQuantity", "removeBasketItem", "clearBasket"];
    if (err?.message?.includes("SessionExpired") && cleanParams.sessionId) {
      const { clearSessionCache, getAnonymousSession } = await import("@/services/otSession");
      clearSessionCache();
      if (basketActions.includes(action)) {
        // For basket-dependent actions, get fresh session but re-throw with clear message
        // so the caller knows the basket is lost
        throw new Error("SESSION_BASKET_LOST");
      }
      console.log("[otApi] SessionExpired detected, retrying with fresh session...");
      const freshSessionId = await getAnonymousSession();
      return await invoke({ ...cleanParams, sessionId: freshSessionId });
    }
    throw err;
  }
}

// ─── Categories ──────────────────────────────────────────────

export async function fetchRootCategories(): Promise<OtCategoryCard[]> {
  return cachedFetch("categories:root", async () => {
    const data = await callProxy<any>("getRootCategories");
    const raw = data?.CategoryInfoList;
    const list: OtCategory[] = Array.isArray(raw) ? raw : (raw?.Content || []);
    return list.filter((c) => !c.IsHidden).map(mapCategory);
  }, CACHE_TTL.CATEGORIES);
}

export async function fetchSubcategories(parentId: string): Promise<OtCategoryCard[]> {
  return cachedFetch(`categories:sub:${parentId}`, async () => {
    const data = await callProxy<any>("getSubcategories", { parentId });
    const raw = data?.CategoryInfoList;
    const list: OtCategory[] = Array.isArray(raw) ? raw : (raw?.Content || []);
    return list.filter((c) => !c.IsHidden).map(mapCategory);
  }, CACHE_TTL.CATEGORIES);
}
export async function fetchCategorySearchProperties(categoryId: string) {
  return callProxy("getCategorySearchProperties", { categoryId });
}

// ─── Search ──────────────────────────────────────────────────

export interface SearchParams {
  query?: string;
  categoryId?: string;
  brandId?: string;
  vendorId?: string;
  minPrice?: string;
  maxPrice?: string;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  imageUrl?: string;
  provider?: string;
  properties?: Record<string, string>;
}

export interface SearchPropertyValue {
  id: string;
  value: string;
  itemCount?: number;
}

export interface SearchProperty {
  propertyName: string;
  values: SearchPropertyValue[];
}

export interface SearchResponse {
  items: OtProductCard[];
  totalCount: number;
  subCategories: OtCategoryCard[];
  breadcrumbs: Array<{ id: string; name: string }>;
  searchProperties: SearchProperty[];
}

// ─── Blocked Vendors Cache ────────────────────────────────────
let _blockedVendorsCache: { vendors: string[]; fetchedAt: number } | null = null;
const BLOCKED_VENDORS_TTL = 1000 * 60 * 10; // 10 min

async function getBlockedVendors(): Promise<string[]> {
  if (_blockedVendorsCache && Date.now() - _blockedVendorsCache.fetchedAt < BLOCKED_VENDORS_TTL) {
    return _blockedVendorsCache.vendors;
  }
  try {
    const { data } = await supabase
      .from("admin_settings")
      .select("setting_value")
      .eq("category", "storefront")
      .eq("setting_key", "blocked_vendors")
      .maybeSingle();
    const raw = data?.setting_value;
    const list: string[] = Array.isArray(raw) ? raw.map((v: any) => String(v).toLowerCase().trim()).filter(Boolean) : [];
    _blockedVendorsCache = { vendors: list, fetchedAt: Date.now() };
    return list;
  } catch {
    return _blockedVendorsCache?.vendors || [];
  }
}

export async function searchItems(params: SearchParams): Promise<SearchResponse> {
  const cacheKey = `search:${JSON.stringify(params)}`;
  return cachedFetch(cacheKey, async () => {
    const [data, priceConfig, blockedVendors] = await Promise.all([
      callProxy<OtSearchResult>("searchItems", { ...params } as Record<string, unknown>),
      getPriceConfig(),
      getBlockedVendors(),
    ]);
    const result = data?.Result;

    // Handle both array and { Content: [] } response formats
    const rawItems = result?.Items?.Items;
    const itemsArray: OtSearchItem[] = Array.isArray(rawItems) ? rawItems : (rawItems as any)?.Content || [];
    // Pre-filter: remove auction items, sold-out items, and blocked vendors
    const filteredRaw = itemsArray.filter((item: any) => {
      if (item.IsAuction) return false;
      if (item.IsSoldOut) return false;
      if (item.IsTranslationItem) return false;
      const qty = item.Quantity ?? item.MasterQuantity;
      if (qty !== undefined && qty !== null && qty <= 0) return false;
      // Check blocked vendors list from admin settings
      const vName = (item.VendorName || item.VendorDisplayName || "").toLowerCase();
      if (blockedVendors.some((bv) => vName.includes(bv))) return false;
      return true;
    });
    const items = filteredRaw.map((item: OtSearchItem) => mapSearchItem(item, priceConfig)).filter(isAvailableProduct);
    const totalCount = result?.Items?.TotalCount || (rawItems as any)?.TotalCount || 0;

    const rawSubCats = result?.SubCategories?.Items;
    const subCatsArray = Array.isArray(rawSubCats) ? rawSubCats : (rawSubCats as any)?.Content || [];
    const subCategories = subCatsArray.map(mapCategory);

    const breadcrumbs = (result?.BreadCrumbs || []).map((b) => ({ id: b.Id, name: b.Name }));

    const rawProps = result?.SearchProperties?.Items;
    const propsArray = Array.isArray(rawProps) ? rawProps : (rawProps as any)?.Content || [];
    const searchProperties: SearchProperty[] = propsArray.map((sp: any) => ({
      propertyName: sp.PropertyName,
      values: (sp.PropertyValues || []).map((v: any) => ({ id: v.Id, value: v.Value, itemCount: v.ItemCount })),
    }));

    return { items, totalCount, subCategories, breadcrumbs, searchProperties };
  }, CACHE_TTL.SEARCH_RESULTS);
}

// ─── Product Detail ──────────────────────────────────────────

export interface ProductDetail {
  id: string;
  title: string;
  externalTitle?: string;
  imageUrl: string;
  images: string[];
  price: number;
  originalPrice?: number;
  currency: string;
  quantity?: number;
  vendorName?: string;
  vendorScore?: number;
  brandName?: string;
  categoryId?: string;
  features: Array<{ name: string; value: string }>;
  configurators: Array<{
    pid: string;
    propertyName: string;
    values: Array<{
      id: string;
      value: string;
      imageUrl?: string;
    }>;
  }>;
  configuredItems: Array<{
    id: string;
    quantity?: number;
    price?: number;
    imageUrl?: string;
    configuratorIds: string[];
  }>;
  breadcrumbs: Array<{ id: string; name: string }>;
  vendor?: {
    id: string;
    name?: string;
    score?: number;
  };
  externalUrl?: string;
  providerType?: string;
}

export async function fetchProductDetail(itemId: string): Promise<ProductDetail> {
  const cacheKey = `product:${itemId}`;
  return cachedFetch(cacheKey, async () => fetchProductDetailUncached(itemId), CACHE_TTL.PRODUCT_DETAIL);
}

// Prefetch product detail (for hover prefetching)
export function prefetchProductDetail(itemId: string): void {
  const cacheKey = `product:${itemId}`;
  cachedFetch(cacheKey, () => fetchProductDetailUncached(itemId), CACHE_TTL.PRODUCT_DETAIL).catch(() => {});
}

async function fetchProductDetailUncached(itemId: string): Promise<ProductDetail> {
  // Handle warehouse items (wh-) from local DB
  if (itemId.startsWith("wh-")) {
    const { data: wh, error } = await supabase
      .from("warehouse_items")
      .select("*")
      .eq("item_id", itemId)
      .maybeSingle();
    if (error || !wh) throw new Error("Product not found");
    return {
      id: wh.item_id,
      title: wh.title || "",
      imageUrl: wh.image_url || "",
      images: wh.image_url ? [wh.image_url] : [],
      price: Number(wh.price_mnt) || 0,
      originalPrice: wh.original_price_mnt ? Number(wh.original_price_mnt) : undefined,
      currency: "₮",
      quantity: wh.stock ?? 0,
      vendorName: "Агуулах",
      features: [],
      configurators: [],
      configuredItems: [],
      breadcrumbs: [],
      providerType: "warehouse",
    };
  }

  const [data, priceConfig] = await Promise.all([
    callProxy<any>("getItemFullInfo", { itemId }),
    getPriceConfig(),
  ]);
  const item = data?.Result?.Item;

  if (!item) throw new Error("Product not found");

  // Handle Pictures as array or {ItemPicture: [...]}
  const rawPics = item.Pictures;
  const picsArray = Array.isArray(rawPics) ? rawPics : (rawPics?.ItemPicture || []);
  const images = (Array.isArray(picsArray) ? picsArray : [picsArray]).filter(Boolean).map((p: any) => p.Url).filter(Boolean);
  if (item.MainPictureUrl && !images.includes(item.MainPictureUrl)) {
    images.unshift(item.MainPictureUrl);
  }

  // Build configurators: prefer item.Configurators, fallback to Attributes with IsConfigurator
  let configurators: ProductDetail["configurators"] = [];
  if (item.Configurators && (Array.isArray(item.Configurators) ? item.Configurators.length : true)) {
    const rawConfigs = Array.isArray(item.Configurators) ? item.Configurators : [item.Configurators];
    configurators = rawConfigs.map((c: any) => ({
      pid: c.Pid,
      propertyName: c.PropertyName || "",
      values: (Array.isArray(c.Values) ? c.Values : c.Values ? [c.Values] : []).map((v: any) => ({
        id: v.Id,
        value: v.PropertyValueDisplayName || v.Value || "",
        imageUrl: v.ImageUrl,
      })),
    }));
  } else if (item.Attributes) {
    // Build from Attributes where IsConfigurator is true
    const attrs = Array.isArray(item.Attributes) ? item.Attributes : [item.Attributes];
    const configAttrs = attrs.filter((a: any) => a.IsConfigurator);
    const grouped: Record<string, { pid: string; propertyName: string; values: any[] }> = {};
    for (const attr of configAttrs) {
      if (!grouped[attr.Pid]) {
        grouped[attr.Pid] = {
          pid: attr.Pid,
          propertyName: attr.PropertyName || attr.OriginalPropertyName || "",
          values: [],
        };
      }
      grouped[attr.Pid].values.push({
        id: attr.Vid,
        value: attr.Value || attr.OriginalValue || "",
        imageUrl: attr.ImageUrl || attr.MiniImageUrl,
      });
    }
    configurators = Object.values(grouped);
  }

  // Parse ConfiguredItems
  const rawConfiguredItems = item.ConfiguredItems;
  const configuredItemsArray = Array.isArray(rawConfiguredItems) ? rawConfiguredItems : rawConfiguredItems ? [rawConfiguredItems] : [];

  // Parse FeaturedValues
  const rawFeatures = item.FeaturedValues;
  const featuresArray = Array.isArray(rawFeatures) ? rawFeatures : rawFeatures ? [rawFeatures] : [];

  // Parse RootPath
  const rawPath = data?.Result?.RootPath;
  const rootPath = Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : [];

  return {
    id: item.Id,
    title: item.Title || item.ExternalTitle || "",
    externalTitle: item.ExternalTitle,
    imageUrl: item.MainPictureUrl || images[0] || "",
    images,
    price: calculateMntPrice(
      getOriginalPriceValue(item.Price),
      getOriginalCurrencyCode(item.Price),
      item.ProviderType,
      priceConfig
    ),
    originalPrice: item.OriginalPrice
      ? calculateMntPrice(
          getOriginalPriceValue(item.OriginalPrice),
          getOriginalCurrencyCode(item.OriginalPrice),
          item.ProviderType,
          priceConfig
        )
      : undefined,
    currency: "₮",
    quantity: item.Quantity ?? item.MasterQuantity,
    vendorName: item.VendorName || item.VendorDisplayName,
    vendorScore: item.VendorScore,
    brandName: item.BrandName,
    categoryId: item.CategoryId,
    features: featuresArray.map((f: any) => ({
      name: f.Name,
      value: f.Value,
    })),
    configurators,
    configuredItems: configuredItemsArray.map((ci: any) => ({
      id: ci.Id,
      quantity: ci.Quantity,
      price: ci.Price ? calculateMntPrice(
        getOriginalPriceValue(ci.Price),
        getOriginalCurrencyCode(ci.Price),
        item.ProviderType,
        priceConfig
      ) : undefined,
      imageUrl: ci.ImageUrl,
      configuratorIds: (Array.isArray(ci.Configurators) ? ci.Configurators : ci.Configurators ? [ci.Configurators] : []).map((c: any) => c.Vid),
    })),
    breadcrumbs: rootPath.map((b: any) => ({ id: b.Id, name: b.Name })),
    vendor: data?.Result?.Vendor
      ? {
          id: data.Result.Vendor.Id,
          name: data.Result.Vendor.Name || data.Result.Vendor.DisplayName,
          score: data.Result.Vendor.Score,
        }
      : item.VendorId
      ? {
          id: item.VendorId,
          name: item.VendorName || item.VendorDisplayName,
          score: item.VendorScore,
        }
      : undefined,
    externalUrl: item.TaobaoItemUrl || item.ExternalItemUrl,
    providerType: item.ProviderType,
  };
}

export async function fetchProductDescription(itemId: string): Promise<string> {
  return cachedFetch(`desc:${itemId}`, async () => {
    // Warehouse items: return description from DB
    if (itemId.startsWith("wh-")) {
      const { data: wh } = await supabase
        .from("warehouse_items")
        .select("description")
        .eq("item_id", itemId)
        .maybeSingle();
      return wh?.description || "";
    }
    try {
      const data = await callProxy<any>("getItemDescription", { itemId });
      return data?.OtapiItemDescription?.ItemDescription || data?.Result?.ItemDescription || "";
    } catch {
      return "";
    }
  }, CACHE_TTL.PRODUCT_DETAIL);
}

// ─── Cart / Basket ───────────────────────────────────────────

export async function getBasket(sessionId: string) {
  return callProxy("getBasket", { sessionId });
}

// Lightweight item info fetch (title + image only) for basket enrichment
// Batch fetch items by IDs → OtProductCard[] (for curated collections / item_ids categories)
export async function fetchItemsByIds(
  itemIds: string[],
  batchSize = 6,
  options?: { includeUnavailable?: boolean }
): Promise<OtProductCard[]> {
  if (!itemIds.length) return [];
  const priceConfig = await getPriceConfig();
  const includeUnavailable = options?.includeUnavailable === true;
  const byRequestedId = new Map<string, OtProductCard>();

  // Separate warehouse items (wh-) from OT API items
  const whIds = itemIds.filter((id) => String(id).trim().startsWith("wh-"));
  const otIds = itemIds.filter((id) => !String(id).trim().startsWith("wh-"));

  // Fetch warehouse items from local DB
  if (whIds.length > 0) {
    try {
      const { data: whItems } = await supabase
        .from("warehouse_items")
        .select("*")
        .in("item_id", whIds.map((id) => String(id).trim()));
      for (const wh of whItems || []) {
        const card: OtProductCard = {
          id: wh.item_id,
          title: wh.title || "",
          imageUrl: wh.image_url || "",
          price: Number(wh.price_mnt) || 0,
          originalPrice: wh.original_price_mnt ? Number(wh.original_price_mnt) : undefined,
          currency: "₮",
          vendorName: "Агуулах",
          quantity: wh.stock ?? 0,
          providerType: "warehouse",
        };
        if (includeUnavailable || (card.price > 0 && (card.quantity ?? 0) > 0)) {
          byRequestedId.set(wh.item_id, card);
        }
      }
    } catch (e) {
      console.error("Failed to fetch warehouse items:", e);
    }
  }

  // Fetch OT API items
  for (let i = 0; i < otIds.length; i += batchSize) {
    const batch = otIds.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (id) => {
        const requestedId = String(id).trim();
        const data = await callProxy<any>("getItemFullInfo", { itemId: requestedId });
        const item = data?.Result?.Item;
        if (!item) return null;

        const effectivePrice = item.PromotionPrice || item.Price;
        const currencyCode = getOriginalCurrencyCode(effectivePrice);
        const rawValue = getOriginalPriceValue(effectivePrice);
        const price = calculateMntPrice(rawValue, currencyCode, item.ProviderType, priceConfig);

        let originalPrice: number | undefined;
        if (item.PromotionPrice && item.Price) {
          const regValue = getOriginalPriceValue(item.Price);
          if (regValue > rawValue) {
            originalPrice = calculateMntPrice(regValue, getOriginalCurrencyCode(item.Price), item.ProviderType, priceConfig);
          }
        }

        return {
          id: requestedId,
          title: item.Title || item.ExternalTitle || "",
          imageUrl: item.MainPictureUrl || "",
          price,
          originalPrice,
          currency: "₮",
          vendorName: item.VendorName,
          quantity: item.Quantity ?? item.MasterQuantity,
          providerType: item.ProviderType,
        } as OtProductCard;
      })
    );

    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) {
        if (includeUnavailable || isAvailableProduct(r.value)) {
          byRequestedId.set(String(r.value.id), r.value);
        }
      }
    }
  }

  // Preserve exact order from category item_ids and avoid cross-category mixups
  return itemIds
    .map((id) => byRequestedId.get(String(id).trim()))
    .filter((v): v is OtProductCard => Boolean(v));
}

export async function getItemBasicInfo(itemId: string): Promise<{ title: string; imageUrl: string }> {
  try {
    const data = await callProxy<any>("getItemFullInfo", { itemId });
    const item = data?.Result?.Item;
    const title = item?.Title || item?.OriginalTitle || "";
    const imageUrl = item?.MainPictureUrl 
      || item?.Pictures?.ItemPicture?.Url
      || (Array.isArray(item?.Pictures) ? item.Pictures[0]?.Url : "")
      || "";
    return { title, imageUrl };
  } catch {
    return { title: "", imageUrl: "" };
  }
}

export async function addItemToBasket(
  sessionId: string, 
  itemId: string, 
  quantity: number, 
  configurators?: string, 
  configurationId?: string,
  fieldParameters?: string
) {
  const params: Record<string, unknown> = {
    sessionId,
    itemId,
    quantity,
    fieldParameters: fieldParameters || "<Fields/>",
    priceType: "Default",
  };
  // Only send configurationId if it has a value (per OTAPI docs)
  if (configurationId) {
    params.configurationId = configurationId;
  }
  return callProxy("addItemToBasket", params);
}

export async function editBasketItemQuantity(sessionId: string, orderLineId: string, quantity: number) {
  return callProxy("editBasketItemQuantity", { sessionId, orderLineId, quantity });
}

export async function removeBasketItem(sessionId: string, orderLineId: string) {
  return callProxy("removeBasketItem", { sessionId, orderLineId });
}

export async function clearBasket(sessionId: string) {
  return callProxy("clearBasket", { sessionId });
}

// Helper to extract string activityId from potentially nested OTAPI response
function extractActivityId(resp: any): string | null {
  // Edge function normalizes to _activityId, but handle all cases
  const raw = resp?._activityId || resp?.Result?.ActivityId || resp?.ActivityId || resp?.Result;
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "object") {
    if (raw.Id?.Value) return String(raw.Id.Value);
    if (raw.Value) return String(raw.Value);
    if (raw.ActivityId) return extractActivityId({ _activityId: raw.ActivityId });
  }
  return null;
}

export async function runBasketChecking(sessionId: string, elements?: string): Promise<{ activityId: string; raw: any }> {
  const params: Record<string, unknown> = { sessionId };
  if (elements && elements.trim()) {
    params.elements = elements.trim();
  }
  const resp = await callProxy("runBasketChecking", params);
  const activityId = extractActivityId(resp);
  console.log("[otApi] runBasketChecking activityId:", activityId, "typeof:", typeof activityId);
  if (!activityId) {
    console.error("[otApi] runBasketChecking: could not extract activityId from response:", JSON.stringify(resp).substring(0, 500));
    throw new Error("BASKET_CHECK_NO_ACTIVITY_ID");
  }
  return { activityId, raw: resp };
}

export async function getBasketCheckingResult(sessionId: string, activityId: string) {
  if (!activityId || typeof activityId !== "string") {
    throw new Error(`activityId must be a non-empty string, got: ${typeof activityId}`);
  }
  return callProxy("getBasketCheckingResult", { sessionId, activityId });
}

// ─── Orders (OTAPI) ─────────────────────────────────────────

export async function searchOtOrders(params: { sessionId?: string; statusId?: string; page?: number; pageSize?: number }) {
  return callProxy("searchOrders", params);
}

export async function searchAllOtOrders(params: { statusId?: string; userId?: string; orderId?: string; page?: number; pageSize?: number }) {
  return callProxy("searchAllOrders", params);
}

export async function getOrderLineStatusHistory(orderLineId: string) {
  return callProxy("getOrderLineStatusHistory", { orderLineId });
}

// ─── Create Order ───────────────────────────────────────────

export async function createOtOrder(sessionId: string, params: { 
  deliveryModeId?: string; 
  profileId?: string; 
  comment?: string;
  elementIds?: string[];
}) {
  return callProxy("createOrder", { sessionId, ...params });
}

export async function recreateOrder(sessionId: string, orderId: string) {
  return callProxy("recreateOrder", { sessionId, orderId });
}

// ─── User Profiles (Delivery Addresses) ─────────────────────

export interface OtUserProfile {
  Id: string;
  FullName?: string;
  Address?: string;
  Phone?: string;
  CityId?: string;
  CityName?: string;
  ZipCode?: string;
  District?: string;
}

export async function getUserProfileInfoList(sessionId: string) {
  return callProxy<{ Result?: { Items?: OtUserProfile[] } }>("getUserProfileInfoList", { sessionId });
}

export async function createUserProfile(sessionId: string, xml: string) {
  return callProxy("createUserProfile", { sessionId, xmlParameters: xml });
}

export async function updateUserProfile(sessionId: string, xml: string) {
  return callProxy("updateUserProfile", { sessionId, xmlParameters: xml });
}

export async function deleteUserProfile(sessionId: string, profileId: string) {
  return callProxy("deleteUserProfile", { sessionId, profileId });
}

export async function searchCities(cityName: string, countryCode?: string) {
  return callProxy<{ Result?: { Items?: Array<{ Id: string; Name: string; CountryName?: string }> } }>("searchCities", { cityName, countryCode });
}

// ─── Delivery Modes ─────────────────────────────────────────

export interface OtDeliveryMode {
  Id: string;
  Name?: string;
  Description?: string;
  Price?: number;
  Currency?: string;
  EstimatedDays?: number;
  IsDefault?: boolean;
}

export async function searchDeliveryModesForSession(sessionId: string, countryCode?: string) {
  return callProxy<{ Result?: { Items?: OtDeliveryMode[] } }>("searchDeliveryModes", { sessionId, deliveryCountryCode: countryCode });
}

export async function getSalesOrderDetails(orderId: string) {
  return callProxy("getSalesOrderDetails", { orderId });
}

export async function cancelSalesOrder(orderId: string, reason?: string) {
  return callProxy("cancelSalesOrder", { orderId, reason });
}

export async function cancelLineSalesOrder(orderLineId: string, reason?: string) {
  return callProxy("cancelLineSalesOrder", { orderLineId, reason });
}

// ─── Users (OTAPI) ──────────────────────────────────────────

export async function getUserInfoForOperator(userId: string) {
  return callProxy("getUserInfoForOperator", { userId });
}

export async function getAccountInfo(userId: string) {
  return callProxy("getAccountInfo", { userId });
}

export async function getStatementForOperator(userId: string, page = 0, pageSize = 20) {
  return callProxy("getStatementForOperator", { userId, page, pageSize });
}

// ─── Delivery ───────────────────────────────────────────────

export async function getDeliveryCountryInfoList() {
  return callProxy("getDeliveryCountryInfoList");
}

export async function searchDeliveryModes(sessionId: string, deliveryCountryCode?: string) {
  return callProxy("searchDeliveryModes", { sessionId, deliveryCountryCode });
}

export async function getExternalDeliveryRateList(weight?: string, countryCode?: string) {
  return callProxy("getExternalDeliveryRateList", { weight, countryCode });
}

// ─── Currency & Pricing ─────────────────────────────────────

export async function getCurrencyList() {
  return callProxy("getCurrencyList");
}

export async function getCurrencyRateHistory(currencyCode: string, page = 0) {
  return callProxy("getCurrencyRateHistory", { currencyCode, page });
}

export async function getDiscountGroupList() {
  return callProxy("getDiscountGroupList");
}

export async function getItemTotalCost(itemId: string, quantity = 1, weight?: string) {
  return callProxy("getItemTotalCost", { itemId, quantity, weight });
}

// ─── Reviews ────────────────────────────────────────────────

export async function addItemReview(sessionId: string, itemId: string, text: string, rate: number) {
  return callProxy("addItemReview", { sessionId, itemId, text, rate });
}

export async function approveItemReviews(reviewIds: string) {
  return callProxy("approveItemReviews", { reviewIds });
}

export async function getItemReviewSettings() {
  return callProxy("getItemReviewSettings");
}

// ─── Instance / Settings ────────────────────────────────────

export async function getInstanceOptions() {
  return callProxy("getInstanceOptionsInfo");
}

export async function getCommonInstanceOptions() {
  return callProxy("getCommonInstanceOptionsInfo");
}

export async function getProviderSettings() {
  return callProxy("getProviderSettings");
}

// ─── System Tools ───────────────────────────────────────────

export async function getCallStatistics() {
  return callProxy("getCallStatistics");
}

export async function resetInstanceCaches() {
  return callProxy("resetInstanceCaches");
}

export async function getBlackListContents(page = 0) {
  return callProxy("getBlackListContents", { page });
}

export async function getErrorDescription(errorCode: string) {
  return callProxy("getErrorDescription", { errorCode });
}

// ─── Roles ──────────────────────────────────────────────────

export async function getAvailableRoleList() {
  return callProxy("getAvailableRoleList");
}

export async function getOperatorRightTree() {
  return callProxy("getOperatorRightTree");
}

// ─── Content ────────────────────────────────────────────────

export async function getOtBanners() {
  return callProxy("getBanners");
}

export async function getContentMenuItemTree() {
  return callProxy("getContentMenuItemTree");
}

// ─── Auth Extended ──────────────────────────────────────────

export async function changeEmail(sessionId: string, newEmail: string) {
  return callProxy("changeEmail", { sessionId, newEmail });
}

export async function changePhone(sessionId: string, newPhone: string) {
  return callProxy("changePhone", { sessionId, newPhone });
}

export async function confirmEmail(sessionId: string, confirmationCode: string) {
  return callProxy("confirmEmail", { sessionId, confirmationCode });
}

export async function confirmPhone(sessionId: string, confirmationCode: string) {
  return callProxy("confirmPhone", { sessionId, confirmationCode });
}

export async function externalAuthentication(providerName: string, externalUserId: string, userLogin?: string, userEmail?: string) {
  return callProxy("externalAuthentication", { providerName, externalUserId, ...(userLogin ? { userLogin } : {}), ...(userEmail ? { userEmail } : {}) });
}

// ─── User Extended ──────────────────────────────────────────

export async function getUserPreferences(sessionId: string) {
  return callProxy("getUserPreferences", { sessionId });
}

export async function searchUsers(searchText?: string, page = 0, pageSize = 20) {
  return callProxy("searchUsers", { searchText, page, pageSize });
}

// ─── Basket Extended ────────────────────────────────────────

export async function batchSimplifiedAddItemsToBasket(sessionId: string, xmlParameters: string) {
  return callProxy("batchSimplifiedAddItemsToBasket", { sessionId, xmlParameters });
}

export async function moveItemsBetweenBasketAndNote(sessionId: string, orderLineId: string, direction: "ToNote" | "ToBasket" = "ToNote") {
  return callProxy("moveItemsBetweenBasketAndNote", { sessionId, orderLineId, direction });
}

// ─── Orders Extended ────────────────────────────────────────

export async function updateOrderLineInfo(orderLineId: string, xmlParameters: string) {
  return callProxy("updateOrderLineInfo", { orderLineId, xmlParameters });
}

export async function getOrderStatusList() {
  return callProxy("getOrderStatusList");
}

export async function confirmOrderPackaging(orderId: string) {
  return callProxy("confirmOrderPackaging", { orderId });
}

// ─── Payment (OT) ──────────────────────────────────────────

export async function createBalanceChargingBill(sessionId: string, amount: number, currencyCode?: string) {
  return callProxy("createBalanceChargingBill", { sessionId, amount, ...(currencyCode ? { currencyCode } : {}) });
}

export async function salesPaymentReserve(orderId: string, amount: number, currencyCode?: string) {
  return callProxy("salesPaymentReserve", { orderId, amount, ...(currencyCode ? { currencyCode } : {}) });
}

// ─── Discounts Extended ─────────────────────────────────────

export async function getUserDiscountGroups(userId: string) {
  return callProxy("getUserDiscountGroups", { userId });
}

export async function addUserToDiscountGroup(userId: string, discountGroupId: string) {
  return callProxy("addUserToDiscountGroup", { userId, discountGroupId });
}

export async function removeUserFromDiscountGroup(userId: string, discountGroupId: string) {
  return callProxy("removeUserFromDiscountGroup", { userId, discountGroupId });
}

// ─── Content CRUD ───────────────────────────────────────────

export async function createContentMenuItem(xmlParameters: string) {
  return callProxy("createContentMenuItem", { xmlParameters });
}

export async function updateContentMenuItem(xmlParameters: string) {
  return callProxy("updateContentMenuItem", { xmlParameters });
}

export async function deleteContentMenuItem(menuItemId: string) {
  return callProxy("deleteContentMenuItem", { menuItemId });
}

export async function searchContentMenuItems(parentMenuItemId?: string, page = 0, pageSize = 50) {
  return callProxy("searchContentMenuItems", { parentMenuItemId, page, pageSize });
}

export async function updateApplicationDesignSettings(xmlParameters: string) {
  return callProxy("updateApplicationDesignSettings", { xmlParameters });
}

// ─── Reviews Extended ───────────────────────────────────────

export async function rewardItemReview(reviewId: string, amount: number) {
  return callProxy("rewardItemReview", { reviewId, amount });
}

export async function searchItemReviews(params: { itemId?: string; isApproved?: string; page?: number; pageSize?: number } = {}) {
  return callProxy("searchItemReviews", params);
}

// ─── Reporting ──────────────────────────────────────────────

export async function searchInstanceUserLogEntries(params: { userId?: string; actionType?: string; page?: number; pageSize?: number } = {}) {
  return callProxy("searchInstanceUserLogEntries", params);
}

export async function getInstanceLogEntryList(page = 0, pageSize = 50) {
  return callProxy("getInstanceLogEntryList", { page, pageSize });
}

export async function addInstanceLogEntry(message: string, logLevel = "Info") {
  return callProxy("addInstanceLogEntry", { message, logLevel });
}

export async function getMethodNamesForStatistics() {
  return callProxy("getMethodNamesForStatistics");
}

// ─── Roles Extended ─────────────────────────────────────────

export async function createInstanceRole(roleName: string, roleDescription?: string) {
  return callProxy("createInstanceRole", { roleName, ...(roleDescription ? { roleDescription } : {}) });
}

export async function attachRightsToRole(roleId: string, xmlParameters: string) {
  return callProxy("attachRightsToRole", { roleId, xmlParameters });
}

export async function deleteInstanceRole(roleId: string) {
  return callProxy("deleteInstanceRole", { roleId });
}

export async function addInstanceUserToRole(userId: string, roleId: string) {
  return callProxy("addInstanceUserToRole", { userId, roleId });
}

export async function removeUserFromRole(userId: string, roleId: string) {
  return callProxy("removeUserFromRole", { userId, roleId });
}

// ─── Providers Extended ─────────────────────────────────────

export async function getProviderInfoList() {
  return callProxy("getProviderInfoList");
}

export async function getProviderCommonSettings(providerType: string) {
  return callProxy("getProviderCommonSettings", { providerType });
}

// ─── Delivery Extended ──────────────────────────────────────

export async function searchDeliveryPickupPoints(deliveryModeId?: string) {
  return callProxy("searchDeliveryPickupPoints", { deliveryModeId });
}

// ─── Availability Filter ─────────────────────────────────────
// Filters out: out-of-stock, no-price, auction items
function isAvailableProduct(product: OtProductCard): boolean {
  // No price or zero price → hide
  if (!product.price || product.price <= 0) return false;
  // Out of stock (quantity explicitly 0)
  if (product.quantity !== undefined && product.quantity !== null && product.quantity <= 0) return false;
  return true;
}

// ─── Mappers ─────────────────────────────────────────────────

function mapCategory(cat: OtCategory): OtCategoryCard {
  return {
    id: cat.Id,
    name: cat.Name,
    iconUrl: cat.IconUrl,
    isLeaf: cat.IsLeaf,
  };
}

function mapSearchItem(item: OtSearchItem, priceConfig: PriceConfig): OtProductCard {
  // Use PromotionPrice as the current price when available (it's the actual selling price)
  const effectivePrice = item.PromotionPrice || item.Price;
  const currencyCode = getOriginalCurrencyCode(effectivePrice);
  const rawValue = getOriginalPriceValue(effectivePrice);
  const price = calculateMntPrice(rawValue, currencyCode, item.ProviderType, priceConfig);

  // Show the regular Price as "originalPrice" (strikethrough) when there's a promotion
  let originalPrice: number | undefined;
  if (item.PromotionPrice && item.Price) {
    const regValue = getOriginalPriceValue(item.Price);
    if (regValue > rawValue) {
      originalPrice = calculateMntPrice(
        regValue,
        getOriginalCurrencyCode(item.Price),
        item.ProviderType,
        priceConfig
      );
    }
  } else if (item.OriginalPrice) {
    originalPrice = calculateMntPrice(
      getOriginalPriceValue(item.OriginalPrice),
      getOriginalCurrencyCode(item.OriginalPrice),
      item.ProviderType,
      priceConfig
    );
  }

  return {
    id: item.Id || "",
    title: item.Title || item.ExternalTitle || "",
    imageUrl: item.MainPictureUrl || "",
    price,
    originalPrice,
    currency: "₮",
    vendorName: item.VendorName,
    quantity: item.Quantity,
    providerType: item.ProviderType,
  };
}
