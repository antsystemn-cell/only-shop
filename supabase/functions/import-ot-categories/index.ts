import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  source_type: string;
  is_active: boolean;
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

/**
 * Determines if a category is an official OTAPI provider category or manually curated.
 * Official = has a real external_id (not "0") AND a provider_type with is_parent_on_provider.
 * Manual = curated collection with item_ids but no real provider category mapping.
 */
function classifyCategory(cat: {
  external_id: string | null;
  provider_type: string | null;
  is_parent_on_provider: boolean;
  item_ids: string[];
  depth: number;
}): { source_type: string; is_active: boolean } {
  // Root provider nodes (like Poizon root, Taobao root) are official
  if (cat.is_parent_on_provider && cat.provider_type) {
    return { source_type: "otapi-provider", is_active: true };
  }
  // Categories with a real external_id (not "0" or null) and provider are official
  const hasRealExternalId = cat.external_id && cat.external_id !== "0" && cat.external_id !== "";
  if (hasRealExternalId && cat.provider_type) {
    return { source_type: "otapi-provider", is_active: true };
  }
  // Categories with item_ids but no real external_id are manual curated collections
  // They should be hidden from public by default
  if (cat.item_ids.length > 0 && !hasRealExternalId) {
    return { source_type: "manual", is_active: false };
  }
  // Categories without external_id and without items, no provider - manual/placeholder
  if (!hasRealExternalId && !cat.provider_type) {
    return { source_type: "manual", is_active: false };
  }
  // Default: official
  return { source_type: "otapi-provider", is_active: true };
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
    let nameMn: string | null = null;
    let nameEn: string | null = null;
    let nameRu: string | null = null;
    let nameZh: string | null = null;

    if (namesMatch) {
      nameMn = extractNameByLang(namesMatch[1], "khk");
      nameEn = extractNameByLang(namesMatch[1], "en");
      nameRu = extractNameByLang(namesMatch[1], "ru");
      nameZh = extractNameByLang(namesMatch[1], "zh-chs");
    }

    const iconUrl = extractTag(catXml, "IconImageUrl");

    let iconClass: string | null = null;
    const metaMatch = catXml.match(/<Item\s+Name="CategoryIconClass"[^>]*>([^<]*)<\/Item>/);
    if (metaMatch && metaMatch[1].trim()) {
      iconClass = metaMatch[1].trim();
    }

    const providerType = extractTag(catXml, "ProviderType") || inheritedProvider;
    const seoAlias = extractTag(catXml, "Alias");

    // Extract item_ids from this level only (not children)
    const childrenMatch = catXml.match(/<Children>([\s\S]*)<\/Children>/);
    const catXmlNoChildren = childrenMatch ? catXml.replace(childrenMatch[0], "") : catXml;
    const itemIds = extractItemIds(catXmlNoChildren);

    // Classify source_type and default visibility
    const { source_type, is_active } = classifyCategory({
      external_id: externalId,
      provider_type: providerType,
      is_parent_on_provider: isParentOnProvider,
      item_ids: itemIds,
      depth,
    });

    const category: ParsedCategory = {
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
      source_type,
      is_active,
    };

    results.push(category);

    if (childrenMatch) {
      const children = parseCategories(childrenMatch[1], internalId, depth + 1, providerType);
      results.push(...children);
    }
  }

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    let xmlContent = body.xml_content;

    // Support fetching XML from a URL
    if (!xmlContent && body.fetch_url) {
      console.log("Fetching XML from URL:", body.fetch_url);
      const resp = await fetch(body.fetch_url);
      if (!resp.ok) throw new Error(`Failed to fetch XML: ${resp.status}`);
      xmlContent = await resp.text();
    }

    if (!xmlContent) {
      throw new Error("xml_content or fetch_url is required");
    }

    console.log("Parsing XML, length:", xmlContent.length);

    const categories = parseCategories(xmlContent, null, 0, null);
    console.log("Parsed categories count:", categories.length);

    const manualCount = categories.filter(c => c.source_type === "manual").length;
    const officialCount = categories.filter(c => c.source_type === "otapi-provider").length;
    const withItems = categories.filter(c => c.item_ids.length > 0).length;
    const withSeo = categories.filter(c => c.seo_alias).length;
    console.log(`Classification: ${officialCount} official, ${manualCount} manual, ${withItems} with items, ${withSeo} with SEO alias`);

    // Merge mode (default): update existing categories with XML data (item_ids, seo_alias, source_type)
    // without deleting categories not in XML (like Amazon from OTAPI sync).
    // Full replace mode: delete all then insert (use merge=false).
    const mergeMode = body.merge !== false;

    if (mergeMode) {
      console.log("MERGE mode: overlaying XML data (item_ids, seo_alias, source_type) onto existing DB");
      
      // Only process categories with item_ids or manual source_type (the critical overlay data)
      const overlays = categories.filter(c => c.item_ids.length > 0 || c.source_type === "manual");
      console.log(`Processing ${overlays.length} categories with item/manual overlay data`);
      
      let updated = 0;
      let notFound = 0;

      // Process in small batches to avoid timeout
      for (const cat of overlays) {
        const updatePayload: Record<string, unknown> = {};
        if (cat.item_ids.length > 0) updatePayload.item_ids = cat.item_ids;
        if (cat.seo_alias) updatePayload.seo_alias = cat.seo_alias;
        if (cat.name_mn) updatePayload.name_mn = cat.name_mn;
        updatePayload.source_type = cat.source_type;
        if (cat.source_type === "manual") updatePayload.is_active = false;

        const { data, error } = await supabase
          .from("ot_categories")
          .update(updatePayload)
          .eq("internal_id", cat.internal_id)
          .select("id");

        if (data && data.length > 0) {
          updated++;
        } else {
          notFound++;
          console.log(`Not found: ${cat.internal_id} (${cat.name_mn})`);
        }
      }

      // Batch update SEO aliases for all categories that have them
      const seoCategories = categories.filter(c => c.seo_alias && !overlays.some(o => o.internal_id === c.internal_id));
      let seoUpdated = 0;
      // Process in batches of 20 for speed
      for (let i = 0; i < seoCategories.length; i += 20) {
        const batch = seoCategories.slice(i, i + 20);
        await Promise.all(batch.map(cat =>
          supabase.from("ot_categories").update({ seo_alias: cat.seo_alias }).eq("internal_id", cat.internal_id)
        ));
        seoUpdated += batch.length;
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode: "merge",
          total_parsed: categories.length,
          overlays_processed: overlays.length,
          updated,
          not_found: notFound,
          seo_updates: seoOnly.length,
          manual_count: manualCount,
          with_items: withItems,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Full replace mode
    console.log("FULL REPLACE mode: deleting all and re-inserting");
    const { error: deleteError } = await supabase
      .from("ot_categories")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (deleteError) {
      console.error("Delete error:", deleteError);
    }

    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < categories.length; i += batchSize) {
      const batch = categories.slice(i, i + batchSize);
      const { error } = await supabase.from("ot_categories").insert(batch);
      if (error) {
        console.error(`Batch ${i} error:`, error);
        throw error;
      }
      inserted += batch.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_parsed: categories.length,
        total_inserted: inserted,
        official_count: officialCount,
        manual_count: manualCount,
        with_items: withItems,
        with_seo: withSeo,
        sample: categories.slice(0, 5).map(c => ({
          id: c.internal_id,
          name: c.name_mn || c.name_en || c.name_ru,
          provider: c.provider_type,
          items: c.item_ids.length,
          source: c.source_type,
          active: c.is_active,
          depth: c.depth,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
