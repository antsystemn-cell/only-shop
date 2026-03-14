import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OT_API_BASE = "https://otapi.net/service-json";

// ─── Signature ──────────────────────────────────────────────
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
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

async function callOtApi(methodName: string, queryParams: Record<string, string>) {
  const OT_API_SECRET = Deno.env.get("OT_API_SECRET");
  const timestamp = getTimestamp();
  const allParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null && value !== "") allParams[key] = value;
  }
  allParams.timestamp = timestamp;

  if (OT_API_SECRET) {
    const sortedKeys = Object.keys(allParams).sort();
    const concatenatedValues = sortedKeys.map((k) => allParams[k]).join("");
    const sigInput = methodName + concatenatedValues + OT_API_SECRET;
    allParams.signature = await sha256Hex(sigInput);
  }

  const url = new URL(`${OT_API_BASE}/${methodName}`);
  for (const [key, value] of Object.entries(allParams)) url.searchParams.set(key, value);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(30000) });
  return await res.json();
}

// ─── Category Parsing (from JSON response) ──────────────────
interface ParsedCategory {
  internal_id: string;
  external_id: string | null;
  parent_internal_id: string | null;
  name_mn: string | null;
  name_en: string | null;
  name_ru: string | null;
  name_zh: string | null;
  icon_url: string | null;
  icon_class: string | null;
  provider_type: string | null;
  seo_alias: string | null;
  item_ids: string[];
  is_parent_on_provider: boolean;
  depth: number;
  display_order: number;
}

function ensureArray(val: unknown): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

function extractName(names: any, lang: string): string | null {
  if (!names) return null;
  const arr = ensureArray(names.Name || names);
  for (const n of arr) {
    if (typeof n === "object" && n.Language === lang && n.Value) return n.Value;
    if (typeof n === "string") return n;
  }
  return null;
}

