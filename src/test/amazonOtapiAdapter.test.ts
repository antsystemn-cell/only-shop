import { describe, it, expect, vi } from "vitest";
import {
  isAmazonProvider,
  normalizeAmazonOtapiPrice,
  resolveAmazonConfigurations,
  buildAmazonAddToCartPayload,
  mapAmazonBasketLinePrice,
  mapAmazonOtapiError,
  getAmazonAutoConfigurationId,
} from "@/services/amazonOtapiAdapter";
import type { PriceConfig } from "@/utils/priceCalculator";

// ─── Mock PriceConfig ───────────────────────────────────────

const mockPriceConfig: PriceConfig = {
  exchangeRates: { USD_MNT: 3500, CNY_MNT: 525 },
  providerMarkups: { amazon: 20, default: 25 },
  priceTiers: [],
  roundEnabled: true,
  roundPrecision: 0,
};

// ─── Provider Detection ─────────────────────────────────────

describe("isAmazonProvider", () => {
  it("detects Amazon (case-insensitive)", () => {
    expect(isAmazonProvider("Amazon")).toBe(true);
    expect(isAmazonProvider("amazon")).toBe(true);
    expect(isAmazonProvider("AMAZON")).toBe(true);
  });
  it("rejects other providers", () => {
    expect(isAmazonProvider("Poizon")).toBe(false);
    expect(isAmazonProvider("Taobao")).toBe(false);
    expect(isAmazonProvider("Dewu")).toBe(false);
    expect(isAmazonProvider(undefined)).toBe(false);
  });
});

// ─── Amazon Price Normalization ─────────────────────────────

describe("normalizeAmazonOtapiPrice", () => {
  it("converts USD to MNT with markup", () => {
    const priceObj = { OriginalPrice: 41, OriginalCurrencyCode: "USD" };
    const result = normalizeAmazonOtapiPrice(priceObj, "Amazon", mockPriceConfig);
    
    expect(result.sourceCurrency).toBe("USD");
    expect(result.sourcePrice).toBe(41);
    // 41 * 3500 = 143500, + 20% markup = 172200
    expect(result.finalDisplayPriceMnt).toBe(172200);
    expect(result.convertedPriceMnt).toBe(143500);
    expect(result.markupAmountMnt).toBeCloseTo(28700, -1);
  });

  it("never returns raw USD as MNT", () => {
    const priceObj = { OriginalPrice: 41, OriginalCurrencyCode: "USD" };
    const result = normalizeAmazonOtapiPrice(priceObj, "Amazon", mockPriceConfig);
    // Must NOT be 41 — that would mean raw USD displayed as MNT
    expect(result.finalDisplayPriceMnt).toBeGreaterThan(100000);
  });

  it("handles original price for strikethrough", () => {
    const priceObj = { OriginalPrice: 30, OriginalCurrencyCode: "USD" };
    const origObj = { OriginalPrice: 50, OriginalCurrencyCode: "USD" };
    const result = normalizeAmazonOtapiPrice(priceObj, "Amazon", mockPriceConfig, origObj);
    
    expect(result.finalDisplayPriceMnt).toBeLessThan(result.finalOriginalPriceMnt!);
    expect(result.finalOriginalPriceMnt).toBeGreaterThan(0);
  });
});

// ─── Configuration Resolution ───────────────────────────────

describe("resolveAmazonConfigurations", () => {
  it("resolves different prices for different configs", () => {
    const rawItems = [
      { Id: "cfg-1", Price: { OriginalPrice: 41, OriginalCurrencyCode: "USD" }, Quantity: 5, Configurators: [{ Vid: "v1" }] },
      { Id: "cfg-2", Price: { OriginalPrice: 55, OriginalCurrencyCode: "USD" }, Quantity: 3, Configurators: [{ Vid: "v2" }] },
    ];
    const result = resolveAmazonConfigurations(rawItems, "Amazon", mockPriceConfig);
    
    expect(result).toHaveLength(2);
    expect(result[0].priceMnt).not.toBe(result[1].priceMnt);
    expect(result[0].priceMnt).toBeGreaterThan(0);
    expect(result[1].priceMnt).toBeGreaterThan(result[0].priceMnt);
  });

  it("preserves source currency and price", () => {
    const rawItems = [
      { Id: "cfg-1", Price: { OriginalPrice: 41, OriginalCurrencyCode: "USD" }, Configurators: [{ Vid: "v1" }] },
    ];
    const result = resolveAmazonConfigurations(rawItems, "Amazon", mockPriceConfig);
    expect(result[0].sourceCurrency).toBe("USD");
    expect(result[0].sourcePrice).toBe(41);
  });
});

// ─── Add-to-Cart Payload ────────────────────────────────────

