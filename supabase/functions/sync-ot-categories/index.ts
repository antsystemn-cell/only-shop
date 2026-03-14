import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OT_API_BASE = "https://otapi.net/service";

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

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractNameByLang(namesBlock: string, lang: string): string | null {
  const regex = new RegExp(`<Name\\s+Language="${lang}"[^>]*>([^<]*)</Name>`, "i");
  const match = namesBlock.match(regex);
  return match && match[1].trim() ? match[1].trim() : null;
}

function extractItemIds(xml: string): string[] {
  const ids: string[] = [];
  const ratingListMatch = xml.match(/<ItemRatingList>([\s\S]*?)<\/ItemRatingList>/);
  if (ratingListMatch) {
    const idRegex = /<Id>([^<]+)<\/Id>/g;
    let m;
    while ((m = idRegex.exec(ratingListMatch[1])) !== null) {
      ids.push(m[1].trim());
    }
  }
  return ids;
}

function parseCategories(
  xml: string,
  parentId: string | null,
  depth: number,
  inheritedProvider: string | null
): ParsedCategory[] {
  const results: ParsedCategory[] = [];
  let pos = 0;
  let displayOrder = 0;

  while (pos < xml.length) {
    const catStart = xml.indexOf("<Category", pos);
    if (catStart === -1) break;

    let nestLevel = 0;
    let i = catStart;
    let catEnd = -1;

    while (i < xml.length) {
      const nextOpen = xml.indexOf("<Category", i + 1);
      const nextClose = xml.indexOf("</Category>", i + 1);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        nestLevel++;
        i = nextOpen;
      } else {
        if (nestLevel === 0) {
          catEnd = nextClose + "</Category>".length;
          break;
        }
        nestLevel--;
        i = nextClose;
      }
    }

    if (catEnd === -1) break;
    const catXml = xml.substring(catStart, catEnd);
    pos = catEnd;

    const openTagEnd = catXml.indexOf(">");
    const openTag = catXml.substring(0, openTagEnd + 1);
    const isParentOnProvider = openTag.includes('IsParentOnProvider="true"');

    const internalId = extractTag(catXml, "InternalId");
    if (!internalId) continue;

    const externalId = extractTag(catXml, "ExternalId");
    const namesMatch = catXml.match(/<Names>([\s\S]*?)<\/Names>/);
    let nameMn: string | null = null, nameEn: string | null = null,
        nameRu: string | null = null, nameZh: string | null = null;

    if (namesMatch) {
      nameMn = extractNameByLang(namesMatch[1], "khk");
      nameEn = extractNameByLang(namesMatch[1], "en");
      nameRu = extractNameByLang(namesMatch[1], "ru");
      nameZh = extractNameByLang(namesMatch[1], "zh-chs");
    }

    const iconUrl = extractTag(catXml, "IconImageUrl");
    let iconClass: string | null = null;
    const metaMatch = catXml.match(/<Item\s+Name="CategoryIconClass"[^>]*>([^<]*)<\/Item>/);
    if (metaMatch && metaMatch[1].trim()) iconClass = metaMatch[1].trim();

    const providerType = extractTag(catXml, "ProviderType") || inheritedProvider;
    const seoAlias = extractTag(catXml, "Alias");

    const childrenMatch = catXml.match(/<Children>([\s\S]*)<\/Children>/);
    const catXmlNoChildren = childrenMatch ? catXml.replace(childrenMatch[0], "") : catXml;
    const itemIds = extractItemIds(catXmlNoChildren);

    results.push({
      internal_id: internalId,
      external_id: externalId,
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

    if (childrenMatch) {
      results.push(...parseCategories(childrenMatch[1], internalId, depth + 1, providerType));
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

    // Fetch categories XML from OTAPI
    const apiUrl = `${OT_API_BASE}/GetRootCategoryInfoList?instanceKey=${OT_API_KEY}&language=khk`;
    console.log("[sync-ot-categories] Fetching from:", apiUrl.replace(OT_API_KEY, "***"));
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`OTAPI returned ${response.status}`);
    const xmlContent = await response.text();
    console.log("[sync-ot-categories] Response length:", xmlContent.length);
    console.log("[sync-ot-categories] Preview:", xmlContent.substring(0, 500));

    // Parse categories
    const categories = parseCategories(xmlContent, null, 0, null);
    console.log("[sync-ot-categories] Parsed:", categories.length, "categories");

    if (categories.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No categories parsed from OTAPI response" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Preserve existing seo_alias and display_order customizations
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

    // Merge: preserve admin customizations
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

    // Detect providers
    const providers = [...new Set(categories.map((c) => c.provider_type).filter(Boolean))];

    return new Response(
      JSON.stringify({
        success: true,
        total_parsed: categories.length,
        total_inserted: inserted,
        providers,
        sample: categories.slice(0, 5).map((c) => ({
          id: c.internal_id,
          name: c.name_mn || c.name_en,
          provider: c.provider_type,
          depth: c.depth,
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
