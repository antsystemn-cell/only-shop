import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ==================== CONFIG ====================

function isSandbox(): boolean {
  const val = (Deno.env.get("AMAZON_SANDBOX") || "").toLowerCase().trim();
  return val === "true" || val === "1" || val === "yes";
}

const PROD_ENDPOINTS: Record<string, string> = {
  "us-east-1": "https://sellingpartnerapi-na.amazon.com",
  "eu-west-1": "https://sellingpartnerapi-eu.amazon.com",
  "us-west-2": "https://sellingpartnerapi-fe.amazon.com",
};

const SANDBOX_ENDPOINTS: Record<string, string> = {
  "us-east-1": "https://sandbox.sellingpartnerapi-na.amazon.com",
  "eu-west-1": "https://sandbox.sellingpartnerapi-eu.amazon.com",
  "us-west-2": "https://sandbox.sellingpartnerapi-fe.amazon.com",
};

const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";

// ==================== SANDBOX FIXTURES ====================

const SANDBOX_PRODUCTS = [
  {
    asin: "B0SANDBOX01",
    title: "[Sandbox] Wireless Bluetooth Headphones",
    brand: "SandboxBrand",
    mainImage: "/placeholder.svg",
    browseClassification: "Electronics > Headphones",
    marketplace: "ATVPDKIKX0DER",
    short_description: "High-quality wireless headphones for sandbox testing.",
    source_price: 29.99,
    source_currency: "USD",
  },
  {
    asin: "B0SANDBOX02",
    title: "[Sandbox] USB-C Charging Cable 6ft",
    brand: "SandboxBrand",
    mainImage: "/placeholder.svg",
    browseClassification: "Electronics > Cables",
    marketplace: "ATVPDKIKX0DER",
    short_description: "Durable USB-C cable for sandbox testing.",
    source_price: 9.99,
    source_currency: "USD",
  },
  {
    asin: "B0SANDBOX03",
    title: "[Sandbox] Stainless Steel Water Bottle",
    brand: "SandboxBrand",
    mainImage: "/placeholder.svg",
    browseClassification: "Kitchen > Water Bottles",
    marketplace: "ATVPDKIKX0DER",
    short_description: "Insulated water bottle for sandbox testing.",
    source_price: 19.99,
    source_currency: "USD",
  },
];

