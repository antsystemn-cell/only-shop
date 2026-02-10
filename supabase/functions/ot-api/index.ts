import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

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

// ─── API Methods ──────────────────────────────────────────────

async function generateSignature(instanceKey: string, secret: string): Promise<{ signature: string; timestamp: string }> {
  // OT API uses yyyyMMddHHmmss format
  const now = new Date();
  const timestamp = now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0') +
    String(now.getUTCHours()).padStart(2, '0') +
    String(now.getUTCMinutes()).padStart(2, '0') +
    String(now.getUTCSeconds()).padStart(2, '0');
  // Pattern: MD5(secret + timestamp) — common OT API pattern
  const rawStr = secret + timestamp;
  const encoder = new TextEncoder();
  const data = encoder.encode(rawStr);
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  const hashArray = new Uint8Array(hashBuffer);
  const signature = new TextDecoder().decode(hexEncode(hashArray));
  console.log(`[OT API] Signature generated with timestamp: ${timestamp}`);
  return { signature, timestamp };
}

async function callOtApi(method: string, queryParams: Record<string, string>) {
  // Add signature if secret is available
  const OT_API_SECRET = Deno.env.get("OT_API_SECRET");
  if (OT_API_SECRET && queryParams.instanceKey) {
    const { signature, timestamp } = await generateSignature(queryParams.instanceKey, OT_API_SECRET);
    queryParams.signature = signature;
    queryParams.timestamp = timestamp;
  }

  const url = new URL(`${OT_API_BASE}/${method}`);
  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  console.log(`[OT API] Calling: ${method}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`OT API HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    // Check for OT API errors
    if (data?.ErrorCode && data.ErrorCode !== "Ok" && data.ErrorCode !== "BatchError") {
      throw new Error(`OT API Error [${data.ErrorCode}]: ${data.ErrorDescription || "Unknown"}`);
    }

    return data;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function getRootCategories(apiKey: string, params: { language?: string }) {
  const language = params?.language || "en";
  return await callOtApi("GetRootCategoryInfoList", {
    instanceKey: apiKey,
    language,
  });
}

async function getSubcategories(
  apiKey: string,
  params: { parentId: string; language?: string }
) {
  const language = params?.language || "en";
  return await callOtApi("GetCategorySubcategoryInfoList", {
    instanceKey: apiKey,
    language,
    parentCategoryId: params.parentId,
  });
}

async function searchItems(
  apiKey: string,
  params: {
    query?: string;
    categoryId?: string;
    brandId?: string;
    vendorId?: string;
    minPrice?: string;
    maxPrice?: string;
    page?: number;
    pageSize?: number;
    orderBy?: string;
    language?: string;
    imageUrl?: string;
  }
) {
  const language = params?.language || "en";
  const page = params?.page || 0;
  const pageSize = params?.pageSize || 40;
  const framePosition = page * pageSize;

  // Build XML parameters
  let xmlParts: string[] = [];
  if (params?.query) {
    xmlParts.push(`<ItemTitle>${escapeXml(params.query)}</ItemTitle>`);
  }
  if (params?.categoryId) {
    xmlParts.push(`<CategoryId>${escapeXml(params.categoryId)}</CategoryId>`);
  }
  if (params?.vendorId) {
    xmlParts.push(`<VendorId>${escapeXml(params.vendorId)}</VendorId>`);
  }
  if (params?.minPrice) {
    xmlParts.push(`<MinPrice>${escapeXml(params.minPrice)}</MinPrice>`);
  }
  if (params?.maxPrice) {
    xmlParts.push(`<MaxPrice>${escapeXml(params.maxPrice)}</MaxPrice>`);
  }
  if (params?.orderBy) {
    xmlParts.push(`<OrderBy>${escapeXml(params.orderBy)}</OrderBy>`);
  }
  if (params?.imageUrl) {
    xmlParts.push(`<ImageUrl>${escapeXml(params.imageUrl)}</ImageUrl>`);
  }

  const xmlParameters = `<SearchItemsParameters>${xmlParts.join("")}</SearchItemsParameters>`;

  return await callOtApi("BatchSearchItemsFrame", {
    instanceKey: apiKey,
    language,
    framePosition: String(framePosition),
    frameSize: String(pageSize),
    blockList: "SubCategories,SearchProperties",
    xmlParameters,
  });
}

async function getItemFullInfo(
  apiKey: string,
  params: { itemId: string; language?: string }
) {
  const language = params?.language || "en";
  return await callOtApi("BatchGetItemFullInfo", {
    instanceKey: apiKey,
    language,
    itemId: params.itemId,
    blockList: "Vendor,RootPath,Promotions",
  });
}

async function getItemDescription(
  apiKey: string,
  params: { itemId: string; language?: string }
) {
  const language = params?.language || "en";
  return await callOtApi("GetItemDescription", {
    instanceKey: apiKey,
    language,
    itemId: params.itemId,
  });
}

// ─── Helpers ──────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
