import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OT_API_BASE = "https://otapi.net/service-json";

// ─── Server-side Response Cache (L2) ────────────────────────
// Caches OTAPI responses in-memory at the edge function level
// This prevents duplicate calls across different frontend clients
interface ServerCacheEntry {
  data: unknown;
  expiresAt: number;
}

const serverCache = new Map<string, ServerCacheEntry>();
const SERVER_CACHE_MAX_SIZE = 500;

// TTLs for different action types (in ms)
const SERVER_CACHE_TTLS: Record<string, number> = {
  getRootCategories: 2 * 60 * 60 * 1000,      // 2hr
  getSubcategories: 2 * 60 * 60 * 1000,        // 2hr
  getCategoryInfo: 60 * 60 * 1000,             // 1hr
  getCategoryInfoList: 60 * 60 * 1000,         // 1hr
  getCategorySearchProperties: 60 * 60 * 1000, // 1hr
  getItemFullInfo: 10 * 60 * 1000,             // 10min
  getItemDescription: 30 * 60 * 1000,          // 30min
  searchItems: 3 * 60 * 1000,                  // 3min
  searchItemsFrame: 3 * 60 * 1000,             // 3min
  getCurrencyList: 60 * 60 * 1000,             // 1hr
  getProviderInfoList: 60 * 60 * 1000,         // 1hr
  getProviderSettings: 60 * 60 * 1000,         // 1hr
  getCommonInstanceOptionsInfo: 60 * 60 * 1000, // 1hr
  getInstanceOptionsInfo: 60 * 60 * 1000,      // 1hr
  getDeliveryCountryInfoList: 60 * 60 * 1000,  // 1hr
  getBannerSettings: 30 * 60 * 1000,           // 30min
  getApplicationDesignSettings: 30 * 60 * 1000,// 30min
  getContentMenuItemTree: 30 * 60 * 1000,      // 30min
  getAvailableRoleList: 60 * 60 * 1000,        // 1hr
  getOrderStatusList: 60 * 60 * 1000,          // 1hr
};

// Actions that should NEVER be cached (mutations, session-dependent, basket)
const NEVER_CACHE_ACTIONS = new Set([
  "getAnonymousSession", "authenticateOperator",
  "getBasket", "addItemToBasket", "editBasketItemQuantity",
  "removeBasketItem", "clearBasket", "runBasketChecking",
  "getBasketCheckingResult", "createOrder", "recreateOrder",
  "registerUser", "authenticateUser",
  "addItemReview", "approveItemReviews",
  "createContentMenuItem", "updateContentMenuItem", "deleteContentMenuItem",
  "updateApplicationDesignSettings", "updateTranslationSettings",
  "resetInstanceCaches", "createWarehouseItem",
  "cancelSalesOrder", "cancelLineSalesOrder", "confirmOrderPackaging",
  "changeEmail", "changePhone", "confirmEmail", "confirmPhone",
  "createUserProfile", "updateUserProfile", "deleteUserProfile",
  "createBalanceChargingBill", "salesPaymentReserve",
  "addUserToDiscountGroup", "removeUserFromDiscountGroup",
  "batchSimplifiedAddItemsToBasket", "moveItemsBetweenBasketAndNote",
  "updateOrderLineInfo", "createInstanceRole", "attachRightsToRole",
  "deleteInstanceRole", "addInstanceUserToRole", "removeUserFromRole",
  "addInstanceLogEntry", "addItemRatingList", "addElementsSetToRatingList",
  "externalAuthentication", "rewardItemReview",
]);

// Call counter for monitoring
let totalOtapiCalls = 0;
let cacheHitsServer = 0;

function getServerCacheKey(action: string, params: Record<string, any>): string {
  // Remove session-specific and timestamp params from cache key
  const { sessionId, timestamp, signature, ...keyParams } = params;
  return `${action}:${JSON.stringify(keyParams)}`;
}

function pruneServerCache() {
  if (serverCache.size <= SERVER_CACHE_MAX_SIZE) return;
  const now = Date.now();
  // Remove expired entries first
  for (const [key, entry] of serverCache) {
    if (entry.expiresAt < now) serverCache.delete(key);
  }
  // If still too large, remove oldest
  if (serverCache.size > SERVER_CACHE_MAX_SIZE) {
    const entries = Array.from(serverCache.entries());
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const toRemove = entries.slice(0, entries.length - SERVER_CACHE_MAX_SIZE + 50);
    for (const [key] of toRemove) serverCache.delete(key);
  }
}

// ─── Extract activityId string from OTAPI nested response ───
// OTAPI returns activityId as { Type: "BasketChecking", Id: { Value: "uuid-string" } }
// We need to extract the plain string UUID from this nested structure
function extractActivityIdString(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "object") {
    const obj = raw as Record<string, any>;
    // Pattern: { Id: { Value: "uuid" } }
    if (obj.Id?.Value) return String(obj.Id.Value);
    // Pattern: { Value: "uuid" }
    if (obj.Value) return String(obj.Value);
    // Pattern: { ActivityId: "uuid" } or nested
    if (obj.ActivityId) return extractActivityIdString(obj.ActivityId);
  }
  return null;
}

