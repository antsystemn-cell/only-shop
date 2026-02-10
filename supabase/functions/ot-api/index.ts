import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Md5 } from "https://deno.land/std@0.95.0/hash/md5.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OT_API_BASE = "https://otapi.net/service-json";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const OT_API_KEY = Deno.env.get("OT_API_KEY");
  if (!OT_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OT_API_KEY is not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { action, params } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Missing 'action' parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result;
    switch (action) {
      case "getRootCategories":
        result = await getRootCategories(OT_API_KEY, params);
        break;
      case "getSubcategories":
        result = await getSubcategories(OT_API_KEY, params);
        break;
      case "searchItems":
        result = await searchItems(OT_API_KEY, params);
        break;
      case "getItemFullInfo":
        result = await getItemFullInfo(OT_API_KEY, params);
        break;
      case "getItemDescription":
        result = await getItemDescription(OT_API_KEY, params);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("OT API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Core API caller ─────────────────────────────────────────

async function callOtApi(method: string, queryParams: Record<string, string>) {
  const OT_API_SECRET = Deno.env.get("OT_API_SECRET");

  const now = new Date();
  const tsUnix = String(Math.floor(now.getTime() / 1000));
  const ts14 = now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0') +
    String(now.getUTCHours()).padStart(2, '0') +
    String(now.getUTCMinutes()).padStart(2, '0') +
    String(now.getUTCSeconds()).padStart(2, '0');

  if (!OT_API_SECRET) {
    // No secret - call without signature
    const result = await tryFetch(method, queryParams);
    if (result.success) return result.data;
    throw new Error(`OT API Error [${result.errorCode}]: ${result.errorDesc || "Unknown"}`);
  }

  const instanceKey = queryParams.instanceKey;
  
  // All combos with ts14 (since unix gives "Invalid time stamp")
  const combos = [
    // Plain MD5 patterns
    { input: OT_API_SECRET + ts14, name: "MD5(secret+ts14)" },
    { input: ts14 + OT_API_SECRET, name: "MD5(ts14+secret)" },
    { input: instanceKey + OT_API_SECRET + ts14, name: "MD5(key+secret+ts14)" },
    { input: OT_API_SECRET + instanceKey + ts14, name: "MD5(secret+key+ts14)" },
    { input: instanceKey + ts14 + OT_API_SECRET, name: "MD5(key+ts14+secret)" },
    { input: ts14 + instanceKey + OT_API_SECRET, name: "MD5(ts14+key+secret)" },
    { input: OT_API_SECRET + ts14 + instanceKey, name: "MD5(secret+ts14+key)" },
    { input: ts14 + OT_API_SECRET + instanceKey, name: "MD5(ts14+secret+key)" },
    // Just the secret
    { input: OT_API_SECRET, name: "MD5(secret)" },
    // Secret lowercase/uppercase
    { input: OT_API_SECRET.toLowerCase() + ts14, name: "MD5(secret_lower+ts14)" },
    { input: OT_API_SECRET.toUpperCase() + ts14, name: "MD5(secret_upper+ts14)" },
  ];

  for (const combo of combos) {
    const md5 = new Md5();
    md5.update(combo.input);
    const sigParams = { ...queryParams, timestamp: ts14, signature: md5.toString("hex") as string };
    const result = await tryFetch(method, sigParams);
    console.log(`[OT API] ${combo.name}: ${result.success ? '✅ OK' : result.errorCode + ' - ' + (result.errorDesc || '').substring(0, 50)}`);
    if (result.success) return result.data;
  }

  throw new Error("All signature patterns failed. Check OT_API_SECRET value.");

}

interface FetchResult {
  success: boolean;
  data?: unknown;
  errorCode?: string;
  errorDesc?: string;
}

async function tryFetch(method: string, params: Record<string, string>): Promise<FetchResult> {
  const url = new URL(`${OT_API_BASE}/${method}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      return { success: false, errorCode: `HTTP_${response.status}`, errorDesc: text };
    }

    const data = await response.json();

    if (data?.ErrorCode && data.ErrorCode !== "Ok" && data.ErrorCode !== "BatchError") {
      return { 
        success: false, 
        errorCode: data.ErrorCode, 
        errorDesc: data.ErrorDescription || "",
        data 
      };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, errorCode: "FETCH_ERROR", errorDesc: String(err) };
  }
}

// ─── API Methods ──────────────────────────────────────────────

async function getRootCategories(apiKey: string, params: { language?: string }) {
  return await callOtApi("GetRootCategoryInfoList", {
    instanceKey: apiKey,
    language: params?.language || "en",
  });
}

async function getSubcategories(apiKey: string, params: { parentId: string; language?: string }) {
  return await callOtApi("GetCategorySubcategoryInfoList", {
    instanceKey: apiKey,
    language: params?.language || "en",
    parentCategoryId: params.parentId,
  });
}

async function searchItems(
  apiKey: string,
  params: {
    query?: string; categoryId?: string; brandId?: string; vendorId?: string;
    minPrice?: string; maxPrice?: string; page?: number; pageSize?: number;
    orderBy?: string; language?: string; imageUrl?: string;
  }
) {
  const page = params?.page || 0;
  const pageSize = params?.pageSize || 40;

  let xmlParts: string[] = [];
  if (params?.query) xmlParts.push(`<ItemTitle>${escapeXml(params.query)}</ItemTitle>`);
  if (params?.categoryId) xmlParts.push(`<CategoryId>${escapeXml(params.categoryId)}</CategoryId>`);
  if (params?.vendorId) xmlParts.push(`<VendorId>${escapeXml(params.vendorId)}</VendorId>`);
  if (params?.minPrice) xmlParts.push(`<MinPrice>${escapeXml(params.minPrice)}</MinPrice>`);
  if (params?.maxPrice) xmlParts.push(`<MaxPrice>${escapeXml(params.maxPrice)}</MaxPrice>`);
  if (params?.orderBy) xmlParts.push(`<OrderBy>${escapeXml(params.orderBy)}</OrderBy>`);
  if (params?.imageUrl) xmlParts.push(`<ImageUrl>${escapeXml(params.imageUrl)}</ImageUrl>`);

  return await callOtApi("BatchSearchItemsFrame", {
    instanceKey: apiKey,
    language: params?.language || "en",
    framePosition: String(page * pageSize),
    frameSize: String(pageSize),
    blockList: "SubCategories,SearchProperties",
    xmlParameters: `<SearchItemsParameters>${xmlParts.join("")}</SearchItemsParameters>`,
  });
}

async function getItemFullInfo(apiKey: string, params: { itemId: string; language?: string }) {
  return await callOtApi("BatchGetItemFullInfo", {
    instanceKey: apiKey,
    language: params?.language || "en",
    itemId: params.itemId,
    blockList: "Vendor,RootPath,Promotions",
  });
}

async function getItemDescription(apiKey: string, params: { itemId: string; language?: string }) {
  return await callOtApi("GetItemDescription", {
    instanceKey: apiKey,
    language: params?.language || "en",
    itemId: params.itemId,
  });
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
