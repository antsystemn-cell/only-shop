// ─── Amazon-Only OTAPI Adapter Layer ────────────────────────
// All Amazon-specific pricing, configuration, cart, and error handling
// isolated here. Other providers (Poizon, Taobao, Dewu) are NOT touched.

import {
  getPriceConfig,
  calculateMntPrice,
  getOriginalCurrencyCode,
  getOriginalPriceValue,
  type PriceConfig,
} from "@/utils/priceCalculator";

// ─── Debug Logging ──────────────────────────────────────────

const AMAZON_DEBUG = true; // Set false in production

export function amazonLog(context: string, data: Record<string, unknown>) {
  if (!AMAZON_DEBUG) return;
  console.log(`[AmazonAdapter][${context}]`, JSON.stringify(data, null, 0));
}

// ─── Provider Detection ─────────────────────────────────────

export function isAmazonProvider(providerType?: string): boolean {
  return providerType?.toLowerCase() === "amazon";
}

// ─── Amazon Normalized Price Model ──────────────────────────

export interface AmazonNormalizedPrice {
  sourceCurrency: string;       // e.g. "USD"
  sourcePrice: number;          // raw OTAPI value
  sourceOriginalPrice?: number; // raw original (before promo)
  convertedPriceMnt: number;    // after exchange rate conversion
  convertedOriginalPriceMnt?: number;
  markupAmountMnt: number;      // markup portion
  finalDisplayPriceMnt: number; // what the user sees
  finalOriginalPriceMnt?: number; // strikethrough price
}

/**
 * Normalize an OTAPI price object for Amazon products.
 * Returns a fully resolved MNT price with transparent conversion.
 */
export function normalizeAmazonOtapiPrice(
  priceObj: any,
  providerType: string,
  priceConfig: PriceConfig,
  originalPriceObj?: any,
): AmazonNormalizedPrice {
  const sourceCurrency = getOriginalCurrencyCode(priceObj) || "USD";
  const sourcePrice = getOriginalPriceValue(priceObj);
  
  const finalDisplayPriceMnt = calculateMntPrice(sourcePrice, sourceCurrency, providerType, priceConfig);
  
  // Calculate markup portion for transparency
  const rateKey = `${sourceCurrency}_MNT`;
  const rate = priceConfig.exchangeRates[rateKey] || priceConfig.exchangeRates.CNY_MNT || 525;
  const convertedPriceMnt = sourcePrice * rate;
  const markupAmountMnt = finalDisplayPriceMnt - convertedPriceMnt;

  let sourceOriginalPrice: number | undefined;
  let convertedOriginalPriceMnt: number | undefined;
  let finalOriginalPriceMnt: number | undefined;

  if (originalPriceObj) {
    sourceOriginalPrice = getOriginalPriceValue(originalPriceObj);
    if (sourceOriginalPrice > 0 && sourceOriginalPrice > sourcePrice) {
      const origCurrency = getOriginalCurrencyCode(originalPriceObj) || sourceCurrency;
      convertedOriginalPriceMnt = sourceOriginalPrice * (priceConfig.exchangeRates[`${origCurrency}_MNT`] || rate);
      finalOriginalPriceMnt = calculateMntPrice(sourceOriginalPrice, origCurrency, providerType, priceConfig);
    }
  }

  amazonLog("normalizePrice", {
    sourceCurrency,
    sourcePrice,
    convertedPriceMnt: Math.round(convertedPriceMnt),
    markupAmountMnt: Math.round(markupAmountMnt),
    finalDisplayPriceMnt,
  });

  return {
    sourceCurrency,
    sourcePrice,
    sourceOriginalPrice,
    convertedPriceMnt,
    convertedOriginalPriceMnt,
    markupAmountMnt,
    finalDisplayPriceMnt,
    finalOriginalPriceMnt,
  };
}

// ─── Configuration Resolution ───────────────────────────────

export interface AmazonConfiguredItem {
  id: string;                    // configurationId
  quantity?: number;
  priceMnt: number;             // normalized MNT price
  sourcePrice: number;          // raw source price
  sourceCurrency: string;
  imageUrl?: string;
  configuratorIds: string[];    // vid list
}

