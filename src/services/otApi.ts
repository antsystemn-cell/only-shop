import { supabase } from "@/integrations/supabase/client";
import type {
  OtCategoryCard,
  OtSearchResult,
  OtItemFullInfo,
  OtProductCard,
  OtSearchItem,
  OtCategory,
} from "@/types/otApi";

const LANGUAGE = "en";

async function callProxy<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  // Filter out undefined/null/empty params before sending
  const cleanParams: Record<string, unknown> = { language: LANGUAGE };
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      cleanParams[k] = v;
    }
  }

  const { data, error } = await supabase.functions.invoke("ot-api", {
    body: { action, params: cleanParams },
  });

  if (error) throw new Error(`OT API proxy error: ${error.message}`);
  if (data?.success === false) throw new Error(data.error || "Unknown OT API error");
  if (data?.error && typeof data.error === "string") throw new Error(`OT API error: ${data.error}`);
  return data as T;
}

// ─── Categories ──────────────────────────────────────────────

export async function fetchRootCategories(): Promise<OtCategoryCard[]> {
  const data = await callProxy<{ CategoryInfoList?: OtCategory[] }>("getRootCategories");
  const list = data?.CategoryInfoList || [];
  return list.map(mapCategory);
}

export async function fetchSubcategories(parentId: string): Promise<OtCategoryCard[]> {
  const data = await callProxy<{ CategoryInfoList?: OtCategory[] }>("getSubcategories", { parentId });
  const list = data?.CategoryInfoList || [];
  return list.map(mapCategory);
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
}

export interface SearchResponse {
  items: OtProductCard[];
  totalCount: number;
  subCategories: OtCategoryCard[];
  breadcrumbs: Array<{ id: string; name: string }>;
}

export async function searchItems(params: SearchParams): Promise<SearchResponse> {
  const data = await callProxy<OtSearchResult>("searchItems", { ...params } as Record<string, unknown>);
  const result = data?.Result;

  const items = (result?.Items?.Items || []).map((item) => mapSearchItem(item));
  const totalCount = result?.Items?.TotalCount || 0;
  const subCategories = (result?.SubCategories?.Items || []).map(mapCategory);
  const breadcrumbs = (result?.BreadCrumbs || []).map((b) => ({ id: b.Id, name: b.Name }));

  return { items, totalCount, subCategories, breadcrumbs };
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
}

export async function fetchProductDetail(itemId: string): Promise<ProductDetail> {
  const data = await callProxy<OtItemFullInfo>("getItemFullInfo", { itemId });
  const item = data?.Result?.Item;

  if (!item) throw new Error("Product not found");

  const images = (item.Pictures?.ItemPicture || []).map((p) => p.Url).filter(Boolean);
  if (item.MainPictureUrl && !images.includes(item.MainPictureUrl)) {
    images.unshift(item.MainPictureUrl);
  }

  return {
    id: item.Id,
    title: item.Title || item.ExternalTitle || "",
    externalTitle: item.ExternalTitle,
    imageUrl: item.MainPictureUrl || images[0] || "",
    images,
    price: item.Price?.ConvertedPrice ?? item.Price?.OriginalPrice ?? 0,
    originalPrice: item.OriginalPrice?.ConvertedPrice ?? item.OriginalPrice?.OriginalPrice,
    currency: item.Price?.CurrencySign || "¥",
    quantity: item.Quantity,
    vendorName: item.VendorName,
    vendorScore: item.VendorScore,
    brandName: item.BrandName,
    categoryId: item.CategoryId,
    features: (item.FeaturedValues || []).map((f) => ({
      name: f.Name,
      value: f.Value,
    })),
    configurators: (item.Configurators || []).map((c) => ({
      pid: c.Pid,
      propertyName: c.PropertyName || "",
      values: (c.Values || []).map((v) => ({
        id: v.Id,
        value: v.PropertyValueDisplayName || v.Value || "",
        imageUrl: v.ImageUrl,
      })),
    })),
    configuredItems: (item.ConfiguredItems || []).map((ci) => ({
      id: ci.Id,
      quantity: ci.Quantity,
      price: ci.Price?.ConvertedPrice ?? ci.Price?.OriginalPrice,
      imageUrl: ci.ImageUrl,
      configuratorIds: (ci.Configurators || []).map((c) => c.Vid),
    })),
    breadcrumbs: (data?.Result?.RootPath || []).map((b) => ({ id: b.Id, name: b.Name })),
    vendor: data?.Result?.Vendor
      ? {
          id: data.Result.Vendor.Id,
          name: data.Result.Vendor.Name,
          score: data.Result.Vendor.Score,
        }
      : undefined,
  };
}

export async function fetchProductDescription(itemId: string): Promise<string> {
  try {
    const data = await callProxy<{ Result?: { ItemDescription?: string } }>(
      "getItemDescription",
      { itemId }
    );
    return data?.Result?.ItemDescription || "";
  } catch {
    return "";
  }
}

// ─── Cart / Basket ───────────────────────────────────────────

export async function getBasket(sessionId: string) {
  return callProxy("getBasket", { sessionId });
}

export async function addItemToBasket(sessionId: string, itemId: string, quantity: number, configurators?: string) {
  return callProxy("addItemToBasket", { sessionId, itemId, quantity, ...(configurators ? { configurators } : {}) });
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

export async function runBasketChecking(sessionId: string) {
  return callProxy("runBasketChecking", { sessionId });
}

export async function getBasketCheckingResult(sessionId: string) {
  return callProxy("getBasketCheckingResult", { sessionId });
}

// ─── Orders (OTAPI) ─────────────────────────────────────────

export async function searchOtOrders(params: { sessionId?: string; statusId?: string; page?: number; pageSize?: number }) {
  return callProxy("searchOrders", params);
}

export async function searchOrdersForUser(userId: string, page = 0, pageSize = 20) {
  return callProxy("searchOrdersForUser", { userId, page, pageSize });
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

// ─── Mappers ─────────────────────────────────────────────────

function mapCategory(cat: OtCategory): OtCategoryCard {
  return {
    id: cat.Id,
    name: cat.Name,
    iconUrl: cat.IconUrl,
    isLeaf: cat.IsLeaf,
  };
}

function mapSearchItem(item: OtSearchItem): OtProductCard {
  return {
    id: item.Id || "",
    title: item.Title || item.ExternalTitle || "",
    imageUrl: item.MainPictureUrl || "",
    price: item.Price?.ConvertedPrice ?? item.Price?.OriginalPrice ?? 0,
    originalPrice: item.OriginalPrice?.ConvertedPrice ?? item.OriginalPrice?.OriginalPrice,
    currency: item.Price?.CurrencySign || "¥",
    vendorName: item.VendorName,
    quantity: item.Quantity,
  };
}
