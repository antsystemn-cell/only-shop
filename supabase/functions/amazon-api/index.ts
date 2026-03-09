import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Amazon SP-API endpoints by region
const REGION_ENDPOINTS: Record<string, string> = {
  "us-east-1": "https://sellingpartnerapi-na.amazon.com",
  "eu-west-1": "https://sellingpartnerapi-eu.amazon.com",
  "us-west-2": "https://sellingpartnerapi-fe.amazon.com",
};

const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// In-memory token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Check cache
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const clientId = Deno.env.get("AMAZON_LWA_CLIENT_ID");
  const clientSecret = Deno.env.get("AMAZON_LWA_CLIENT_SECRET");
  const refreshToken = Deno.env.get("AMAZON_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Amazon LWA credentials not configured");
  }

  const response = await fetch(LWA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`LWA token refresh failed [${response.status}]: ${errBody}`);
  }

  const data: TokenResponse = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

async function spApiRequest(
  path: string,
  region: string,
  params?: Record<string, string>,
  method = "GET"
): Promise<any> {
  const token = await getAccessToken();
  const endpoint = REGION_ENDPOINTS[region] || REGION_ENDPOINTS["us-east-1"];
  const url = new URL(path, endpoint);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const startTime = Date.now();
  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "x-amz-access-token": token,
      "Content-Type": "application/json",
    },
  });

  const duration = Date.now() - startTime;
  const rateLimitHeader = response.headers.get("x-amzn-ratelimit-limit");

  // Log the API call
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, supabaseKey);

  await adminClient.from("amazon_api_logs").insert({
    operation_name: path,
    marketplace_id: params?.marketplaceIds || null,
    request_summary: { path, params },
    response_code: response.status,
    rate_limit_header: rateLimitHeader,
    status: response.ok ? "success" : "error",
    error_message: response.ok ? null : `HTTP ${response.status}`,
    duration_ms: duration,
  });

  if (response.status === 429) {
    throw new Error("THROTTLED: Rate limit exceeded. Retry later.");
  }

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`SP-API error [${response.status}]: ${errBody}`);
  }

  return response.json();
}

function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getConnectionRegion(): Promise<string> {
  const client = getAdminClient();
  const { data } = await client
    .from("amazon_connections")
    .select("region")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return data?.region || "us-east-1";
}

// ==================== HANDLERS ====================

async function handleTestConnection() {
  const region = await getConnectionRegion();
  // Simple test: try to get a token
  await getAccessToken();

  // Update connection status
  const client = getAdminClient();
  await client
    .from("amazon_connections")
    .update({
      auth_status: "authorized",
      last_token_refresh_at: new Date().toISOString(),
      last_successful_api_call_at: new Date().toISOString(),
    })
    .eq("is_active", true);

  return { success: true, message: "Connection successful" };
}

async function handleSearchCatalog(params: any) {
  const region = await getConnectionRegion();
  const marketplaceId = params.marketplaceId || "ATVPDKIKX0DER";

  const apiParams: Record<string, string> = {
    marketplaceIds: marketplaceId,
    includedData: "summaries,images,identifiers,classifications",
    pageSize: "20",
  };

  if (params.searchType === "asin") {
    apiParams.identifiers = params.query;
    apiParams.identifiersType = "ASIN";
  } else if (params.searchType === "upc") {
    apiParams.identifiers = params.query;
    apiParams.identifiersType = "UPC";
  } else {
    apiParams.keywords = params.query;
  }

  const result = await spApiRequest(
    "/catalog/2022-04-01/items",
    region,
    apiParams
  );

  // Normalize results
  const items = (result.items || []).map((item: any) => {
    const summary = item.summaries?.[0] || {};
    const mainImage = item.images?.[0]?.images?.[0]?.link || null;
    const classification = item.classifications?.[0]?.classifications?.[0]?.displayName || null;

    return {
      asin: item.asin,
      title: summary.itemName || summary.title || item.asin,
      brand: summary.brand || null,
      mainImage,
      browseClassification: classification,
      marketplace: marketplaceId,
    };
  });

  return { success: true, items, totalResults: result.numberOfResults || items.length };
}