// ==================== AUTH ====================

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function checkSecrets() {
  const clientId = Deno.env.get("AMAZON_LWA_CLIENT_ID");
  const clientSecret = Deno.env.get("AMAZON_LWA_CLIENT_SECRET");
  const refreshToken = Deno.env.get("AMAZON_REFRESH_TOKEN");

  const awsAccessKeyId = Deno.env.get("AMAZON_AWS_ACCESS_KEY_ID");
  const awsSecretAccessKey = Deno.env.get("AMAZON_AWS_SECRET_ACCESS_KEY");
  const awsSessionToken = Deno.env.get("AMAZON_AWS_SESSION_TOKEN");

  const missingLwa: string[] = [];
  if (!clientId) missingLwa.push("AMAZON_LWA_CLIENT_ID");
  if (!clientSecret) missingLwa.push("AMAZON_LWA_CLIENT_SECRET");
  if (!refreshToken) missingLwa.push("AMAZON_REFRESH_TOKEN");

  const missingAws: string[] = [];
  if (!awsAccessKeyId) missingAws.push("AMAZON_AWS_ACCESS_KEY_ID");
  if (!awsSecretAccessKey) missingAws.push("AMAZON_AWS_SECRET_ACCESS_KEY");

  return {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasRefreshToken: !!refreshToken,
    hasAwsAccessKeyId: !!awsAccessKeyId,
    hasAwsSecretAccessKey: !!awsSecretAccessKey,
    hasAwsSessionToken: !!awsSessionToken,
    missingLwa,
    missingAws,
    missing: [...missingLwa, ...missingAws],
  };
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const clientId = Deno.env.get("AMAZON_LWA_CLIENT_ID");
  const clientSecret = Deno.env.get("AMAZON_LWA_CLIENT_SECRET");
  const refreshToken = Deno.env.get("AMAZON_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    const secrets = checkSecrets();
    throw new Error(`Missing credentials: ${secrets.missing.join(", ")}`);
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

  const body = await response.text();
  if (!response.ok) {
    let errorType = "unknown";
    try { const parsed = JSON.parse(body); errorType = parsed.error || "unknown"; } catch {}
    if (errorType === "invalid_client") throw new Error("LWA_INVALID_CLIENT: Client ID or Client Secret is invalid.");
    if (errorType === "invalid_grant") throw new Error("LWA_INVALID_GRANT: Refresh token is invalid or expired.");
    throw new Error(`LWA token refresh failed [${response.status}]: ${body}`);
  }

  const data: TokenResponse = JSON.parse(body);
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

// ==================== SP-API REQUEST ====================

function getEndpoint(region: string): string {
  const endpoints = isSandbox() ? SANDBOX_ENDPOINTS : PROD_ENDPOINTS;
  return endpoints[region] || endpoints["us-east-1"];
}

async function spApiRequest(
  path: string,
  region: string,
  params?: Record<string, string>,
  method = "GET"
): Promise<any> {
  const token = await getAccessToken();
  const endpoint = getEndpoint(region);
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
      "x-amz-access-token": token,
      "Content-Type": "application/json",
      "User-Agent": "OnlyMN/1.0 (Lovable; +https://onlymn.lovable.app)",
    },
  });

  const duration = Date.now() - startTime;
  const rateLimitHeader = response.headers.get("x-amzn-ratelimit-limit");
  const responseBody = await response.text();

  // Log the API call
  const adminClient = getAdminClient();
  await adminClient.from("amazon_api_logs").insert({
    operation_name: path,
    marketplace_id: params?.marketplaceIds || null,
    request_summary: { path, params, method, sandbox: isSandbox() },
    response_code: response.status,
    rate_limit_header: rateLimitHeader,
    status: response.ok ? "success" : "error",
    error_message: response.ok ? null : `HTTP ${response.status}: ${responseBody.substring(0, 500)}`,
    duration_ms: duration,
  });

  if (response.ok) {
    await adminClient
      .from("amazon_connections")
      .update({ last_successful_api_call_at: new Date().toISOString() })
      .eq("is_active", true);
  }

  if (response.status === 429) throw new Error("THROTTLED: Rate limit exceeded. Retry later.");
  if (response.status === 403) throw new Error(`SP_API_FORBIDDEN: Access denied. Response: ${responseBody.substring(0, 300)}`);
  if (!response.ok) throw new Error(`SP-API error [${response.status}]: ${responseBody.substring(0, 500)}`);

  return JSON.parse(responseBody);
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
  const sandbox = isSandbox();
  const client = getAdminClient();

  // Step 1: Check secrets
  const secrets = checkSecrets();
  if (secrets.missing.length > 0) {
    return {
      success: false,
      error: `Missing credentials: ${secrets.missing.join(", ")}`,
      step: "config_missing",
      sandbox,
      details: {
        hasClientId: secrets.hasClientId,
        hasClientSecret: secrets.hasClientSecret,
        hasRefreshToken: secrets.hasRefreshToken,
      },
    };
  }

  // Step 2: LWA token refresh
  try {
    cachedToken = null;
    await getAccessToken();
    await client
      .from("amazon_connections")
      .update({ last_token_refresh_at: new Date().toISOString() })
      .eq("is_active", true);
  } catch (e: any) {
    let step = "token_refresh_failed";
    if (e.message.includes("LWA_INVALID_CLIENT")) step = "token_refresh_failed";
    if (e.message.includes("LWA_INVALID_GRANT")) step = "token_refresh_failed";

    await client
      .from("amazon_connections")
      .update({ auth_status: "failed" })
      .eq("is_active", true);

    return { success: false, error: e.message, step, sandbox };
  }

  // Step 3: Real SP-API request (sandbox or prod)
  const region = await getConnectionRegion();
  try {
    await spApiRequest(
      "/definitions/2020-09-01/productTypes",
      region,
      { marketplaceIds: "ATVPDKIKX0DER", itemName: "PRODUCT" }
    );
  } catch (e: any) {
    let step = "sandbox_request_failed";
    if (e.message.includes("SP_API_FORBIDDEN")) step = "permission_error";
    if (e.message.includes("THROTTLED")) step = "sandbox_request_failed";

    await client
      .from("amazon_connections")
      .update({ auth_status: "token_only" })
      .eq("is_active", true);

    return {
      success: false,
      error: e.message,
      step,
      sandbox,
      tokenRefreshWorked: true,
    };
  }

  // All passed
  await client
    .from("amazon_connections")
    .update({
      auth_status: "authorized",
      last_successful_api_call_at: new Date().toISOString(),
    })
    .eq("is_active", true);

  return {
    success: true,
    message: sandbox
      ? "Sandbox connection verified: LWA token + sandbox SP-API access confirmed."
      : "Production connection verified: LWA token + SP-API access confirmed.",
    sandbox,
  };
}