function parseCategoriesJson(
  cats: any[],
  parentId: string | null,
  depth: number,
  inheritedProvider: string | null
): ParsedCategory[] {
  const results: ParsedCategory[] = [];
  let displayOrder = 0;

  for (const cat of cats) {
    const internalId = cat.InternalId || cat.Id?.Value || cat.Id;
    if (!internalId) continue;

    const externalId = cat.ExternalId || null;
    
    // Name can be a flat string (when language param used) or Names object
    const names = cat.Names;
    let nameMn = extractName(names, "khk");
    let nameEn = extractName(names, "en");
    let nameRu = extractName(names, "ru");
    let nameZh = extractName(names, "zh-chs");
    
    // If flat Name string (language=khk returns translated name directly)
    if (!nameMn && !nameEn && cat.Name && typeof cat.Name === "string") {
      nameMn = cat.Name;
    }

    const iconUrl = cat.IconImageUrl || cat.IconUrl || null;
    // MetaData can be { Item: [...] } or { Items: { Item: [...] } }
    const metaItems = cat.MetaData?.Item || cat.MetaData?.Items?.Item || [];
    const iconClass = ensureArray(metaItems).find((i: any) => i.Name === "CategoryIconClass")?.Value || null;

    const providerType = cat.ProviderType || inheritedProvider;
    const seoAlias = cat.Alias || cat.SeoAlias || null;
    const isParentOnProvider = cat.IsParentOnProvider === true || cat.IsParent === true;

    // Extract item IDs from rating list
    const itemIds: string[] = [];
    const ratingList = cat.ItemRatingList?.Content?.Item || cat.ItemRatingList?.Items || [];
    for (const item of ensureArray(ratingList)) {
      const id = typeof item === "string" ? item : item?.Id?.Value || item?.Id || item?.Value;
      if (id) itemIds.push(String(id));
    }

    results.push({
      internal_id: String(internalId),
      external_id: externalId ? String(externalId) : null,
      parent_internal_id: parentId,
      name_mn: nameMn,
      name_en: nameEn,
      name_ru: nameRu,
      name_zh: nameZh,
      icon_url: iconUrl,
      icon_class: iconClass,
      provider_type: providerType,
      seo_alias: seoAlias,
      item_ids: itemIds,
      is_parent_on_provider: isParentOnProvider,
      depth,
      display_order: displayOrder++,
    });

    // Parse children
    const children = cat.Children?.Content?.Item || cat.Children?.Items || cat.ChildCategories || [];
    const childArr = ensureArray(children);
    if (childArr.length > 0) {
      results.push(...parseCategoriesJson(childArr, String(internalId), depth + 1, providerType));
    }
  }

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OT_API_KEY = Deno.env.get("OT_API_KEY");
    if (!OT_API_KEY) throw new Error("OT_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch categories from OTAPI using signed JSON API
    console.log("[sync-ot-categories] Fetching from OTAPI...");
    const response = await callOtApi("GetRootCategoryInfoList", {
      instanceKey: OT_API_KEY,
      language: "khk",
    });

    console.log("[sync-ot-categories] OTAPI response keys:", Object.keys(response));

    // Handle error
    if (response.ErrorCode && response.ErrorCode !== "Ok") {
      throw new Error(`OTAPI Error: ${response.ErrorCode} - ${response.ErrorDescription}`);
    }

    // Extract category list from response - OTAPI returns CategoryInfoList at top level
    const content = response.CategoryInfoList?.Content?.Item
      || response.CategoryInfoList?.Items
      || response.CategoryInfoList?.Content
      || response.Result?.Content?.Item
      || response.Result?.Items
      || ensureArray(response.Result?.Content)
      || [];

    console.log("[sync-ot-categories] CategoryInfoList keys:", response.CategoryInfoList ? Object.keys(response.CategoryInfoList) : "N/A");
    if (response.CategoryInfoList?.Content) {
      console.log("[sync-ot-categories] Content keys:", Object.keys(response.CategoryInfoList.Content));
      console.log("[sync-ot-categories] Content sample:", JSON.stringify(response.CategoryInfoList.Content).substring(0, 500));
    }

    const catArray = ensureArray(content);
    console.log("[sync-ot-categories] Root categories found:", catArray.length);
    if (catArray.length > 0) {
      console.log("[sync-ot-categories] First cat sample:", JSON.stringify(catArray[0]).substring(0, 300));
    }

    // Parse categories recursively
    const categories = parseCategoriesJson(catArray, null, 0, null);
    console.log("[sync-ot-categories] Total parsed:", categories.length);

    if (categories.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No categories parsed from OTAPI response",
          debug: { responseKeys: Object.keys(response), resultKeys: response.Result ? Object.keys(response.Result) : [] },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Preserve existing admin customizations
    const { data: existingCats } = await supabase
      .from("ot_categories")
      .select("internal_id, seo_alias, display_order, icon_url, is_active");

    const existingMap = new Map<string, { seo_alias: string | null; display_order: number | null; icon_url: string | null; is_active: boolean }>();
    for (const ec of existingCats || []) {
      existingMap.set(ec.internal_id, {
        seo_alias: ec.seo_alias,
        display_order: ec.display_order,
        icon_url: ec.icon_url,
        is_active: ec.is_active ?? true,
      });
    }

    const mergedCategories = categories.map((cat) => {
      const existing = existingMap.get(cat.internal_id);
      if (existing) {
        return {
          ...cat,
          seo_alias: existing.seo_alias || cat.seo_alias,
          display_order: existing.display_order ?? cat.display_order,
          icon_url: existing.icon_url || cat.icon_url,
          is_active: existing.is_active,
        };
      }
      return { ...cat, is_active: true };
    });

    // Clear and re-insert
    await supabase.from("ot_categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const batchSize = 100;
    let inserted = 0;
    for (let i = 0; i < mergedCategories.length; i += batchSize) {
      const batch = mergedCategories.slice(i, i + batchSize);
      const { error } = await supabase.from("ot_categories").insert(batch);
      if (error) {
        console.error(`Batch ${i} error:`, error);
        throw error;
      }
      inserted += batch.length;
    }

    const providers = [...new Set(categories.map((c) => c.provider_type).filter(Boolean))];

    return new Response(
      JSON.stringify({
        success: true,
        total_parsed: categories.length,
        total_inserted: inserted,
        providers,
        sample: categories.filter((c) => c.depth === 0).slice(0, 10).map((c) => ({
          id: c.internal_id,
          name: c.name_mn || c.name_en,
          provider: c.provider_type,
          children: categories.filter((ch) => ch.parent_internal_id === c.internal_id).length,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[sync-ot-categories] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
