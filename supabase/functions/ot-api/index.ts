import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OT_API_BASE = "https://otapi.net/service-json";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const OT_API_KEY = Deno.env.get("OT_API_KEY");
  if (!OT_API_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: "OT_API_KEY is not configured", envCheck: { hasKey: false } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { action, params } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing 'action' parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ot-api] action=${action}, hasSecrets: key=${!!OT_API_KEY}, secret=${!!Deno.env.get("OT_API_SECRET")}`);

    const result = await routeAction(action, OT_API_KEY, params || {});

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("OT API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Action Router ───────────────────────────────────────────

async function routeAction(action: string, apiKey: string, params: Record<string, any>) {
  const lang = params.language || "en";
  const base: Record<string, string> = { instanceKey: apiKey, language: lang };
  // Include sessionId in base if provided - many OT API methods require it
  if (params.sessionId) base.sessionId = params.sessionId;

  switch (action) {
    // ── Sessions ──
    case "getAnonymousSession":
      return callOtApi("GetAnonymousSession", base);
    case "authenticateOperator": {
      const login = params.login || Deno.env.get("OT_OPERATOR_LOGIN") || "";
      const password = params.password || Deno.env.get("OT_OPERATOR_PASSWORD") || "";
      if (!login || !password) throw new Error("Operator credentials not configured");
      return callOtApi("AuthenticateInstanceOperator", { ...base, userLogin: login, userPassword: password });
    }

    // ── Categories ──
    case "getRootCategories":
      return callOtApi("GetRootCategoryInfoList", base);
    case "getSubcategories":
      return callOtApi("GetCategorySubcategoryInfoList", { ...base, parentCategoryId: params.parentId });
    case "getCategoryInfo":
      return callOtApi("GetCategoryInfo", { ...base, categoryId: params.categoryId });
    case "getCategoryInfoList":
      return callOtApi("GetCategoryInfoList", { ...base, parentCategoryId: params.parentId || "" });
    case "getCategorySearchProperties":
      return callOtApi("GetCategorySearchProperties", { ...base, categoryId: params.categoryId });

    // ── Search ──
    case "searchItems":
      return searchItems(apiKey, params);
    case "searchItemsFrame":
      return searchItemsFrame(apiKey, params);

    // ── Product Details ──
    case "getItemFullInfo":
      return callOtApi("BatchGetItemFullInfo", { ...base, itemId: params.itemId, blockList: "Vendor,RootPath,Promotions" });
    case "getItemDescription":
      return callOtApi("GetItemDescription", { ...base, itemId: params.itemId });
    case "getItemInfoList":
      return callOtApi("GetItemInfoList", { ...base, itemId: params.itemId });
    case "getItemPrice":
      return callOtApi("GetItemPrice", { ...base, itemId: params.itemId, quantity: params.quantity || "1", ...(params.configurators ? { configurators: params.configurators } : {}) });
    case "getItemPromotions":
      return callOtApi("GetItemPromotions", { ...base, itemId: params.itemId });
    case "getItemTotalCost":
      return callOtApi("GetItemTotalCost", { ...base, itemId: params.itemId, quantity: params.quantity || "1", ...(params.weight ? { weight: params.weight } : {}) });
    case "batchGetItemTotalCost":
      return callOtApi("BatchGetItemTotalCost", { ...base, xmlParameters: params.xmlParameters });

    // ── Brands ──
    case "getBrandInfoList":
      return callOtApi("GetBrandInfoList", { ...base, categoryId: params.categoryId || "" });

    // ── Cart / Basket ──
    case "getBasket":
      return callOtApi("GetBasket", { ...base, sessionId: params.sessionId });
    case "addItemToBasket":
      return callOtApi("AddItemToBasket", { ...base, sessionId: params.sessionId, itemId: params.itemId, quantity: String(params.quantity || 1), ...(params.configurators ? { xmlParameters: params.configurators } : {}) });
    case "editBasketItemQuantity":
      return callOtApi("EditBasketItemQuantity", { ...base, sessionId: params.sessionId, orderLineId: params.orderLineId, quantity: String(params.quantity) });
    case "removeBasketItem":
      return callOtApi("RemoveItemFromBasket", { ...base, sessionId: params.sessionId, orderLineId: params.orderLineId });
    case "clearBasket":
      return callOtApi("ClearBasket", { ...base, sessionId: params.sessionId });
    case "runBasketChecking":
      return callOtApi("RunBasketChecking", { ...base, sessionId: params.sessionId });
    case "getBasketCheckingResult":
      return callOtApi("GetBasketCheckingResult", { ...base, sessionId: params.sessionId });

    // ── Orders ──
    case "searchOrders":
      return callOtApi("SearchOrders", { ...base, sessionId: params.sessionId, ...(params.statusId ? { statusId: params.statusId } : {}), framePosition: String(params.page || 0), frameSize: String(params.pageSize || 20) });
    case "searchOrdersForUser":
      return callOtApi("SearchOrdersForUser", { ...base, userId: params.userId, framePosition: String(params.page || 0), frameSize: String(params.pageSize || 20) });
    case "getSalesOrderDetails":
      return callOtApi("GetSalesOrderDetailsForOperator", { ...base, orderId: params.orderId });
    case "cancelSalesOrder":
      return callOtApi("CancelSalesOrderForOperator", { ...base, orderId: params.orderId, ...(params.reason ? { reason: params.reason } : {}) });
    case "cancelLineSalesOrder":
      return callOtApi("CancelLineSalesOrderForOperator", { ...base, orderLineId: params.orderLineId, ...(params.reason ? { reason: params.reason } : {}) });
    case "confirmOrderPackaging":
      return callOtApi("ConfirmOrderPackaging", { ...base, orderId: params.orderId });

    // ── Users ──
    case "getUserInfo":
      return callOtApi("GetUserInfo", { ...base, sessionId: params.sessionId });
    case "getUserInfoForOperator":
      return callOtApi("GetUserInfoForOperator", { ...base, userId: params.userId });
    case "getAccountInfo":
      return callOtApi("GetAccountInfo", { ...base, userId: params.userId });
    case "getStatementForOperator":
      return callOtApi("GetStatementForOperator", { ...base, userId: params.userId, framePosition: String(params.page || 0), frameSize: String(params.pageSize || 20) });

    // ── Delivery ──
    case "getDeliveryCountryInfoList":
      return callOtApi("GetDeliveryCountryInfoList", base);
    case "searchDeliveryModes":
      return callOtApi("SearchDeliveryModes", { ...base, sessionId: params.sessionId, ...(params.deliveryCountryCode ? { deliveryCountryCode: params.deliveryCountryCode } : {}) });
    case "searchDeliveryPickupPoints":
      return callOtApi("SearchDeliveryPickupPoints", { ...base, ...(params.deliveryModeId ? { deliveryModeId: params.deliveryModeId } : {}) });
    case "getExternalDeliveryRateList":
      return callOtApi("GetExternalDeliveryRateList", { ...base, ...(params.sessionId ? { sessionId: params.sessionId } : {}), ...(params.weight ? { weight: params.weight } : {}), ...(params.countryCode ? { countryCode: params.countryCode } : {}) });

    // ── Currency ──
    case "getCurrencyList":
      return callOtApi("GetCurrencyList", base);
    case "getCurrencyRateHistory":
      return callOtApi("GetCurrencyRateHistory", { ...base, currencyCode: params.currencyCode, framePosition: String(params.page || 0), frameSize: String(params.pageSize || 30) });

    // ── Discounts ──
    case "getDiscountGroupList":
      return callOtApi("GetDiscountGroupList", base);

    // ── Reviews ──
    case "addItemReview":
      return callOtApi("AddItemReview", { ...base, sessionId: params.sessionId, itemId: params.itemId, text: params.text, rate: String(params.rate || 5) });
    case "addAnswerToItemReview":
      return callOtApi("AddAnswerToItemReview", { ...base, reviewId: params.reviewId, text: params.text });
    case "approveItemReviews":
      return callOtApi("ApproveItemReviews", { ...base, reviewIds: params.reviewIds });
    case "getItemReviewSettings":
      return callOtApi("GetItemReviewSettings", { ...base, includeMetaInfo: "true" });

    // ── Instance / Settings ──
    case "getCommonInstanceOptionsInfo":
      return callOtApi("GetCommonInstanceOptionsInfo", base);
    case "getInstanceOptionsInfo":
      return callOtApi("GetInstanceOptionsInfo", base);
    case "getProviderSettings":
      return callOtApi("GetProviderSettings", base);
    case "getGeolocationSettings":
      return callOtApi("GetGeolocationSettings", base);

    // ── Content ──
    case "getContentMenuItemTree":
      return callOtApi("GetContentMenuItemTree", base);
    case "getBanners":
      return callOtApi("GetBanners", base);
    case "getApplicationUITranslations":
      return callOtApi("GetApplicationUITranslations", { ...base, ...(params.translationGroupName ? { translationGroupName: params.translationGroupName } : {}) });

    // ── Roles & Permissions ──
    case "getAvailableRoleList":
      return callOtApi("GetAvailableRoleList", base);
    case "getOperatorRightTree":
      return callOtApi("GetOperatorRightTree", base);
    case "addInstanceUserToRole":
      return callOtApi("AddInstanceUserToRole", { ...base, userId: params.userId, roleId: params.roleId });

    // ── System Tools ──
    case "getErrorDescription":
      return callOtApi("GetErrorDescription", { ...base, errorCode: params.errorCode });
    case "getCallStatistics":
      return callOtApi("GetCallStatistics", base);
    case "resetInstanceCaches":
      return callOtApi("ResetInstanceCaches", base);
    case "getBlackListContents":
      return callOtApi("GetBlackListContents", { ...base, framePosition: String(params.page || 0), frameSize: String(params.pageSize || 50) });

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ─── Search Items (with XML params) ─────────────────────────

function searchItems(apiKey: string, params: Record<string, any>) {
  const page = params.page || 0;
  const pageSize = params.pageSize || 40;

  const xmlParts: string[] = [];
  if (params.query) xmlParts.push(`<ItemTitle>${escapeXml(params.query)}</ItemTitle>`);
  if (params.categoryId) xmlParts.push(`<CategoryId>${escapeXml(params.categoryId)}</CategoryId>`);
  if (params.vendorId) xmlParts.push(`<VendorId>${escapeXml(params.vendorId)}</VendorId>`);
  if (params.brandId) xmlParts.push(`<BrandId>${escapeXml(params.brandId)}</BrandId>`);
  if (params.minPrice) xmlParts.push(`<MinPrice>${escapeXml(params.minPrice)}</MinPrice>`);
  if (params.maxPrice) xmlParts.push(`<MaxPrice>${escapeXml(params.maxPrice)}</MaxPrice>`);
  if (params.orderBy) xmlParts.push(`<OrderBy>${escapeXml(params.orderBy)}</OrderBy>`);
  if (params.imageUrl) xmlParts.push(`<ImageUrl>${escapeXml(params.imageUrl)}</ImageUrl>`);
  if (params.provider) xmlParts.push(`<Provider>${escapeXml(params.provider)}</Provider>`);

  return callOtApi("BatchSearchItemsFrame", {
    instanceKey: apiKey,
    language: params.language || "en",
    framePosition: String(page * pageSize),
    frameSize: String(pageSize),
    blockList: "SubCategories,SearchProperties",
    xmlParameters: `<SearchItemsParameters>${xmlParts.join("")}</SearchItemsParameters>`,
  });
}

function searchItemsFrame(apiKey: string, params: Record<string, any>) {
  const page = params.page || 0;
  const pageSize = params.pageSize || 40;

  const xmlParts: string[] = [];
  if (params.query) xmlParts.push(`<ItemTitle>${escapeXml(params.query)}</ItemTitle>`);
  if (params.categoryId) xmlParts.push(`<CategoryId>${escapeXml(params.categoryId)}</CategoryId>`);

  return callOtApi("SearchItemsFrame", {
    instanceKey: apiKey,
    language: params.language || "en",
    framePosition: String(page * pageSize),
    frameSize: String(pageSize),
    xmlParameters: `<SearchItemsParameters>${xmlParts.join("")}</SearchItemsParameters>`,
  });
}

// ─── Signature helper ────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getTimestamp(): string {
  const now = new Date();
  return (
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0") +
    String(now.getUTCHours()).padStart(2, "0") +
    String(now.getUTCMinutes()).padStart(2, "0") +
    String(now.getUTCSeconds()).padStart(2, "0")
  );
}

// ─── Core API caller ─────────────────────────────────────────

async function callOtApi(methodName: string, queryParams: Record<string, string>) {
  const OT_API_SECRET = Deno.env.get("OT_API_SECRET");
  const timestamp = getTimestamp();

  const allParams: Record<string, string> = { ...queryParams, timestamp };

  if (OT_API_SECRET) {
    const sortedKeys = Object.keys(allParams).sort();
    const concatenatedValues = sortedKeys.map((k) => allParams[k]).join("");
    const sigInput = methodName + concatenatedValues + OT_API_SECRET;
    const signature = await sha256Hex(sigInput);
    allParams.signature = signature;
  }

  const url = new URL(`${OT_API_BASE}/${methodName}`);
  for (const [key, value] of Object.entries(allParams)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const response = await fetch(url.toString(), { signal: controller.signal });
  clearTimeout(timeout);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OT API HTTP ${response.status}: ${text}`);
  }

  const data = await response.json();

  if (data?.ErrorCode && data.ErrorCode !== "Ok" && data.ErrorCode !== "BatchError") {
    throw new Error(`OT API [${data.ErrorCode}]: ${data.ErrorDescription || "Unknown"}`);
  }

  return data;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