async function handleImportProducts(params: any) {
  const region = await getConnectionRegion();
  const marketplaceId = params.marketplaceId || "ATVPDKIKX0DER";
  const asins: string[] = params.asins || [];
  const client = getAdminClient();
  let imported = 0;

  // Create sync job
  const { data: job } = await client.from("amazon_sync_jobs").insert({
    job_type: "product_import",
    status: "running",
    payload: { asins, marketplaceId },
    started_at: new Date().toISOString(),
  }).select().single();

  try {
    for (const asin of asins) {
      try {
        // Fetch detailed item data
        const result = await spApiRequest(
          `/catalog/2022-04-01/items/${asin}`,
          region,
          {
            marketplaceIds: marketplaceId,
            includedData: "summaries,images,identifiers,attributes,dimensions,relationships,classifications",
          }
        );

        const summary = result.summaries?.[0] || {};
        const allImages = result.images?.[0]?.images || [];
        const mainImage = allImages[0]?.link || null;
        const gallery = allImages.slice(1).map((img: any) => img.link).filter(Boolean);
        const classification = result.classifications?.[0]?.classifications?.[0] || {};
        const identifiers = result.identifiers?.[0]?.identifiers || [];

        // Upsert product
        const { error } = await client.from("amazon_products").upsert(
          {
            asin,
            marketplace_id: marketplaceId,
            title: summary.itemName || summary.title || asin,
            brand: summary.brand || null,
            short_description: summary.shortDescription || null,
            main_image: mainImage,
            image_gallery: gallery,
            attributes: result.attributes || {},
            dimensions: result.dimensions?.[0] || {},
            identifiers: { items: identifiers },
            relationships: result.relationships || [],
            browse_classifications: result.classifications || [],
            raw_payload: result,
            source_status: "active",
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "asin,marketplace_id" }
        );

        if (!error) {
          imported++;
          // Also ensure store settings exist
          const { data: prod } = await client
            .from("amazon_products")
            .select("id")
            .eq("asin", asin)
            .eq("marketplace_id", marketplaceId)
            .single();

          if (prod) {
            await client.from("amazon_product_store_settings").upsert(
              {
                amazon_product_id: prod.id,
                local_slug: asin.toLowerCase(),
                publish_status: "draft",
              },
              { onConflict: "amazon_product_id" }
            );
          }
        }
      } catch (itemError: any) {
        console.error(`Failed to import ${asin}:`, itemError.message);
      }
    }

    // Update job
    await client.from("amazon_sync_jobs").update({
      status: "completed",
      finished_at: new Date().toISOString(),
      result: { imported, total: asins.length },
    }).eq("id", job!.id);

    // Update connection last API call
    await client.from("amazon_connections").update({
      last_successful_api_call_at: new Date().toISOString(),
    }).eq("is_active", true);

    return { success: true, imported };
  } catch (e: any) {
    await client.from("amazon_sync_jobs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message: e.message,
    }).eq("id", job!.id);
    throw e;
  }
}

async function handleSyncCategories() {
  // Note: SP-API uses Product Type Definitions for categories
  const region = await getConnectionRegion();
  const client = getAdminClient();

  try {
    const result = await spApiRequest(
      "/definitions/2020-09-01/productTypes",
      region,
      { marketplaceIds: "ATVPDKIKX0DER" }
    );

    const productTypes = result.productTypes || [];
    let count = 0;

    for (const pt of productTypes) {
      await client.from("amazon_categories").upsert(
        {
          amazon_category_key: pt.name,
          product_type: pt.name,
          name: pt.displayName || pt.name,
          marketplace_id: "ATVPDKIKX0DER",
          raw_payload: pt,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "amazon_category_key,marketplace_id" }
      );
      count++;
    }

    return { success: true, count };
  } catch (e: any) {
    return { success: false, error: e.message, count: 0 };
  }
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params } = await req.json();

    let result: any;

    switch (action) {
      case "testConnection":
        result = await handleTestConnection();
        break;
      case "searchCatalog":
        result = await handleSearchCatalog(params);
        break;
      case "importProducts":
        result = await handleImportProducts(params);
        break;
      case "syncCategories":
        result = await handleSyncCategories();
        break;
      default:
        result = { success: false, error: `Unknown action: ${action}` };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Amazon API error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