async function handleSearchCatalog(params: any) {
  const sandbox = isSandbox();
  const marketplaceId = params.marketplaceId || "ATVPDKIKX0DER";

  // In sandbox mode, return fixture data
  if (sandbox) {
    const query = (params.query || "").toLowerCase();
    let results = SANDBOX_PRODUCTS;
    
    if (params.searchType === "asin") {
      results = results.filter((p) => p.asin.toLowerCase() === query);
    } else if (query) {
      results = results.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.brand.toLowerCase().includes(query) ||
          p.browseClassification.toLowerCase().includes(query)
      );
    }

    // If empty search, return all sandbox products
    if (!query && params.searchType !== "asin") {
      results = SANDBOX_PRODUCTS;
    }

    return {
      success: true,
      items: results.map((p) => ({ ...p, marketplace: marketplaceId })),
      totalResults: results.length,
      sandbox: true,
    };
  }

  // Production mode
  const region = await getConnectionRegion();
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

  const result = await spApiRequest("/catalog/2022-04-01/items", region, apiParams);

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

  return { success: true, items, totalResults: result.numberOfResults || items.length, sandbox: false };
}

async function handleImportProducts(params: any) {
  const sandbox = isSandbox();
  const marketplaceId = params.marketplaceId || "ATVPDKIKX0DER";
  const asins: string[] = params.asins || [];
  const client = getAdminClient();
  let imported = 0;
  const errors: Array<{ asin: string; error: string }> = [];

  // Create sync job
  const { data: job } = await client
    .from("amazon_sync_jobs")
    .insert({
      job_type: sandbox ? "sandbox_product_import" : "product_import",
      status: "running",
      payload: { asins, marketplaceId, sandbox },
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  try {
    for (const asin of asins) {
      try {
        let productData: any;

        if (sandbox) {
          // Use fixture data
          const fixture = SANDBOX_PRODUCTS.find((p) => p.asin === asin);
          productData = {
            title: fixture?.title || `[Sandbox] Product ${asin}`,
            brand: fixture?.brand || "SandboxBrand",
            short_description: fixture?.short_description || "Sandbox test product",
            main_image: fixture?.mainImage || `https://via.placeholder.com/300x300.png?text=${asin}`,
            image_gallery: [],
            attributes: { sandbox: true, generated_at: new Date().toISOString() },
            dimensions: {},
            identifiers: { items: [{ identifierType: "ASIN", identifier: asin }] },
            relationships: [],
            browse_classifications: [{ classifications: [{ displayName: fixture?.browseClassification || "Sandbox Category" }] }],
            source_price: fixture?.source_price || 19.99,
            source_currency: fixture?.source_currency || "USD",
            raw_payload: { sandbox: true, fixture: true },
          };
        } else {
          // Real SP-API call
          const region = await getConnectionRegion();
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

          productData = {
            title: summary.itemName || summary.title || asin,
            brand: summary.brand || null,
            short_description: summary.shortDescription || null,
            main_image: mainImage,
            image_gallery: gallery,
            attributes: result.attributes || {},
            dimensions: result.dimensions?.[0] || {},
            identifiers: { items: result.identifiers?.[0]?.identifiers || [] },
            relationships: result.relationships || [],
            browse_classifications: result.classifications || [],
            raw_payload: result,
          };
        }

        // Upsert product
        const { error } = await client.from("amazon_products").upsert(
          {
            asin,
            marketplace_id: marketplaceId,
            title: productData.title,
            brand: productData.brand,
            short_description: productData.short_description,
            main_image: productData.main_image,
            image_gallery: productData.image_gallery,
            attributes: productData.attributes,
            dimensions: productData.dimensions,
            identifiers: productData.identifiers,
            relationships: productData.relationships,
            browse_classifications: productData.browse_classifications,
            raw_payload: productData.raw_payload,
            source_price: productData.source_price || null,
            source_currency: productData.source_currency || null,
            source_status: "active",
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "asin,marketplace_id" }
        );

        if (error) {
          errors.push({ asin, error: error.message });
        } else {
          imported++;
          // Ensure store settings exist
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
        errors.push({ asin, error: itemError.message });
      }
    }

    await client
      .from("amazon_sync_jobs")
      .update({
        status: errors.length === asins.length ? "failed" : "completed",
        finished_at: new Date().toISOString(),
        result: { imported, total: asins.length, errors, sandbox },
      })
      .eq("id", job!.id);

    return { success: true, imported, errors, sandbox };
  } catch (e: any) {
    await client
      .from("amazon_sync_jobs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: e.message,
      })
      .eq("id", job!.id);
    throw e;
  }
}

async function handleSyncCategories(params: any) {
  const sandbox = isSandbox();
  const client = getAdminClient();
  const marketplaceId = params?.marketplaceId || "ATVPDKIKX0DER";

  if (sandbox) {
    // Insert sandbox categories
    const sandboxCategories = [
      { key: "SANDBOX_ELECTRONICS", name: "[Sandbox] Electronics", product_type: "ELECTRONIC" },
      { key: "SANDBOX_KITCHEN", name: "[Sandbox] Kitchen & Home", product_type: "KITCHEN" },
      { key: "SANDBOX_ACCESSORIES", name: "[Sandbox] Accessories", product_type: "ACCESSORY" },
    ];

    let count = 0;
    for (const cat of sandboxCategories) {
      const { error } = await client.from("amazon_categories").upsert(
        {
          amazon_category_key: cat.key,
          product_type: cat.product_type,
          name: cat.name,
          marketplace_id: marketplaceId,
          raw_payload: { sandbox: true },
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "amazon_category_key,marketplace_id" }
      );
      if (!error) count++;
    }

    return { success: true, count, total: sandboxCategories.length, sandbox: true };
  }

  // Production mode
  const region = await getConnectionRegion();
  try {
    const result = await spApiRequest(
      "/definitions/2020-09-01/productTypes",
      region,
      { marketplaceIds: marketplaceId }
    );

    const productTypes = result.productTypes || [];
    let count = 0;
    for (const pt of productTypes) {
      const { error } = await client.from("amazon_categories").upsert(
        {
          amazon_category_key: pt.name,
          product_type: pt.name,
          name: pt.displayName || pt.name,
          marketplace_id: marketplaceId,
          raw_payload: pt,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "amazon_category_key,marketplace_id" }
      );
      if (!error) count++;
    }

    return { success: true, count, total: productTypes.length, sandbox: false };
  } catch (e: any) {
    return { success: false, error: e.message, count: 0, sandbox: false };
  }
}

async function handleGetConfig() {
  return {
    sandbox: isSandbox(),
    secrets: checkSecrets(),
  };
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
        result = await handleSyncCategories(params);
        break;
      case "getConfig":
        result = await handleGetConfig();
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
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
