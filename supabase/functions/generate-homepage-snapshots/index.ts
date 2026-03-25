import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OT_API_BASE = "https://otapi.net/service-json";

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
  providerLabel?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OT_API_KEY = Deno.env.get("OT_API_KEY");

  const authHeaders = {
    "Content-Type": "application/json",
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };

  try {
    const body = await req.json().catch(() => ({}));
    const segmentId = body.segmentId; // optional: generate only one segment

    // Fetch active segments
    let segmentsUrl = `${SUPABASE_URL}/rest/v1/homepage_segments?is_active=eq.true&order=display_order`;
    if (segmentId) segmentsUrl += `&id=eq.${segmentId}`;

    const segRes = await fetch(segmentsUrl, { headers: authHeaders });
    const segments: Segment[] = await segRes.json();

    if (!segments.length) {
      return new Response(JSON.stringify({ success: true, message: "No active segments" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ segmentId: string; name: string; itemCount: number; otapiCalls: number }> = [];

    for (const segment of segments) {
      try {
        // Check if valid snapshot exists
        if (!segmentId) {
          const snapRes = await fetch(
            `${SUPABASE_URL}/rest/v1/homepage_segment_snapshots?segment_id=eq.${segment.id}&expires_at=gt.${new Date().toISOString()}&order=generated_at.desc&limit=1`,
            { headers: authHeaders }
          );
          const existingSnaps = await snapRes.json();
          if (existingSnaps.length > 0) {
            results.push({ segmentId: segment.id, name: segment.name, itemCount: existingSnaps[0].item_count, otapiCalls: 0 });
            continue; // Still valid, skip
          }
        }

        const { items, otapiCalls } = await generateSegmentItems(segment, OT_API_KEY, SUPABASE_URL, authHeaders);

        // Save snapshot
        const expiresAt = new Date(Date.now() + segment.cache_duration_days * 24 * 60 * 60 * 1000).toISOString();
        await fetch(`${SUPABASE_URL}/rest/v1/homepage_segment_snapshots`, {
          method: "POST",
          headers: { ...authHeaders, Prefer: "return=minimal" },
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

async function generateSegmentItems(
  segment: Segment,
  otApiKey: string | undefined,
  supabaseUrl: string,
  authHeaders: Record<string, string>
): Promise<{ items: CardSnapshot[]; otapiCalls: number }> {
  let otapiCalls = 0;

  // Manual segments: fetch from warehouse_items or ot_categories item_ids
  if (segment.source_type === "manual" && segment.manual_item_ids.length > 0) {
    const items = await fetchManualItems(segment.manual_item_ids, supabaseUrl, authHeaders);
    return { items, otapiCalls: 0 };
  }

  if (!otApiKey) return { items: [], otapiCalls: 0 };

  // Category-based or search-based: use OTAPI searchItems
  const catIds = segment.category_ids.length > 0 ? segment.category_ids : [];

  // If category-based, first resolve category IDs from DB if empty
  let resolvedCatIds = catIds;
  if (resolvedCatIds.length === 0 && segment.provider_type !== "all") {
    const catRes = await fetch(
      `${supabaseUrl}/rest/v1/ot_categories?provider_type=eq.${segment.provider_type}&is_active=eq.true&parent_internal_id=is.null&order=display_order&limit=4&select=internal_id,external_id`,
      { headers: authHeaders }
    );
    const cats = await catRes.json();
    resolvedCatIds = cats.map((c: any) => c.external_id || c.internal_id);
  }

  // Search across categories to build a pool
  const allItems: CardSnapshot[] = [];
  const seen = new Set<string>();

  // Limit to 2-3 categories to control cost
  const searchCatIds = resolvedCatIds.slice(0, 3);

  for (const catId of searchCatIds) {
    try {
      const searchResult = await callOtApiSearch(otApiKey, {
        categoryId: catId,
        provider: segment.provider_type === "all" ? undefined : segment.provider_type,
        pageSize: Math.min(segment.pool_size, 60),
        orderBy: segment.search_order_by || "Volume:Desc",
        query: segment.search_query || undefined,
      });
      otapiCalls++;

      const rawItems = searchResult?.Result?.Items?.Items;
      const itemsArray = Array.isArray(rawItems) ? rawItems : rawItems?.Content || [];

      for (const item of itemsArray) {
        if (seen.has(item.Id)) continue;
        if (item.IsAuction || item.IsSoldOut) continue;
        seen.add(item.Id);

        const card: CardSnapshot = {
          id: item.Id,
          title: item.Title || item.ExternalTitle || "",
          imageUrl: item.MainPictureUrl || "",
          price: extractPrice(item),
          originalPrice: extractOriginalPrice(item),
          currency: "¥",
          providerType: item.ProviderType || segment.provider_type,
        };
        allItems.push(card);
      }
    } catch (err) {
      console.error(`[generate-homepage-snapshots] Search error for cat ${catId}:`, err);
    }
  }

  // Also fetch from DB item_ids for guaranteed categories
  if (segment.category_ids.length > 0) {
    const catIdsStr = segment.category_ids.map(id => `"${id}"`).join(",");
    try {
      const itemIdsRes = await fetch(
        `${supabaseUrl}/rest/v1/ot_categories?internal_id=in.(${catIdsStr})&select=internal_id,item_ids`,
        { headers: authHeaders }
      );
      const catRows = await itemIdsRes.json();
      for (const row of catRows) {
        if (row.item_ids?.length > 0) {
          const dbItems = await fetchOtItemsByIds(otApiKey, row.item_ids.slice(0, 10));
          otapiCalls++;
          for (const item of dbItems) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              allItems.push(item);
            }
          }
        }
      }
    } catch (e) {
      console.error("[generate-homepage-snapshots] DB item_ids fetch error:", e);
    }
  }

  // Shuffle and pick final set
  const shuffled = shuffleArray(allItems);
  const finalItems = shuffled.slice(0, segment.item_count);

  return { items: finalItems, otapiCalls };
}

async function fetchManualItems(
  itemIds: string[],
  supabaseUrl: string,
  authHeaders: Record<string, string>
): Promise<CardSnapshot[]> {
  // Check warehouse items
  const whIds = itemIds.filter(id => id.startsWith("wh-"));
  const items: CardSnapshot[] = [];

  if (whIds.length > 0) {
    const idsStr = whIds.map(id => `"${id}"`).join(",");
    const res = await fetch(
      `${supabaseUrl}/rest/v1/warehouse_items?item_id=in.(${idsStr})&is_active=eq.true`,
      { headers: authHeaders }
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

async function callOtApiSearch(
  apiKey: string,
  params: { categoryId?: string; provider?: string; pageSize: number; orderBy: string; query?: string }
): Promise<any> {
  const lang = "khk";
  const xmlParts: string[] = [];
  if (params.provider) xmlParts.push(`<Provider>${params.provider}</Provider>`);
  if (params.query) xmlParts.push(`<ItemTitle>${escapeXml(params.query)}</ItemTitle>`);
  if (params.categoryId) xmlParts.push(`<CategoryId>${escapeXml(params.categoryId)}</CategoryId>`);
  if (params.orderBy) xmlParts.push(`<OrderBy>${escapeXml(params.orderBy)}</OrderBy>`);
  const xmlSearch = `<SearchItemsParameters>${xmlParts.join("")}</SearchItemsParameters>`;

  const urlParams = new URLSearchParams({
    instanceKey: apiKey,
    language: lang,
    xmlParameters: xmlSearch,
    framePosition: "0",
    frameSize: String(params.pageSize),
    blockList: "",
  });

  const url = `${OT_API_BASE}/BatchSearchItemsFrame?${urlParams.toString()}`;
  console.log(`[generate-homepage-snapshots] Calling OTAPI: cat=${params.categoryId}, provider=${params.provider}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OTAPI search failed: ${res.status}`);
  const json = await res.json();
  
  if (json?.ErrorCode && json.ErrorCode !== "Ok") {
    console.error(`[generate-homepage-snapshots] OTAPI error:`, json.ErrorCode, json.ErrorDescription);
  } else {
    const rawItems = json?.Result?.Items?.Items;
    const itemsArray = Array.isArray(rawItems) ? rawItems : rawItems?.Content || [];
    console.log(`[generate-homepage-snapshots] Got ${itemsArray.length} items for cat=${params.categoryId}`);
  }
  return json;
}

async function fetchOtItemsByIds(apiKey: string, itemIds: string[]): Promise<CardSnapshot[]> {
  if (!itemIds.length) return [];
  const idsParam = itemIds.join(",");
  const urlParams = new URLSearchParams({
    instanceKey: apiKey,
    language: "khk",
    itemId: idsParam,
    blockList: "",
  });
  try {
    const url = `${OT_API_BASE}/BatchGetItemFullInfo?${urlParams.toString()}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const rawItems = data?.Result?.Items;
    const itemsArray = Array.isArray(rawItems) ? rawItems : rawItems?.Content || [];
    return itemsArray.map((wrapper: any) => {
      const item = wrapper?.Item || wrapper;
      return {
        id: item.Id || "",
        title: item.Title || item.ExternalTitle || "",
        imageUrl: item.MainPictureUrl || "",
        price: extractPrice(item),
        originalPrice: extractOriginalPrice(item),
        currency: "¥",
        providerType: item.ProviderType,
      };
    }).filter((c: CardSnapshot) => c.id && c.imageUrl);
  } catch {
    return [];
  }
}

function extractPrice(item: any): number {
  const price = item.Price;
  if (!price) return 0;
  if (typeof price === "number") return price;
  if (price.ConvertedPriceList?.Internal?.Price) return Number(price.ConvertedPriceList.Internal.Price) || 0;
  if (price.OriginalPrice) return Number(price.OriginalPrice) || 0;
  if (price.MarginPrice) return Number(price.MarginPrice) || 0;
  return 0;
}

function extractOriginalPrice(item: any): number | undefined {
  const op = item.OriginalPrice;
  if (!op) return undefined;
  if (typeof op === "number") return op;
  if (op.OriginalPrice) return Number(op.OriginalPrice) || undefined;
  return undefined;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
