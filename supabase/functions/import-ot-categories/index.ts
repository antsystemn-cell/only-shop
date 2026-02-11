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
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractAttribute(xml: string, attr: string): string | null {
  const regex = new RegExp(`${attr}="([^"]*)"`, "i");
  const match = xml.match(regex);
  return match ? match[1] : null;
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

  // Find all <Category> blocks at this level (not nested children)
  // We need a smarter approach - find Category tags and track nesting
  let pos = 0;
  let displayOrder = 0;

  while (pos < xml.length) {
    const catStart = xml.indexOf("<Category", pos);
    if (catStart === -1) break;

    // Find the matching closing tag by counting nesting
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

    // Extract the opening tag to check attributes
    const openTagEnd = catXml.indexOf(">");
    const openTag = catXml.substring(0, openTagEnd + 1);
    const isParentOnProvider = openTag.includes('IsParentOnProvider="true"');

    // Extract InternalId
    const internalId = extractTag(catXml, "InternalId");
    if (!internalId) continue;

    // Extract ExternalId
    const externalId = extractTag(catXml, "ExternalId");

    // Extract names
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

    // Extract icon
    const iconUrl = extractTag(catXml, "IconImageUrl");
    
    // Extract icon class from MetaData
    let iconClass: string | null = null;
    const metaMatch = catXml.match(/<Item\s+Name="CategoryIconClass"[^>]*>([^<]*)<\/Item>/);
    if (metaMatch && metaMatch[1].trim()) {
      iconClass = metaMatch[1].trim();
    }

    // Extract provider type
    const providerType = extractTag(catXml, "ProviderType") || inheritedProvider;

    // Extract SEO alias
    const seoAlias = extractTag(catXml, "Alias");

    // Extract item rating list (only from this level, not children)
    // Remove children block first for item extraction
    const childrenMatch = catXml.match(/<Children>([\s\S]*)<\/Children>/);
    const catXmlNoChildren = childrenMatch
      ? catXml.replace(childrenMatch[0], "")
      : catXml;
    const itemIds = extractItemIds(catXmlNoChildren);

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
    };

    results.push(category);

    // Parse children
    if (childrenMatch) {
      const children = parseCategories(
        childrenMatch[1],
        internalId,
        depth + 1,
        providerType
      );
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

    // Get XML from request body
    const { xml_content } = await req.json();
    
    if (!xml_content) {
      throw new Error("xml_content is required");
    }

    console.log("Parsing XML, length:", xml_content.length);

    // Parse the XML
    const categories = parseCategories(xml_content, null, 0, null);
    console.log("Parsed categories count:", categories.length);

    // Clear existing data
    const { error: deleteError } = await supabase
      .from("ot_categories")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all
    
    if (deleteError) {
      console.error("Delete error:", deleteError);
    }

    // Insert in batches of 100
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < categories.length; i += batchSize) {
      const batch = categories.slice(i, i + batchSize);
      const { error } = await supabase
        .from("ot_categories")
        .insert(batch);
      
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
        sample: categories.slice(0, 5).map(c => ({
          id: c.internal_id,
          name: c.name_mn || c.name_en || c.name_ru,
          provider: c.provider_type,
          items: c.item_ids.length,
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