// ─── Default XML helpers ────────────────────────────────────
function buildRatingListXmlSearchParameters() {
  return `<BatchRatingListSearchParameters><UseDefaultParameters>true</UseDefaultParameters></BatchRatingListSearchParameters>`;
}

function buildWarehouseXmlSearchParameters(params: Record<string, any> = {}) {
  const parts: string[] = [];
  if (params.categoryId) parts.push(`<CategoryId>${escapeXml(String(params.categoryId))}</CategoryId>`);
  if (params.vendorId) parts.push(`<VendorId>${escapeXml(String(params.vendorId))}</VendorId>`);
  if (params.name) parts.push(`<Name>${escapeXml(String(params.name))}</Name>`);
  return `<SearchParameters>${parts.join("")}</SearchParameters>`;
}

// ─── Async log to DB (fire-and-forget) ──────────────────────
const logBuffer: Array<Record<string, unknown>> = [];
let logFlushTimer: ReturnType<typeof setTimeout> | null = null;

async function flushLogs() {
  if (logBuffer.length === 0) return;
  const batch = logBuffer.splice(0, logBuffer.length);
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
    await fetch(`${SUPABASE_URL}/rest/v1/otapi_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(batch),
    });
  } catch (e) {
    console.error("[ot-api] log flush error:", e);
  }
}

function logOtapiCall(entry: Record<string, unknown>) {
  logBuffer.push(entry);
  if (logFlushTimer) clearTimeout(logFlushTimer);
  if (logBuffer.length >= 10) {
    flushLogs();
  } else {
    logFlushTimer = setTimeout(flushLogs, 3000);
  }
}

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

    const startTime = Date.now();

    // ─── Server-side cache check ───────────────────────────
    const cacheTtl = SERVER_CACHE_TTLS[action];
    const canCache = cacheTtl && !NEVER_CACHE_ACTIONS.has(action);

    if (canCache) {
      const cacheKey = getServerCacheKey(action, params || {});
      const cached = serverCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        cacheHitsServer++;
        // Log cache hit
        logOtapiCall({
          method: action,
          provider: params?.providerType || "otapi",
          params_hash: cacheKey.substring(0, 100),
          page_source: params?._pageSource || null,
          response_time_ms: Date.now() - startTime,
          error_code: "Ok",
          is_paid: false,
          is_cache_hit: true,
        });
        return new Response(JSON.stringify(cached.data), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
        });
      }
    }

    console.log(`[ot-api] action=${action}, hasSecrets: key=${!!OT_API_KEY}, secret=${!!Deno.env.get("OT_API_SECRET")}`);
    totalOtapiCalls++;

    const result = await routeAction(action, OT_API_KEY, params || {});
    const elapsed = Date.now() - startTime;
    const errorCode = result?.ErrorCode || "Ok";
    const isPaid = errorCode === "Ok" || errorCode === "BatchError";

    // Log actual API call
    logOtapiCall({
      method: action,
      provider: params?.providerType || "otapi",
      params_hash: getServerCacheKey(action, params || {}).substring(0, 100),
      page_source: params?._pageSource || null,
      response_time_ms: elapsed,
      error_code: errorCode,
      is_paid: isPaid,
      is_cache_hit: false,
    });

    // ─── Store in server cache ─────────────────────────────
    if (canCache && result) {
      const cacheKey = getServerCacheKey(action, params || {});
      serverCache.set(cacheKey, { data: result, expiresAt: Date.now() + cacheTtl! });
      pruneServerCache();
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" },
    });
  } catch (error: unknown) {
    console.error("OT API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Log error call
    logOtapiCall({
      method: "unknown",
      provider: "otapi",
      error_code: errorMessage.substring(0, 100),
      is_paid: false,
      is_cache_hit: false,
    });

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Action Router ───────────────────────────────────────────

async function routeAction(action: string, apiKey: string, params: Record<string, any>) {
  const lang = params.language || "khk";
  const base: Record<string, string> = { instanceKey: apiKey, language: lang };
  if (params.sessionId) base.sessionId = params.sessionId;

  // Helper: base + includeMetaInfo (many OTAPI methods require this)
  const baseMeta: Record<string, string> = { ...base, includeMetaInfo: "true" };

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
    case "getItemTotalCost": {
      const gtcParams: Record<string, string> = {
        ...base,
        itemId: params.itemId,
        quantity: params.quantity || "1",
        ...(params.weight ? { weight: params.weight } : {}),
      };
      // Support configurationId for Amazon products
      if (params.configurationId) {
        gtcParams.configurationId = params.configurationId;
      }
      if (params.priceType) {
        gtcParams.priceType = params.priceType;
      }
      if (params.promotionId) {
        gtcParams.promotionId = params.promotionId;
      }
      return callOtApi("GetItemTotalCost", gtcParams);
    }
    case "batchGetItemTotalCost": {
      const bgtcParams: Record<string, string> = {
        ...base,
        xmlParameters: params.xmlParameters,
      };
      if (params.blockList) bgtcParams.blockList = params.blockList;
      return callOtApi("BatchGetItemTotalCost", bgtcParams);
    }
    case "batchGetSimplifiedItemConfigurationInfo": {
      const configParams: Record<string, string> = {
        ...base,
        itemId: params.itemId,
        xmlRequest: params.xmlRequest || "<Request />",
        blockList: params.blockList || "ConfigurationDetails",
      };
      if (params.itemParameters) configParams.itemParameters = params.itemParameters;
      return callOtApi("BatchGetSimplifiedItemConfigurationInfo", configParams);
    }

    // ── Brands ──
    case "getBrandInfoList":
      return callOtApi("GetBrandInfoList", { ...base, categoryId: params.categoryId || "" });

    // ── Cart / Basket ──
    case "getBasket": {
      console.log("[ot-api] GetBasket sessionId:", params.sessionId);
      const basketResult = await callOtApi("GetBasket", { ...base, sessionId: params.sessionId });
      // Log basket structure safely
      try {
        const ci = basketResult?.CollectionInfo || basketResult?.Result?.CollectionInfo;
        console.log("[ot-api] GetBasket TotalCount:", ci?.TotalCount, "hasElements:", !!ci?.Elements);
        if (ci?.Elements) {
          const elems = Array.isArray(ci.Elements) ? ci.Elements : [ci.Elements];
          const first = elems[0];
          if (first && typeof first === "object") {
            console.log("[ot-api] GetBasket first element keys:", Object.keys(first));
            const sample = JSON.stringify(first) || "";
            console.log("[ot-api] GetBasket first sample:", sample.substring(0, 1000));
          } else {
            console.log("[ot-api] GetBasket first element is empty or non-object:", typeof first);
          }
        } else {
          console.log("[ot-api] GetBasket raw top keys:", Object.keys(basketResult || {}));
        }
      } catch(e) { console.log("[ot-api] GetBasket log error:", String(e)); }
      return basketResult;
    }
    case "addItemToBasket": {
      // Use AddItemToBasket per OTAPI docs: http://docs.otapi.net/en/Documentations/Method?name=AddItemToBasket
      // Required: sessionId, itemId, quantity, fieldParameters, priceType
      // Optional: configurationId (for configurable items)
      const fieldParams = params.fieldParameters || "<Fields/>";
      console.log("[ot-api] AddItemToBasket itemId:", params.itemId, 
        "configurationId:", params.configurationId || "(none)", 
        "fieldParams:", fieldParams.substring(0, 200));
      
      const addParams: Record<string, string> = {
        ...base,
        sessionId: params.sessionId,
        itemId: params.itemId,
        quantity: String(params.quantity || 1),
        fieldParameters: fieldParams,
        priceType: params.priceType || "Default",
      };
      // Only include configurationId if provided (not empty string)
      if (params.configurationId) {
        addParams.configurationId = params.configurationId;
      }
      return callOtApi("AddItemToBasket", addParams);
    }
    case "editBasketItemQuantity":
      return callOtApi("EditBasketItemQuantity", { ...base, sessionId: params.sessionId, elementId: params.orderLineId || params.elementId, quantity: String(params.quantity) });
    case "removeBasketItem":
      return callOtApi("RemoveItemFromBasket", { ...base, sessionId: params.sessionId, elementId: params.orderLineId || params.elementId });
    case "clearBasket":
      return callOtApi("ClearBasket", { ...base, sessionId: params.sessionId });
    case "runBasketChecking": {
      // elements must be comma-separated string of element IDs, or omitted entirely
      const rbcParams: Record<string, string> = { ...base, sessionId: params.sessionId };
      if (params.elements && typeof params.elements === "string" && params.elements.trim()) {
        rbcParams.elements = params.elements.trim();
      }
      console.log("[ot-api] RunBasketChecking elements:", rbcParams.elements || "(entire basket)");
      const rbcResult = await callOtApi("RunBasketChecking", rbcParams);
      console.log("[ot-api] RunBasketChecking raw result keys:", JSON.stringify(Object.keys(rbcResult || {})));
      // Extract activityId - OTAPI returns nested object: { Type: "BasketChecking", Id: { Value: "uuid" } }
      const rawActivityId = rbcResult?.Result?.ActivityId || rbcResult?.ActivityId || rbcResult?.Result;
      const activityIdStr = extractActivityIdString(rawActivityId);
      console.log("[ot-api] RunBasketChecking extracted activityId:", activityIdStr, "typeof:", typeof activityIdStr);
      return { ...rbcResult, _activityId: activityIdStr };
    }
    case "getBasketCheckingResult": {
      // activityId must be a plain string UUID
      const gbcrParams: Record<string, string> = { ...base, sessionId: params.sessionId };
      const rawAid = params.activityId;
      const aidStr = extractActivityIdString(rawAid);
      if (aidStr) {
        gbcrParams.activityId = aidStr;
      }
      console.log("[ot-api] GetBasketCheckingResult activityId:", aidStr || "(none)", "original type:", typeof rawAid);
      const checkResult = await callOtApi("GetBasketCheckingResult", gbcrParams);
      // Log the result structure to debug IsReady detection
      const resultObj = checkResult?.Result || checkResult;
      console.log("[ot-api] GetBasketCheckingResult response keys:", JSON.stringify(Object.keys(checkResult || {})));
      console.log("[ot-api] GetBasketCheckingResult Result keys:", JSON.stringify(Object.keys(resultObj || {})));
      console.log("[ot-api] GetBasketCheckingResult IsReady:", resultObj?.IsReady, "State:", resultObj?.State, "Status:", resultObj?.Status);
      return checkResult;
    }

    // ── Orders ──
    case "searchOrders":
      return callOtApi("SearchOrders", { ...base, sessionId: params.sessionId, ...(params.statusId ? { statusId: params.statusId } : {}), framePosition: String(params.page || 0), frameSize: String(params.pageSize || 20) });
    case "searchOrdersForUser":
      return callOtApi("SearchOrdersForUser", { ...base, userId: params.userId, ...(params.statusId ? { statusId: params.statusId } : {}), framePosition: String(params.page || 0), frameSize: String(params.pageSize || 20) });
    case "searchAllOrders":
      return searchAllOrders(apiKey, params);
    case "getOrderLineStatusHistory":
      return callOtApi("GetOrderLineStatusHistory", { ...base, orderLineId: params.orderLineId });
    case "getSalesOrderDetails":
      return callOtApi("GetSalesOrderDetailsForOperator", { ...base, orderId: params.orderId });
    case "cancelSalesOrder":
      return callOtApi("CancelSalesOrderForOperator", { ...base, orderId: params.orderId, ...(params.reason ? { reason: params.reason } : {}) });
    case "cancelLineSalesOrder":
      return callOtApi("CancelLineSalesOrderForOperator", { ...base, orderLineId: params.orderLineId, ...(params.reason ? { reason: params.reason } : {}) });
    case "createOrder":
      return createOrder(apiKey, params);
    case "recreateOrder":
      return callOtApi("RecreateOrder", { ...base, sessionId: params.sessionId, orderId: params.orderId });

    // ── User Profiles (Delivery Addresses) ──
    case "getUserProfileInfoList":
      return callOtApi("GetUserProfileInfoList", { ...base, sessionId: params.sessionId });
    case "createUserProfile":
      return callOtApi("CreateUserProfile", { ...base, sessionId: params.sessionId, xmlParameters: params.xmlParameters });
    case "updateUserProfile":
      return callOtApi("UpdateUserProfile", { ...base, sessionId: params.sessionId, xmlParameters: params.xmlParameters });
    case "deleteUserProfile":
      return callOtApi("DeleteUserProfile", { ...base, sessionId: params.sessionId, profileId: params.profileId });
    case "searchCities":
      return callOtApi("SearchCities", { ...base, cityName: params.cityName || "", ...(params.countryCode ? { countryCode: params.countryCode } : {}) });

    case "confirmOrderPackaging":
      return callOtApi("ConfirmOrderPackaging", { ...base, orderId: params.orderId });

    // ── Users ──
    case "registerUser":
      return registerUser(apiKey, params);
    case "authenticateUser":
      return callOtApi("Authenticate", { ...base, userLogin: params.login, userPassword: params.password });
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
      return callOtApi("GetDiscountGroupList", baseMeta);

    // ── Reviews ──
    case "addItemReview":
      return callOtApi("AddItemReview", { ...base, sessionId: params.sessionId, itemId: params.itemId, text: params.text, rate: String(params.rate || 5) });
    case "addAnswerToItemReview":
      return callOtApi("AddAnswerToItemReview", { ...base, reviewId: params.reviewId, text: params.text });
    case "approveItemReviews":
      return callOtApi("ApproveItemReviews", { ...base, reviewIds: params.reviewIds });
    case "getItemReviewSettings":
      return callOtApi("GetItemReviewSettings", baseMeta);

    // ── Instance / Settings ──
    case "getCommonInstanceOptionsInfo":
      return callOtApi("GetCommonInstanceOptionsInfo", baseMeta);
    case "getInstanceOptionsInfo":
      return callOtApi("GetInstanceOptionsInfo", baseMeta);
    case "getProviderSettings":
      return callOtApi("GetProviderSettings", {
        ...baseMeta,
        ...(params.providerType ? { providerType: params.providerType } : {}),
      });
    case "getGeolocationSettings":
      return callOtApi("GetGeolocationSettings", baseMeta);

    // ── Content ──
    case "getContentMenuItemTree":
      return callOtApi("GetContentMenuItemTree", { ...baseMeta, menuList: params.menuList || "<MenuList></MenuList>" });
    case "getBanners":
      return callOtApi("GetBanners", baseMeta);
    case "getApplicationUITranslations":
      return callOtApi("GetApplicationUITranslations", { ...baseMeta, ...(params.translationGroupName ? { translationGroupName: params.translationGroupName } : {}) });

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

    // ── Translation & Language Settings ──
    case "getTranslationSettings":
      return getTranslationSettingsWithFallback(baseMeta, params.sessionId);
    case "updateTranslationSettings":
      return callOtApi("UpdateTranslationSettings", { ...base, sessionId: params.sessionId, xmlUpdateData: params.xmlUpdateData });
    case "getTranslatableContentList":
      return callOtApi("GetTranslatableContentList", { ...base, sessionId: params.sessionId });
    case "searchTranslations":
      return callOtApi("SearchTranslations", { ...base, sessionId: params.sessionId, xmlSearchParameters: params.xmlSearchParameters || "<TranslationSearchParameters/>", framePosition: String(params.page || 0), frameSize: String(params.pageSize || 50) });

    // ── Design & Theme ──
    case "getApplicationDesignSettings":
      return callOtApi("GetApplicationDesignSettings", baseMeta);
    case "updateApplicationDesignSettings":
      return callOtApi("UpdateApplicationDesignSettings", { ...base, xmlParameters: params.xmlParameters });

    // ── Auth Extended ──
    case "changeEmail":
      return callOtApi("ChangeEmail", { ...base, sessionId: params.sessionId, newEmail: params.newEmail });
    case "changePhone":
      return callOtApi("ChangePhone", { ...base, sessionId: params.sessionId, newPhone: params.newPhone });
    case "confirmEmail":
      return callOtApi("ConfirmEmail", { ...base, sessionId: params.sessionId, confirmationCode: params.confirmationCode });
    case "confirmPhone":
      return callOtApi("ConfirmPhone", { ...base, sessionId: params.sessionId, confirmationCode: params.confirmationCode });
    case "externalAuthentication":
      return callOtApi("ExternalAuthentication", { ...base, providerName: params.providerName, externalUserId: params.externalUserId, ...(params.userLogin ? { userLogin: params.userLogin } : {}), ...(params.userEmail ? { userEmail: params.userEmail } : {}) });

    // ── User Extended ──
    case "getUserPreferences":
      return callOtApi("GetUserPreferences", { ...base, sessionId: params.sessionId });
    case "searchUsers":
      return callOtApi("FindBaseUserInfoListFrame", { ...base, framePosition: String(params.page || 0), frameSize: String(params.pageSize || 20), ...(params.searchText ? { searchText: params.searchText } : {}) });

    // ── Basket Extended ──
    // BatchSimplifiedAddItemsToBasket is undocumented per OT Commerce guidance.
    // Use sequential AddItemToBasket calls instead for reliability.
    case "batchSimplifiedAddItemsToBasket": {
      const batchXml = params.xmlParameters || params.xmlRequest || "";
      // Try the batch method first, fall back to sequential if it fails
      try {
        return await callBatchSimplifiedAdd({
          instanceKey: apiKey, language: lang, sessionId: params.sessionId, xmlRequest: batchXml,
        });
      } catch (batchErr) {
        console.warn("[ot-api] BatchSimplifiedAddItemsToBasket failed, method may be unsupported:", String(batchErr));
        throw new Error("Batch add is not supported. Please add items one by one.");
      }
    }
    case "moveItemsBetweenBasketAndNote":
      return callOtApi("MoveItemsBetweenBasketAndNote", { ...base, sessionId: params.sessionId, elementId: params.orderLineId || params.elementId, direction: params.direction || "ToNote" });

    // ── Orders Extended ──
    case "updateOrderLineInfo":
      return callOtApi("UpdateOrderLineInfo", { ...base, orderLineId: params.orderLineId, xmlParameters: params.xmlParameters });
    case "getOrderStatusList":
      return callOtApi("GetOrderStatusList", { ...baseMeta, ...(params.sessionId ? { sessionId: params.sessionId } : {}) });

    // ── Payment ──
    case "createBalanceChargingBill":
      return callOtApi("CreateBalanceChargingBill", { ...base, sessionId: params.sessionId, amount: String(params.amount), ...(params.currencyCode ? { currencyCode: params.currencyCode } : {}) });
    case "salesPaymentReserve":
      return callOtApi("SalesPaymentReserve", { ...base, orderId: params.orderId, amount: String(params.amount), ...(params.currencyCode ? { currencyCode: params.currencyCode } : {}) });

    // ── Discounts Extended ──
    case "getUserDiscountGroups":
      return callOtApi("GetUserDiscountGroups", { ...base, userId: params.userId });
    case "addUserToDiscountGroup":
      return callOtApi("AddUserToDiscountGroup", { ...base, userId: params.userId, discountGroupId: params.discountGroupId });
    case "removeUserFromDiscountGroup":
      return callOtApi("RemoveUserFromDiscountGroup", { ...base, userId: params.userId, discountGroupId: params.discountGroupId });

    // ── Content CRUD ──
    case "createContentMenuItem":
      return callOtApi("CreateContentMenuItem", { ...base, xmlParameters: params.xmlParameters });
    case "updateContentMenuItem":
      return callOtApi("UpdateContentMenuItem", { ...base, xmlParameters: params.xmlParameters });
    case "deleteContentMenuItem":
      return callOtApi("DeleteContentMenuItem", { ...base, menuItemId: params.menuItemId });
    case "searchContentMenuItems":
      return callOtApi("SearchContentMenuItems", { ...baseMeta, framePosition: String(params.page || 0), frameSize: String(params.pageSize || 50), ...(params.parentMenuItemId ? { parentMenuItemId: params.parentMenuItemId } : {}) });

    // ── Reviews Extended ──
    case "rewardItemReview":
      return callOtApi("RewardItemReview", { ...base, reviewId: params.reviewId, amount: String(params.amount || 0) });
    case "searchItemReviews":
      return callOtApi("SearchItemReviews", { ...baseMeta, framePosition: String(params.page || 0), frameSize: String(params.pageSize || 20), ...(params.itemId ? { itemId: params.itemId } : {}), ...(params.isApproved ? { isApproved: params.isApproved } : {}) });

    // ── Reporting ──
    case "searchInstanceUserLogEntries":
      return callOtApi("SearchInstanceUserLogEntries", { ...baseMeta, framePosition: String(params.page || 0), frameSize: String(params.pageSize || 50), ...(params.userId ? { userId: params.userId } : {}), ...(params.actionType ? { actionType: params.actionType } : {}) });
    case "getInstanceLogEntryList":
      return callOtApi("GetInstanceLogEntryList", { ...baseMeta, framePosition: String(params.page || 0), frameSize: String(params.pageSize || 50) });
    case "addInstanceLogEntry":
      return callOtApi("AddInstanceLogEntry", { ...base, message: params.message, logLevel: params.logLevel || "Info" });
    case "getMethodNamesForStatistics":
      return callOtApi("GetMethodNamesForStatistics", { ...base });

    // ── Roles Extended ──
    case "createInstanceRole":
      return callOtApi("CreateInstanceRole", { ...base, roleName: params.roleName, ...(params.roleDescription ? { roleDescription: params.roleDescription } : {}) });
    case "attachRightsToRole":
      return callOtApi("AttachRightsToRole", { ...base, roleId: params.roleId, xmlParameters: params.xmlParameters });
    case "deleteInstanceRole":
      return callOtApi("DeleteInstanceRole", { ...base, roleId: params.roleId });
    case "removeUserFromRole":
      return callOtApi("RemoveInstanceUserFromRole", { ...base, userId: params.userId, roleId: params.roleId });

    // ── Providers Extended ──
    case "getProviderInfoList":
      return callOtApi("GetProviderInfoList", baseMeta);
    case "getProviderCommonSettings":
      return callOtApi("GetProviderCommonSettings", { ...baseMeta, providerType: params.providerType });

    // ── Provider Category Tree (for Amazon, etc.) ──
    case "getProviderInfo":
      return callOtApi("GetProviderInfo", { ...baseMeta, providerType: params.providerType });
    case "getProviderCategorySubcategories":
      return callOtApi("GetProviderCategorySubcategories", { ...baseMeta, categoryId: params.categoryId });
    case "getProviderCategory":
      return callOtApi("GetProviderCategory", { ...baseMeta, categoryId: params.categoryId });
    case "getProviderCategoryRootPath":
      return callOtApi("GetProviderCategoryRootPath", { ...baseMeta, categoryId: params.categoryId });
    case "getProviderBriefCatalog":
      return callOtApi("GetProviderBriefCatalog", { ...baseMeta, providerType: params.providerType });

    // ── Rating Lists / Element Collections ──
    case "getAutoRatingListsSettings":
      return callOtApi("GetAutoRatingListsSettings", baseMeta);
    case "batchSearchRatingLists":
      return callOtApi("BatchSearchRatingLists", {
        ...baseMeta,
        xmlSearchParameters: params.xmlSearchParameters || buildRatingListXmlSearchParameters(),
        ...(params.blockList ? { blockList: params.blockList } : {}),
      });
    case "addItemRatingList":
      return callOtApi("AddItemRatingList", { ...base, xmlParameters: params.xmlParameters });
    case "addElementsSetToRatingList":
      return callOtApi("AddElementsSetToRatingList", { ...base, xmlParameters: params.xmlParameters });

    // ── Warehouse ──
    case "searchWarehouseItems":
      return callOtApi("SearchWarehouseItems", {
        ...baseMeta,
        framePosition: String(params.page || 0),
        frameSize: String(params.pageSize || 20),
        xmlSearchParameters: params.xmlSearchParameters || buildWarehouseXmlSearchParameters(params),
      });
    case "searchWarehouseCategories":
      return callOtApi("SearchWarehouseCategories", {
        ...baseMeta,
        framePosition: String(params.page || 0),
        frameSize: String(params.pageSize || 50),
        xmlSearchParameters: params.xmlSearchParameters || buildWarehouseXmlSearchParameters(params),
      });
    case "createWarehouseItem":
      return callOtApi("CreateWarehouseItem", { ...base, xmlParameters: params.xmlParameters });

    // ── Price Formation ──
    case "getPriceFormationGroupList":
      return callOtApi("GetPriceFormationGroupList", baseMeta);
    case "getPriceFormationSettings":
      return callOtApi("GetPriceFormationSettings", baseMeta);

    // ── User Collections Settings ──
    case "getCollectionsSettings":
      return callOtApi("GetCollectionsSettings", baseMeta);

    // ── OT Users (Admin) ──
    case "findBaseUserInfoListFrame":
      return callOtApi("FindBaseUserInfoListFrame", { ...base, framePosition: String(params.page || 0), frameSize: String(params.pageSize || 20), ...(params.searchText ? { searchText: params.searchText } : {}) });

    // ── Banner Settings ──
    case "getBannerSettings":
      return callOtApi("GetBannerSettings", baseMeta);

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function getTranslationSettingsWithFallback(baseMeta: Record<string, string>, sessionId?: string) {
  try {
    return await callOtApi("GetTranslationSettings", { ...baseMeta, ...(sessionId ? { sessionId } : {}) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("InternalError") || message.includes("GetTranslationSettings")) {
      const common = await callOtApi("GetCommonInstanceOptionsInfo", baseMeta);
      return {
        ErrorCode: "Ok",
        RequestId: (common as any)?.RequestId,
        RequestTime: (common as any)?.RequestTime,
        Result: {
          Source: "fallback:GetCommonInstanceOptionsInfo",
          Languages: (common as any)?.Result?.Languages ?? null,
          Features: (common as any)?.Result?.Features ?? null,
          TranslatableOptions: (common as any)?.Result?.TranslatableOptions ?? null,
        },
      };
    }
    throw error;
  }
}

// ─── Create Order (with XML + element validation) ───────────

async function createOrder(apiKey: string, params: Record<string, any>) {
  const base = { instanceKey: apiKey, language: params.language || "khk" };

  // Build XML parameters
  const xmlParts: string[] = [];
  if (params.deliveryModeId) xmlParts.push(`<DeliveryModeId>${escapeXml(String(params.deliveryModeId))}</DeliveryModeId>`);
  if (params.profileId) xmlParts.push(`<UserProfileId>${escapeXml(String(params.profileId))}</UserProfileId>`);
  if (params.comment) xmlParts.push(`<Comment>${escapeXml(String(params.comment))}</Comment>`);

  // Use elementIds from frontend if provided, otherwise order entire basket
  if (params.elementIds && Array.isArray(params.elementIds) && params.elementIds.length > 0) {
    const elemXml = params.elementIds.map((id: string) => `<OrderLineId>${escapeXml(String(id))}</OrderLineId>`).join("");
    xmlParts.push(`<Elements>${elemXml}</Elements>`);
    console.log("[ot-api] CreateOrder with", params.elementIds.length, "specific elements");
  } else {
    console.log("[ot-api] CreateOrder for entire basket");
  }

  const xmlCreateData = `<OrderCreateData>${xmlParts.join("")}</OrderCreateData>`;
  console.log("[ot-api] CreateOrder xmlCreateData:", xmlCreateData);

  return callOtApi("CreateOrder", {
    ...base,
    sessionId: params.sessionId,
    xmlCreateData,
  });
}

// ─── Register User ──────────────────────────────────────────

function registerUser(apiKey: string, params: Record<string, any>) {
  const xmlParts: string[] = [];
  if (params.login) xmlParts.push(`<Login>${escapeXml(String(params.login))}</Login>`);
  if (params.email) xmlParts.push(`<Email>${escapeXml(String(params.email))}</Email>`);
  if (params.password) xmlParts.push(`<Password>${escapeXml(String(params.password))}</Password>`);
  if (params.phone) xmlParts.push(`<Phone>${escapeXml(String(params.phone))}</Phone>`);

  return callOtApi("RegisterUser", {
    instanceKey: apiKey,
    language: params.language || "khk",
    sessionId: params.sessionId,
    userParameters: `<UserRegistrationData>${xmlParts.join("")}</UserRegistrationData>`,
  });
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

  // Search property filters (e.g. color, size) — format: { "propertyId": "valueId" }
  if (params.properties && typeof params.properties === "object") {
    for (const [propId, valueId] of Object.entries(params.properties)) {
      if (valueId) xmlParts.push(`<Property${escapeXml(String(propId))}>${escapeXml(String(valueId))}</Property${escapeXml(String(propId))}>`);
    }
  }

  return callOtApi("BatchSearchItemsFrame", {
    instanceKey: apiKey,
    language: params.language || "khk",
    framePosition: String(page * pageSize),
    frameSize: String(pageSize),
    blockList: "SubCategories,SearchProperties",
    xmlParameters: `<SearchItemsParameters>${xmlParts.join("")}</SearchItemsParameters>`,
  });
}

function searchAllOrders(apiKey: string, params: Record<string, any>) {
  const xmlParts: string[] = [];
  if (params.statusId) xmlParts.push(`<StatusId>${escapeXml(String(params.statusId))}</StatusId>`);
  if (params.userId) xmlParts.push(`<UserId>${escapeXml(String(params.userId))}</UserId>`);
  if (params.orderId) xmlParts.push(`<OrderId>${escapeXml(String(params.orderId))}</OrderId>`);

  return callOtApi("SearchSalesOrdersForOperator", {
    instanceKey: apiKey,
    language: params.language || "khk",
    framePosition: String(params.page || 0),
    frameSize: String(params.pageSize || 20),
    xmlSearchParameters: `<SalesOrderSearchParameters>${xmlParts.join("")}</SalesOrderSearchParameters>`,
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
    language: params.language || "khk",
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

  // Build params: only include non-empty values for signature calculation
  // Per OTAPI docs: signature = SHA256(methodName + concatenatedSortedValues + secret)
  // "Concatenation of values should be obtained before URL-encoding from sorted parameters by name"
  const allParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null && value !== "") {
      allParams[key] = value;
    }
  }
  allParams.timestamp = timestamp;

  if (OT_API_SECRET) {
    const sortedKeys = Object.keys(allParams).sort();
    const concatenatedValues = sortedKeys.map((k) => allParams[k]).join("");
    const sigInput = methodName + concatenatedValues + OT_API_SECRET;
    const signature = await sha256Hex(sigInput);
    allParams.signature = signature;
  }

  const url = new URL(`${OT_API_BASE}/${methodName}`);
  for (const [key, value] of Object.entries(allParams)) {
    url.searchParams.set(key, String(value));
  }

  // Log full URL for debugging AddItemToBasket
  if (methodName === "AddItemToBasket") {
    console.log("[ot-api] AddItemToBasket full URL:", url.toString());
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
    // Per OTAPI docs: SessionExpired, AccessDenied, InstanceKeyBan are global errors
    const errDesc = data.ErrorDescription || data.SubErrorCode || "Unknown";
    throw new Error(`OT API [${data.ErrorCode}${data.SubErrorCode ? '/' + data.SubErrorCode : ''}]: ${errDesc}`);
  }

  return data;
}

// ─── Form POST caller (for methods with XML params like fieldParameters) ────

async function callOtApiFormPost(methodName: string, allInputParams: Record<string, string>) {
  const OT_API_SECRET = Deno.env.get("OT_API_SECRET");
  const timestamp = getTimestamp();

  const allParams: Record<string, string> = { ...allInputParams, timestamp };

  if (OT_API_SECRET) {
    const sortedKeys = Object.keys(allParams).sort();
    const concatenatedValues = sortedKeys.map((k) => allParams[k]).join("");
    const sigInput = methodName + concatenatedValues + OT_API_SECRET;
    const signature = await sha256Hex(sigInput);
    allParams.signature = signature;
  }

  // Build form body (application/x-www-form-urlencoded)
  const formBody = new URLSearchParams();
  for (const [key, value] of Object.entries(allParams)) {
    formBody.set(key, value ?? "");
  }

  const url = `${OT_API_BASE}/${methodName}`;
  console.log(`[ot-api] POST ${url}, params:`, Object.keys(allParams).join(","));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody.toString(),
    signal: controller.signal,
  });
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

// ─── Call OTAPI via XML service endpoint (handles fieldParameters better) ────
async function callOtApiViaXmlEndpoint(methodName: string, allInputParams: Record<string, string>) {
  const OT_API_SECRET = Deno.env.get("OT_API_SECRET");
  const timestamp = getTimestamp();
  const allParams: Record<string, string> = { ...allInputParams, timestamp };

  if (OT_API_SECRET) {
    const sortedKeys = Object.keys(allParams).sort();
    const concatenatedValues = sortedKeys.map((k) => allParams[k]).join("");
    const sigInput = methodName + concatenatedValues + OT_API_SECRET;
    allParams.signature = await sha256Hex(sigInput);
  }

  // Use XML service endpoint (handles empty params better than JSON endpoint)
  const paramParts: string[] = [];
  for (const [key, value] of Object.entries(allParams)) {
    paramParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value ?? ""))}`);
  }
  const fullUrl = `https://otapi.net/service/${methodName}?${paramParts.join("&")}`;
  console.log(`[ot-api] XML endpoint call: ${methodName}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const response = await fetch(fullUrl, { signal: controller.signal });
  clearTimeout(timeout);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OT API HTTP ${response.status}: ${text}`);
  }

  const xmlText = await response.text();
  const errorMatch = xmlText.match(/<ErrorCode>(\w+)<\/ErrorCode>/);
  const errorCode = errorMatch?.[1] || "Ok";
  
  if (errorCode !== "Ok" && errorCode !== "BatchError") {
    const descMatch = xmlText.match(/<ErrorDescription>([^<]*)<\/ErrorDescription>/);
    throw new Error(`OT API [${errorCode}]: ${descMatch?.[1] || "Unknown"}`);
  }

  // Parse Value from XML response
  const valueMatch = xmlText.match(/<Value>([^<]+)<\/Value>/);
  return { ErrorCode: errorCode, Result: valueMatch ? { Value: valueMatch[1] } : {} };
}

// ─── Dedicated caller for BatchSimplifiedAddItemsToBasket ────
async function callBatchSimplifiedAdd(allInputParams: Record<string, string>) {
  return callOtApiViaXmlEndpoint("BatchSimplifiedAddItemsToBasket", allInputParams);
}

function buildAddItemXml(itemId: string, quantity: number, configurationId?: string): string {
  const parts = [`<ItemId>${itemId}</ItemId>`, `<Quantity>${quantity}</Quantity>`];
  if (configurationId) parts.push(`<ConfigurationId>${configurationId}</ConfigurationId>`);
  return `<Request><Element>${parts.join("")}</Element></Request>`;
}