import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OT_API_BASE = "https://otapi.net/service-json";

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
    case "getItemTotalCost":
      return callOtApi("GetItemTotalCost", { ...base, itemId: params.itemId, quantity: params.quantity || "1", ...(params.weight ? { weight: params.weight } : {}) });
    case "batchGetItemTotalCost":
      return callOtApi("BatchGetItemTotalCost", { ...base, xmlParameters: params.xmlParameters });

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
      // Use AddItemToBasket with fieldParameters=<Fields/> per OTAPI docs
      // fieldParameters MUST be included in signature calculation
      return callOtApi("AddItemToBasket", {
        ...base,
        sessionId: params.sessionId,
        itemId: params.itemId,
        configurationId: params.configurationId || "",
        quantity: String(params.quantity || 1),
        fieldParameters: "<Fields/>",
      });
    }
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
    case "batchSimplifiedAddItemsToBasket": {
      const batchXml = params.xmlParameters || params.xmlRequest || "";
      return callBatchSimplifiedAdd({
        instanceKey: apiKey, language: lang, sessionId: params.sessionId, xmlRequest: batchXml,
      });
    }
    case "moveItemsBetweenBasketAndNote":
      return callOtApi("MoveItemsBetweenBasketAndNote", { ...base, sessionId: params.sessionId, orderLineId: params.orderLineId, direction: params.direction || "ToNote" });

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

// ─── Create Order (with XML) ────────────────────────────────

function createOrder(apiKey: string, params: Record<string, any>) {
  const xmlParts: string[] = [];
  if (params.deliveryModeId) xmlParts.push(`<DeliveryModeId>${escapeXml(String(params.deliveryModeId))}</DeliveryModeId>`);
  if (params.profileId) xmlParts.push(`<UserProfileId>${escapeXml(String(params.profileId))}</UserProfileId>`);
  if (params.comment) xmlParts.push(`<Comment>${escapeXml(String(params.comment))}</Comment>`);

  return callOtApi("CreateOrder", {
    instanceKey: apiKey,
    language: params.language || "en",
    sessionId: params.sessionId,
    xmlParameters: `<OrderParameters>${xmlParts.join("")}</OrderParameters>`,
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
    language: params.language || "en",
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
    language: params.language || "en",
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
    language: params.language || "en",
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

async function callOtApi(methodName: string, queryParams: Record<string, string>, postSignatureParams?: Record<string, string>) {
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
  // These params must always be present in URL even when empty (OTAPI contract requirement)
  const alwaysInclude = new Set(["configurationId", "fieldParameters"]);
  for (const [key, value] of Object.entries(allParams)) {
    if (value !== undefined && value !== null && (value !== "" || alwaysInclude.has(key))) {
      url.searchParams.set(key, String(value));
    }
  }

  // postSignatureParams: params that must appear in URL but were excluded from signature
  // (e.g. fieldParameters, configurationId which OTAPI requires even when empty)
  if (postSignatureParams) {
    for (const [key, value] of Object.entries(postSignatureParams)) {
      url.searchParams.set(key, value ?? "");
    }
  }

  // Log full URL for debugging AddItemToBasket
  if (methodName === "AddItemToBasket") {
    console.log("[ot-api] AddItemToBasket full URL:", url.toString());
    console.log("[ot-api] postSignatureParams:", JSON.stringify(postSignatureParams));
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