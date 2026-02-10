import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

// ─── Signature helper ────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

// ─── Core API caller ─────────────────────────────────────────

async function callOtApi(methodName: string, queryParams: Record<string, string>) {
  const OT_API_SECRET = Deno.env.get("OT_API_SECRET");
  const timestamp = getTimestamp();

  // Add timestamp to params
  const allParams: Record<string, string> = { ...queryParams, timestamp };

  if (OT_API_SECRET) {
    // Sort parameters by name, concatenate values
    const sortedKeys = Object.keys(allParams).sort();
    const concatenatedValues = sortedKeys.map((k) => allParams[k]).join("");

    // signature = SHA256( methodName + concatenatedValues + secret )
    const sigInput = methodName + concatenatedValues + OT_API_SECRET;
    const signature = await sha256Hex(sigInput);
    allParams.signature = signature;
  }

  // Build URL
  const url = new URL(`${OT_API_BASE}/${methodName}`);
  for (const [key, value] of Object.entries(allParams)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const response = await fetch(url.toString(), { signal: controller.signal });
  clearTimeout(timeout);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OT API HTTP ${response.status}: ${text}`);
  }

  const data = await response.json();

  if (data?.ErrorCode && data.ErrorCode !== "Ok" && data.ErrorCode !== "BatchError") {
    throw new Error(`OT API [${data.ErrorCode}]: ${data.ErrorDescription || "Unknown"}`);
  }

  return data;
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
