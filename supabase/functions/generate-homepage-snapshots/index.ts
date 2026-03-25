import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Segment {
  id: string;
  name: string;
  slug: string;
  provider_type: string;
  source_type: string;
  category_ids: string[];
  search_query: string;
  search_order_by: string;
  manual_item_ids: string[];
  item_count: number;
  pool_size: number;
  cache_duration_days: number;
}

interface CardSnapshot {
  id: string;
  title: string;
  imageUrl: string;
  price: number;
  originalPrice?: number;
  currency: string;
  providerType?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || SUPABASE_SERVICE_ROLE_KEY;

  const dbHeaders = {
    "Content-Type": "application/json",
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };

  try {
    const body = await req.json().catch(() => ({}));
    const segmentId = body.segmentId;

    let segmentsUrl = `${SUPABASE_URL}/rest/v1/homepage_segments?is_active=eq.true&order=display_order`;
    if (segmentId) segmentsUrl += `&id=eq.${segmentId}`;

    const segRes = await fetch(segmentsUrl, { headers: dbHeaders });
    const segments: Segment[] = await segRes.json();

    if (!segments.length) {
      return new Response(JSON.stringify({ success: true, message: "No active segments" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ segmentId: string; name: string; itemCount: number; otapiCalls: number }> = [];

    for (const segment of segments) {
      try {
        // Check if valid snapshot exists (skip if force-generating specific segment)
        if (!segmentId) {
          const snapRes = await fetch(
            `${SUPABASE_URL}/rest/v1/homepage_segment_snapshots?segment_id=eq.${segment.id}&expires_at=gt.${new Date().toISOString()}&order=generated_at.desc&limit=1`,
            { headers: dbHeaders }
          );
          const existingSnaps = await snapRes.json();
          if (existingSnaps.length > 0 && existingSnaps[0].item_count > 0) {
            results.push({ segmentId: segment.id, name: segment.name, itemCount: existingSnaps[0].item_count, otapiCalls: 0 });
            continue;
          }
        }

        const { items, otapiCalls } = await generateSegmentItems(segment, SUPABASE_URL, dbHeaders, SUPABASE_ANON_KEY);

        const expiresAt = new Date(Date.now() + segment.cache_duration_days * 24 * 60 * 60 * 1000).toISOString();
        await fetch(`${SUPABASE_URL}/rest/v1/homepage_segment_snapshots`, {
          method: "POST",
          headers: { ...dbHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({
            segment_id: segment.id,
            items: items,
            item_count: items.length,
            expires_at: expiresAt,
            generation_source: segmentId ? "manual" : "scheduled",
            otapi_calls_used: otapiCalls,
          }),
        });

        results.push({ segmentId: segment.id, name: segment.name, itemCount: items.length, otapiCalls });
      } catch (err) {
        console.error(`[generate-homepage-snapshots] Error for segment ${segment.name}:`, err);
        results.push({ segmentId: segment.id, name: segment.name, itemCount: 0, otapiCalls: 0 });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[generate-homepage-snapshots] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Call ot-api proxy for search ────────────────────────────
async function callOtApiProxy(
  supabaseUrl: string,
  anonKey: string,
  action: string,
  params: Record<string, unknown>
): Promise<any> {
  const url = `${supabaseUrl}/functions/v1/ot-api`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ action, params }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ot-api proxy error ${res.status}: ${text}`);
  }
  return res.json();
}

async function fetchPriceConfig(supabaseUrl: string, dbHeaders: Record<string, string>) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/price_config?select=config_key,config_value`,
    { headers: dbHeaders }
  );
  const rows = await res.json();
  const map: Record<string, any> = {};
  for (const r of rows) map[r.config_key] = r.config_value;
  return {
    exchangeRates: map.exchange_rates || { CNY_MNT: 525 },
    providerMarkups: map.provider_markups || { default: 25 },
    priceTiers: map.price_tiers?.tiers || [],
    roundEnabled: map.round_prices?.enabled ?? true,
    roundPrecision: map.round_prices?.precision ?? 0,
  };
}

function calculateMntPrice(
  originalPrice: number,
  currencyCode: string,
  providerType: string | undefined,
  config: any
): number {
  if (!originalPrice || originalPrice <= 0) return 0;
  const rateKey = `${currencyCode}_MNT`;
  const rate = config.exchangeRates[rateKey] || config.exchangeRates.CNY_MNT || 525;
  const baseMnt = originalPrice * rate;
  let markupPct: number | null = null;
  const sortedTiers = [...config.priceTiers].sort((a: any, b: any) => a.min - b.min);
  for (const tier of sortedTiers) {
    const min = tier.min ?? 0;
    const max = tier.max ?? Infinity;
    if (baseMnt >= min && baseMnt <= max) { markupPct = tier.markup_pct; break; }
  }
  if (markupPct === null) {
    const provider = providerType?.toLowerCase() || "default";
    markupPct = config.providerMarkups[provider] ?? config.providerMarkups.default ?? 25;
  }
  const finalPrice = baseMnt * (1 + markupPct / 100);
  if (config.roundEnabled) {
    const precision = config.roundPrecision ?? 0;
    if (precision === 0) return Math.round(finalPrice);
    const factor = Math.pow(10, precision);
    return Math.round(finalPrice / factor) * factor;
  }
  return Math.round(finalPrice);
}

async function generateSegmentItems(
  segment: Segment,
  supabaseUrl: string,
  dbHeaders: Record<string, string>,
  anonKey: string
): Promise<{ items: CardSnapshot[]; otapiCalls: number }> {
  let otapiCalls = 0;

  // Manual segments (wh- items)
  if (segment.source_type === "manual" && segment.manual_item_ids?.length > 0) {
    const items = await fetchManualItems(segment.manual_item_ids, supabaseUrl, dbHeaders);
    return { items, otapiCalls: 0 };
  }

  // Fetch price config for MNT conversion
  const priceConfig = await fetchPriceConfig(supabaseUrl, dbHeaders);

  // Category-based or search-based
  let catIds = segment.category_ids?.length > 0 ? [...segment.category_ids] : [];

  // If no categories but has a search query, use a synthetic "search" category
  if (catIds.length === 0 && segment.search_query) {
    catIds = ["__search__"];
  } else if (catIds.length === 0 && segment.provider_type !== "all") {
    const catRes = await fetch(
      `${supabaseUrl}/rest/v1/ot_categories?provider_type=eq.${segment.provider_type}&is_active=eq.true&parent_internal_id=is.null&order=display_order&limit=4&select=internal_id,external_id`,
      { headers: dbHeaders }
    );
    const cats = await catRes.json();
    catIds = cats.map((c: any) => c.external_id || c.internal_id);
  }

  // Guaranteed minimum items per category (e.g. perfumes otc-1368 must have ≥4)
  const GUARANTEED_MINIMUMS: Record<string, number> = {
    "otc-1368": 4, // Perfumes / Үнэртэй ус
  };

  // Split into manual (otc-*) and searchable categories
  const manualCatIds = catIds.filter(id => id.startsWith("otc-"));
  const searchCatIds = catIds.filter(id => !id.startsWith("otc-")).slice(0, 5);

  const allItems: CardSnapshot[] = [];
  const perCatItems: Record<string, CardSnapshot[]> = {};
  const seen = new Set<string>();

  // ─── Fetch items from manual OT categories (item_ids based) ───
  for (const catId of manualCatIds) {
    perCatItems[catId] = [];
    try {
      // Fetch category's item_ids from DB
      const catRes = await fetch(
        `${supabaseUrl}/rest/v1/ot_categories?internal_id=eq.${catId}&select=item_ids`,
        { headers: dbHeaders }
      );
      const catRows = await catRes.json();
      const itemIds: string[] = catRows?.[0]?.item_ids || [];
      if (itemIds.length === 0) {
        console.log(`[generate-homepage-snapshots] No item_ids for manual cat=${catId}`);
        continue;
      }

      // Also gather child category item_ids for richer pool
      const childRes = await fetch(
        `${supabaseUrl}/rest/v1/ot_categories?parent_internal_id=eq.${catId}&select=item_ids&is_active=eq.true`,
        { headers: dbHeaders }
      );
      const childRows = await childRes.json();
      const allItemIds = new Set(itemIds);
      for (const child of childRows) {
        if (child.item_ids) for (const id of child.item_ids) allItemIds.add(id);
      }

      // Only use pz-/tb-/am-* (OTAPI) items, skip wh-* warehouse items
      const otItemIds = [...allItemIds].filter(id => !id.startsWith("wh-"));

      const minNeeded = GUARANTEED_MINIMUMS[catId] || 4;

      if (otItemIds.length > 0) {
        // Fetch more than needed since many may be stale/NotFound
        const fetchCount = Math.min(minNeeded * 5, otItemIds.length, 24);
        const selectedOtIds = shuffleArray(otItemIds).slice(0, fetchCount);
        // Keep provider prefix (pz-, tb-, am-) — OTAPI requires it for correct routing
        const rawIds = selectedOtIds.map(id => id.trim());

        console.log(`[generate-homepage-snapshots] Manual cat=${catId}: ${otItemIds.length} OT items available, fetching ${rawIds.length}`);

        // Fetch in parallel
        const fetchPromises = rawIds.map(async (rawId) => {
          try {
            const data = await callOtApiProxy(supabaseUrl, anonKey, "getItemFullInfo", {
              itemId: rawId,
              blockList: "Description,Vendor,RootPath,Promotions",
            });
            otapiCalls++;

            if (data?.success === false) return null;

            const item = data?.Result?.Item || data?.Result;
            if (!item || !item.Id) return null;

            const rawOrigPrice = extractRawOriginalPrice(item);
            const currencyCode = item.Price?.OriginalCurrencyCode || item.Price?.PriceWithoutDelivery?.OriginalCurrencyCode || "CNY";
            const mntPrice = calculateMntPrice(rawOrigPrice, currencyCode, segment.provider_type, priceConfig);

            const rawComparePrice = extractRawComparePrice(item);
            const mntOriginalPrice = rawComparePrice > rawOrigPrice
              ? calculateMntPrice(rawComparePrice, currencyCode, segment.provider_type, priceConfig)
              : undefined;

            return {
              id: item.Id,
              title: item.Title || item.ExternalTitle || "",
              imageUrl: item.MainPictureUrl || "",
              price: mntPrice,
              originalPrice: mntOriginalPrice,
              currency: "₮",
              providerType: item.ProviderType || segment.provider_type,
            } as CardSnapshot;
          } catch (e) {
            return null;
          }
        });

        const results = await Promise.all(fetchPromises);
        for (const card of results) {
          if (card && card.price > 0 && card.imageUrl && !seen.has(card.id)) {
            seen.add(card.id);
            allItems.push(card);
            perCatItems[catId].push(card);
          }
        }
      } else {
        console.log(`[generate-homepage-snapshots] Manual cat=${catId}: no OTAPI items found (only wh-* items)`);
      }
      console.log(`[generate-homepage-snapshots] Manual cat=${catId}: got ${perCatItems[catId].length} valid items`);
    } catch (err) {
      console.error(`[generate-homepage-snapshots] Manual cat error ${catId}:`, err);
    }
  }

  // ─── Fetch items from searchable categories (OTAPI search) ───
  for (const catId of searchCatIds) {
    perCatItems[catId] = [];
    try {
      console.log(`[generate-homepage-snapshots] Searching cat=${catId}, provider=${segment.provider_type}`);
      const data = await callOtApiProxy(supabaseUrl, anonKey, "searchItems", {
        categoryId: catId === "__search__" ? undefined : catId,
        provider: segment.provider_type === "all" ? undefined : segment.provider_type,
        page: 0,
        pageSize: Math.min(segment.pool_size, 60),
        orderBy: segment.search_order_by || "Volume:Desc",
        query: segment.search_query || undefined,
      });
      otapiCalls++;

      const rawItems = data?.Result?.Items?.Items;
      const itemsArray = Array.isArray(rawItems) ? rawItems : rawItems?.Content || [];
      console.log(`[generate-homepage-snapshots] Got ${itemsArray.length} items for cat=${catId}`);

      for (const item of itemsArray) {
        if (seen.has(item.Id)) continue;
        if (item.IsAuction || item.IsSoldOut) continue;
        seen.add(item.Id);

        const rawOrigPrice = extractRawOriginalPrice(item);
        const currencyCode = item.Price?.OriginalCurrencyCode || item.Price?.PriceWithoutDelivery?.OriginalCurrencyCode || "CNY";
        const mntPrice = calculateMntPrice(rawOrigPrice, currencyCode, segment.provider_type, priceConfig);

        const rawComparePrice = extractRawComparePrice(item);
        const mntOriginalPrice = rawComparePrice > rawOrigPrice
          ? calculateMntPrice(rawComparePrice, currencyCode, segment.provider_type, priceConfig)
          : undefined;

        const card: CardSnapshot = {
          id: item.Id,
          title: item.Title || item.ExternalTitle || "",
          imageUrl: item.MainPictureUrl || "",
          price: mntPrice,
          originalPrice: mntOriginalPrice,
          currency: "₮",
          providerType: item.ProviderType || segment.provider_type,
        };

        allItems.push(card);
        perCatItems[catId].push(card);
      }
    } catch (err) {
      console.error(`[generate-homepage-snapshots] Search error for cat ${catId}:`, err);
    }
  }

  // Build final list: first reserve guaranteed minimums, then fill rest randomly
  const allCatIds = [...manualCatIds, ...searchCatIds];
  const finalItems: CardSnapshot[] = [];
  const usedIds = new Set<string>();

  for (const catId of allCatIds) {
    const min = GUARANTEED_MINIMUMS[catId];
    if (min && min > 0) {
      const catPool = shuffleArray(perCatItems[catId] || []);
      const reserved = catPool.slice(0, min);
      for (const item of reserved) {
        finalItems.push(item);
        usedIds.add(item.id);
      }
      console.log(`[generate-homepage-snapshots] Reserved ${reserved.length}/${min} guaranteed items for cat=${catId}`);
    }
  }

  // Fill remaining slots from shuffled pool (excluding already reserved)
  const remaining = shuffleArray(allItems.filter(item => !usedIds.has(item.id)));
  const slotsLeft = segment.item_count - finalItems.length;
  finalItems.push(...remaining.slice(0, Math.max(0, slotsLeft)));

  // Shuffle the final list so guaranteed items aren't always first
  const result = shuffleArray(finalItems);
  return { items: result, otapiCalls };
}

async function fetchManualItems(
  itemIds: string[],
  supabaseUrl: string,
  dbHeaders: Record<string, string>
): Promise<CardSnapshot[]> {
  const whIds = itemIds.filter(id => id.startsWith("wh-"));
  const items: CardSnapshot[] = [];

  if (whIds.length > 0) {
    const idsStr = whIds.map(id => `"${id}"`).join(",");
    const res = await fetch(
      `${supabaseUrl}/rest/v1/warehouse_items?item_id=in.(${idsStr})&is_active=eq.true`,
      { headers: dbHeaders }
    );
    const whItems = await res.json();
    for (const wh of whItems) {
      items.push({
        id: wh.item_id,
        title: wh.title || "",
        imageUrl: wh.image_url || "",
        price: Number(wh.price_mnt) || 0,
        originalPrice: wh.original_price_mnt ? Number(wh.original_price_mnt) : undefined,
        currency: "₮",
        providerType: "warehouse",
      });
    }
  }

  return items;
}

// Extract the raw original price in foreign currency (CNY/USD)
function extractRawOriginalPrice(item: any): number {
  const price = item.Price;
  if (!price) return 0;
  // Prefer PromotionPrice (sale price)
  const promo = price.PromotionPrice;
  if (typeof promo === "number" && promo > 0) return promo;
  // Then OriginalPrice
  const orig = price.OriginalPrice;
  if (typeof orig === "number" && orig > 0) return orig;
  const pwod = price.PriceWithoutDelivery?.OriginalPrice;
  if (typeof pwod === "number" && pwod > 0) return pwod;
  const margin = price.MarginPrice;
  if (typeof margin === "number" && margin > 0) return margin;
  return 0;
}

// Extract compare/original price for strikethrough display
function extractRawComparePrice(item: any): number {
  const price = item.Price;
  if (!price) return 0;
  // If there's a promotion, the "original" is the non-promo price
  const orig = price.OriginalPrice;
  if (typeof orig === "number" && orig > 0) return orig;
  return 0;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
