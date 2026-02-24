import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────

interface PriceTier {
  min: number;
  max: number | null;
  markup_pct: number;
}

export interface PriceConfig {
  exchangeRates: Record<string, number>; // e.g. { CNY_MNT: 525, USD_MNT: 3570 }
  providerMarkups: Record<string, number>; // e.g. { poizon: 25, taobao: 25, default: 25 }
  priceTiers: PriceTier[];
  roundEnabled: boolean;
  roundPrecision: number;
}

// ─── Cache ───────────────────────────────────────────────────

let cachedConfig: PriceConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getPriceConfig(): Promise<PriceConfig> {
  const now = Date.now();
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL) {
    return cachedConfig;
  }

  const { data, error } = await supabase
    .from("price_config")
    .select("config_key, config_value");

  if (error) {
    console.error("Failed to fetch price config:", error);
    // Return sensible defaults
    return {
      exchangeRates: { CNY_MNT: 525, USD_MNT: 3570 },
      providerMarkups: { default: 25 },
      priceTiers: [],
      roundEnabled: true,
      roundPrecision: 0,
    };
  }

  const configMap: Record<string, any> = {};
  for (const row of data || []) {
    configMap[row.config_key] = row.config_value;
  }

  cachedConfig = {
    exchangeRates: configMap.exchange_rates || { CNY_MNT: 525 },
    providerMarkups: configMap.provider_markups || { default: 25 },
    priceTiers: configMap.price_tiers?.tiers || [],
    roundEnabled: configMap.round_prices?.enabled ?? true,
    roundPrecision: configMap.round_prices?.precision ?? 0,
  };
  cacheTimestamp = now;

  return cachedConfig;
}

// ─── Price Calculation ───────────────────────────────────────

/**
 * Calculate final MNT price from an original price in foreign currency.
 *
 * Steps:
 * 1. Convert to MNT using admin exchange rate
 * 2. Find matching price tier and apply its markup
 * 3. If no tier matches, apply provider-specific markup
 * 4. Round if enabled
 */
export function calculateMntPrice(
  originalPrice: number,
  currencyCode: string,
  providerType: string | undefined,
  config: PriceConfig
): number {
  if (!originalPrice || originalPrice <= 0) return 0;

  // Step 1: Convert to base MNT
  const rateKey = `${currencyCode}_MNT`;
  const rate = config.exchangeRates[rateKey] || config.exchangeRates.CNY_MNT || 525;
  const baseMnt = originalPrice * rate;

  // Step 2: Find matching price tier
  let markupPct: number | null = null;
  const sortedTiers = [...config.priceTiers].sort((a, b) => a.min - b.min);
  for (const tier of sortedTiers) {
    const min = tier.min ?? 0;
    const max = tier.max ?? Infinity;
    if (baseMnt >= min && baseMnt <= max) {
      markupPct = tier.markup_pct;
      break;
    }
  }

  // Step 3: Fallback to provider markup if no tier matched
  if (markupPct === null) {
    const provider = providerType?.toLowerCase() || "default";
    markupPct = config.providerMarkups[provider] ?? config.providerMarkups.default ?? 25;
  }

  const finalPrice = baseMnt * (1 + markupPct / 100);

  // Step 4: Round
  if (config.roundEnabled) {
    const precision = config.roundPrecision ?? 0;
    if (precision === 0) {
      return Math.round(finalPrice);
    }
    const factor = Math.pow(10, precision);
    return Math.round(finalPrice / factor) * factor;
  }

  return Math.round(finalPrice); // always round to whole MNT at minimum
}

/**
 * Extract original currency code from OT API price object.
 */
export function getOriginalCurrencyCode(priceObj: any): string {
  return priceObj?.OriginalCurrencyCode || "CNY";
}

/**
 * Extract original price value (in foreign currency, NOT converted).
 */
export function getOriginalPriceValue(priceObj: any): number {
  return priceObj?.OriginalPrice ?? priceObj?.MarginPrice ?? 0;
}