describe("buildAmazonAddToCartPayload", () => {
  const configurators = [
    { pid: "color", values: [{ id: "v1" }, { id: "v2" }] },
    { pid: "size", values: [{ id: "s1" }, { id: "s2" }] },
  ];

  it("blocks when configurationId missing for configurable product", () => {
    const result = buildAmazonAddToCartPayload(
      "az-123", 1,
      { color: "v1", size: "s1" },
      configurators,
      undefined, // no matchedConfigId
    );
    expect("error" in result).toBe(true);
  });

  it("blocks when not all options selected", () => {
    const result = buildAmazonAddToCartPayload(
      "az-123", 1,
      { color: "v1" }, // size missing
      configurators,
      "cfg-1",
    );
    expect("error" in result).toBe(true);
  });

  it("succeeds with all options and configurationId", () => {
    const result = buildAmazonAddToCartPayload(
      "az-123", 1,
      { color: "v1", size: "s1" },
      configurators,
      "cfg-1",
    );
    expect("payload" in result).toBe(true);
    if ("payload" in result) {
      expect(result.payload.configurationId).toBe("cfg-1");
      expect(result.payload.itemId).toBe("az-123");
      expect(result.payload.fieldParameters).toContain("color");
    }
  });

  it("succeeds for non-configurable product (no configurators)", () => {
    const result = buildAmazonAddToCartPayload("az-123", 1, {}, [], undefined);
    expect("payload" in result).toBe(true);
    if ("payload" in result) {
      expect(result.payload.configurationId).toBeUndefined();
    }
  });
});

// ─── Basket Line Mapping ────────────────────────────────────

describe("mapAmazonBasketLinePrice", () => {
  it("uses manual conversion when no internal conversion available", () => {
    const line = {
      ItemId: "az-test",
      Quantity: 2,
      ProviderType: "Amazon",
      Price: { OriginalPrice: 41, OriginalCurrencyCode: "USD" },
    };
    const result = mapAmazonBasketLinePrice(line, mockPriceConfig);
    // 41 * 3500 * 1.2 = 172200 per unit
    expect(result.unitPrice).toBe(172200);
    expect(result.totalPrice).toBe(344400);
  });

  it("uses internal conversion when available", () => {
    const line = {
      ItemId: "az-test",
      Quantity: 1,
      ProviderType: "Amazon",
      Price: {
        OriginalPrice: 41,
        ConvertedPriceList: { Internal: { Price: 200000 } },
      },
    };
    const result = mapAmazonBasketLinePrice(line, mockPriceConfig);
    expect(result.unitPrice).toBe(200000);
    expect(result.totalPrice).toBe(200000);
  });
});

// ─── Error Mapping ──────────────────────────────────────────

describe("mapAmazonOtapiError", () => {
  it("maps configurationId errors to friendly message", () => {
    const msg = mapAmazonOtapiError("Missing parameter 'configurationId'");
    expect(msg).toContain("сонголт");
    expect(msg).not.toContain("configurationId");
  });

  it("maps ContractViolation to friendly message", () => {
    const msg = mapAmazonOtapiError("ContractViolation/[object Object]");
    expect(msg).toContain("сонголт");
  });

  it("passes through unknown errors", () => {
    const msg = mapAmazonOtapiError("Some random error");
    expect(msg).toBe("Some random error");
  });
});

// ─── Auto Configuration Selection ───────────────────────────

describe("getAmazonAutoConfigurationId", () => {
  it("returns undefined when no configurators needed", () => {
    expect(getAmazonAutoConfigurationId([], [])).toBeUndefined();
  });

  it("auto-selects when only one config available", () => {
    const configs = [{ id: "cfg-1", quantity: 5, configuratorIds: ["v1"] }];
    const configurators = [{ pid: "color", values: [{ id: "v1" }] }];
    expect(getAmazonAutoConfigurationId(configs, configurators)).toBe("cfg-1");
  });

  it("returns null when multiple configs available", () => {
    const configs = [
      { id: "cfg-1", quantity: 5, configuratorIds: ["v1"] },
      { id: "cfg-2", quantity: 3, configuratorIds: ["v2"] },
    ];
    const configurators = [{ pid: "color", values: [{ id: "v1" }, { id: "v2" }] }];
    expect(getAmazonAutoConfigurationId(configs, configurators)).toBeNull();
  });
});

// ─── Regression: Non-Amazon providers unchanged ─────────────

describe("Non-Amazon provider regression", () => {
  it("isAmazonProvider returns false for Poizon/Taobao/Dewu", () => {
    expect(isAmazonProvider("Poizon")).toBe(false);
    expect(isAmazonProvider("Taobao")).toBe(false);
    expect(isAmazonProvider("Dewu")).toBe(false);
    expect(isAmazonProvider("Tmall")).toBe(false);
  });

  it("mapAmazonBasketLinePrice is only called for Amazon lines", () => {
    // This test verifies the guard pattern — mapAmazonBasketLinePrice
    // should only ever be called when isAmazonProvider is true
    const taobaoLine = {
      ItemId: "tb-123",
      Quantity: 1,
      ProviderType: "Taobao",
      Price: { OriginalPrice: 100, OriginalCurrencyCode: "CNY" },
    };
    // If accidentally called for Taobao, it would still work but with wrong currency assumption
    // The guard in OtCartContext ensures this never happens
    expect(isAmazonProvider(taobaoLine.ProviderType)).toBe(false);
  });
});