/**
 * Resolve Amazon configured items with proper MNT pricing.
 * Each configuration gets its own price from the OTAPI data.
 */
export function resolveAmazonConfigurations(
  rawConfiguredItems: any[],
  providerType: string,
  priceConfig: PriceConfig,
): AmazonConfiguredItem[] {
  return rawConfiguredItems.map((ci: any) => {
    const sourcePrice = ci.Price ? getOriginalPriceValue(ci.Price) : 0;
    const sourceCurrency = ci.Price ? (getOriginalCurrencyCode(ci.Price) || "USD") : "USD";
    const priceMnt = sourcePrice > 0
      ? calculateMntPrice(sourcePrice, sourceCurrency, providerType, priceConfig)
      : 0;

    const configuratorIds = (Array.isArray(ci.Configurators)
      ? ci.Configurators
      : ci.Configurators ? [ci.Configurators] : []
    ).map((c: any) => c.Vid);

    amazonLog("resolveConfig", {
      configId: ci.Id,
      sourcePrice,
      sourceCurrency,
      priceMnt,
      configuratorIds,
    });

    return {
      id: ci.Id,
      quantity: ci.Quantity,
      priceMnt,
      sourcePrice,
      sourceCurrency,
      imageUrl: ci.ImageUrl,
      configuratorIds,
    };
  });
}

// ─── Add-to-Cart Payload ────────────────────────────────────

export interface AmazonCartPayload {
  itemId: string;
  quantity: number;
  configurationId?: string;
  fieldParameters: string;
  priceType: string;
}

/**
 * Build an Amazon-specific add-to-cart payload.
 * Validates that configurationId is present when required.
 * Returns null with error message if validation fails.
 */
export function buildAmazonAddToCartPayload(
  itemId: string,
  quantity: number,
  selectedConfigs: Record<string, string>,
  configurators: Array<{ pid: string; values: Array<{ id: string }> }>,
  matchedConfigId?: string,
): { payload: AmazonCartPayload } | { error: string } {
  const hasConfigurators = configurators.length > 0;
  
  if (hasConfigurators) {
    // Check all configurators are selected
    const allSelected = configurators.every((c) => selectedConfigs[c.pid] && selectedConfigs[c.pid] !== "");
    if (!allSelected) {
      return { error: "Бүх хувилбараа сонгоно уу (өнгө, хэмжээ гэх мэт)" };
    }

    // configurationId is required for Amazon configurable products
    if (!matchedConfigId) {
      return { error: "Бүтээгдэхүүний тохиргоог сонгоно уу" };
    }
  }

  // Build fieldParameters XML
  let fieldParameters = "<Fields/>";
  if (hasConfigurators && Object.keys(selectedConfigs).length > 0) {
    const fieldXmlParts = Object.entries(selectedConfigs)
      .filter(([, vid]) => vid)
      .map(([pid, vid]) => `<Field><FieldId>${pid}</FieldId><ValueId>${vid}</ValueId></Field>`)
      .join("");
    if (fieldXmlParts) {
      fieldParameters = `<Fields>${fieldXmlParts}</Fields>`;
    }
  }

  const payload: AmazonCartPayload = {
    itemId,
    quantity,
    fieldParameters,
    priceType: "Default",
  };

  // Only include configurationId when we have one
  if (matchedConfigId) {
    payload.configurationId = matchedConfigId;
  }

  amazonLog("buildCartPayload", {
    itemId,
    quantity,
    configurationId: matchedConfigId || "(none)",
    hasConfigurators,
  });

  return { payload };
}

// ─── Basket Line Mapping ────────────────────────────────────

/**
 * Normalize an Amazon basket line's price from raw OTAPI values to MNT.
 * Only called for Amazon provider items.
 */
