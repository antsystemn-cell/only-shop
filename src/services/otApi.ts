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
  const { data, error } = await supabase.functions.invoke("ot-api", {
    body: { action, params: { ...params, language: LANGUAGE } },
  });

  if (error) throw new Error(`OT API proxy error: ${error.message}`);
  if (data?.error) throw new Error(`OT API error: ${data.error}`);
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