export function mapAmazonBasketLinePrice(
  line: any,
  priceConfig: PriceConfig,
): { unitPrice: number; totalPrice: number } {
  const quantity = line.Quantity || 1;

  // For Amazon: NEVER trust OTAPI's "Internal" conversion — it often passes
  // through the raw USD value (e.g. 110) without converting to MNT.
  // Always extract the source price and do manual USD→MNT conversion + markup.

  const rawNumericPrice = typeof line.Price === "number"
    ? line.Price
    : typeof line.Price?.OriginalPrice === "number"
      ? line.Price.OriginalPrice
      : getOriginalPriceValue(line.Price) || 0;

  if (rawNumericPrice <= 0) {
    amazonLog("basketLine:zeroPriceFallback", { itemId: line.ItemId });
    return { unitPrice: 0, totalPrice: 0 };
  }

  const currencyCode = getOriginalCurrencyCode(line.Price)
    || line.Price?.ConvertedPriceList?.Original?.CurrencyCode
    || line.Price?.CurrencyCode
    || "USD";

  const unitPrice = calculateMntPrice(rawNumericPrice, currencyCode, "Amazon", priceConfig);
  const totalPrice = unitPrice * quantity;

  amazonLog("basketLine:manualConversion", {
    itemId: line.ItemId,
    rawPrice: rawNumericPrice,
    currency: currencyCode,
    unitPriceMnt: unitPrice,
    totalPriceMnt: totalPrice,
  });

  return { unitPrice, totalPrice };
}

// ─── Error Mapping ──────────────────────────────────────────

/**
 * Map raw OTAPI error messages to user-friendly Mongolian messages.
 * Only for Amazon-specific errors.
 */
export function mapAmazonOtapiError(errorMessage: string): string {
  const msg = errorMessage.toLowerCase();

  if (msg.includes("configurationid") || msg.includes("configuration")) {
    return "Бүтээгдэхүүний бүх сонголтыг хийнэ үү (хэмжээ, өнгө г.м.)";
  }
  if (msg.includes("contractviolation")) {
    return "Бүтээгдэхүүний сонголт дутуу байна. Бүх шаардлагатай сонголтыг хийнэ үү.";
  }
  if (msg.includes("itemnotfound") || msg.includes("item not found")) {
    return "Энэ Amazon бараа одоогоор боломжгүй байна.";
  }
  if (msg.includes("quantity") || msg.includes("outofstock") || msg.includes("sold out")) {
    return "Энэ Amazon барааны нөөц дууссан байна.";
  }

  // Return original for non-Amazon-specific errors
  return errorMessage;
}

/**
 * Wrap an async operation with Amazon-specific error handling.
 * Non-Amazon errors pass through unchanged.
 */
export async function withAmazonErrorHandling<T>(
  fn: () => Promise<T>,
  providerType?: string,
): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (isAmazonProvider(providerType)) {
      const friendlyMsg = mapAmazonOtapiError(err.message || "");
      amazonLog("error", { original: err.message, friendly: friendlyMsg });
      throw new Error(friendlyMsg);
    }
    throw err;
  }
}

// ─── Auto-Select Single Configuration ───────────────────────

/**
 * For Amazon products: if only one valid configuration exists, return its ID.
 * If multiple exist, return null (user must choose).
 * If none needed, return undefined.
 */
export function getAmazonAutoConfigurationId(
  configuredItems: Array<{ id: string; quantity?: number; configuratorIds: string[] }>,
  configurators: Array<{ pid: string; values: Array<{ id: string }> }>,
): string | null | undefined {
  // No configured items at all → no configuration needed
  if (!configuredItems.length) return undefined;
  
  // Filter to available configurations (quantity > 0 or undefined)
  const available = configuredItems.filter(
    (ci) => ci.quantity === undefined || ci.quantity > 0
  );

  // No configurators in UI but configuredItems exist → auto-select if only one available
  if (!configurators.length) {
    if (available.length >= 1) {
      amazonLog("autoConfig:noConfigurators", { autoSelectedId: available[0].id, totalAvailable: available.length });
      return available[0].id;
    }
    return undefined;
  }

  if (available.length === 1) {
    amazonLog("autoConfig", { autoSelectedId: available[0].id });
    return available[0].id;
  }

  // Multiple available → user must choose
  return null;
}
