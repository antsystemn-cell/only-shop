import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OT_API_BASE = "https://otapi.net/service-json";

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

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function callOtApi(methodName: string, queryParams: Record<string, string>) {
  const OT_API_SECRET = Deno.env.get("OT_API_SECRET");
  const timestamp = getTimestamp();

  const allParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null && value !== "") {
      allParams[key] = value;
    }
  }
  allParams.timestamp = timestamp;

  if (OT_API_SECRET) {
    const sortedKeys = Object.keys(allParams).sort();
    const concatenatedValues = sortedKeys.map((k) => allParams[k]).join("");
    const sigInput = methodName + concatenatedValues + OT_API_SECRET;
    allParams.signature = await sha256Hex(sigInput);
  }

  const url = new URL(`${OT_API_BASE}/${methodName}`);
  for (const [key, value] of Object.entries(allParams)) {
    url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const response = await fetch(url.toString(), { signal: controller.signal });
  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`OT API HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data?.ErrorCode && data.ErrorCode !== "Ok" && data.ErrorCode !== "BatchError") {
    throw new Error(`OT API [${data.ErrorCode}]: ${data.ErrorDescription || "Unknown"}`);
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const otApiKey = Deno.env.get("OT_API_KEY")!;
  const otLogin = Deno.env.get("OT_OPERATOR_LOGIN")!;
  const otPassword = Deno.env.get("OT_OPERATOR_PASSWORD")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || 3;
    const downloadImages = body.downloadImages !== false;

    // Step 1: Get operator session
    console.log("[sync-wh] Authenticating operator...");
    const authData = await callOtApi("AuthenticateInstanceOperator", {
      instanceKey: otApiKey,
      language: "en",
      userLogin: otLogin,
      userPassword: otPassword,
    });
    const sessionId = authData?.SessionId?.Value || authData?.SessionId;
    if (!sessionId) throw new Error("Failed to get operator session");
    console.log("[sync-wh] Got operator session");

    // Step 2: Fetch ALL warehouse items (paginated)
    const allOtItems: any[] = [];
    let page = 0;
    const pageSize = 50;
    let totalCount = 999;

    while (allOtItems.length < totalCount) {
      const data = await callOtApi("SearchWarehouseItems", {
        instanceKey: otApiKey,
        language: "en",
        sessionId,
        includeMetaInfo: "true",
        framePosition: String(page * pageSize),
        frameSize: String(pageSize),
        xmlSearchParameters: "<SearchParameters></SearchParameters>",
      });

      const result = data?.Result || data;
      let itemList: any[] = [];
      if (Array.isArray(result?.Content)) itemList = result.Content;
      else if (Array.isArray(result)) itemList = result;

      if (result?.TotalCount !== undefined) totalCount = Number(result.TotalCount);

      console.log(`[sync-wh] Page ${page}: ${itemList.length} items (total: ${totalCount})`);
      if (itemList.length === 0) break;
      allOtItems.push(...itemList);
      page++;
      if (page > 30) break;
      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(`[sync-wh] Fetched ${allOtItems.length} warehouse items`);

    // Step 3: Process each item
    let successCount = 0;
    let errorCount = 0;
    const results: any[] = [];

    for (let i = 0; i < allOtItems.length; i += batchSize) {
      const batch = allOtItems.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((otItem) => processItem(supabase, otItem, downloadImages))
      );

      for (let j = 0; j < batchResults.length; j++) {
        const r = batchResults[j];
        const itemId = `wh-${batch[j].Id || "?"}`;
        if (r.status === "fulfilled") {
          successCount++;
          results.push({ itemId, status: "ok", ...r.value });
        } else {
          errorCount++;
          results.push({ itemId, status: "error", error: r.reason?.message || String(r.reason) });
        }
      }

      if (i + batchSize < allOtItems.length) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    return new Response(
      JSON.stringify({ success: true, totalFetched: allOtItems.length, successCount, errorCount, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[sync-wh] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processItem(supabase: any, otItem: any, downloadImages: boolean) {
  const otId = String(otItem.Id);
  const itemId = `wh-${otId}`;

  const title = otItem.Name || otItem.DisplayedTitle || "";
  const price = Number(otItem.Price) || 0;
  const stock = Number(otItem.Quantity) || 0;
  const description = otItem.Description || null;

  // Images
  const imageUrls: string[] = [];
  if (otItem.MainImageUrl) imageUrls.push(otItem.MainImageUrl);
  if (Array.isArray(otItem.ImageUrls)) {
    for (const img of otItem.ImageUrls) {
      const url = typeof img === "string" ? img : img.Url;
      if (url && !imageUrls.includes(url)) imageUrls.push(url);
    }
  }

  // Download images to storage
  const finalUrls: string[] = [];
  let mainUrl = imageUrls[0] || null;

  if (downloadImages && imageUrls.length > 0) {
    for (let idx = 0; idx < Math.min(imageUrls.length, 15); idx++) {
      const picUrl = imageUrls[idx];
      try {
        const imgRes = await fetch(picUrl);
        if (!imgRes.ok) { finalUrls.push(picUrl); continue; }
        const ct = imgRes.headers.get("content-type") || "image/jpeg";
        const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
        const buf = await imgRes.arrayBuffer();
        const path = `warehouse/${otId}/${idx === 0 ? "main" : `img_${idx}`}.${ext}`;
        const { error } = await supabase.storage.from("products").upload(path, buf, { contentType: ct, upsert: true });
        if (error) {
          finalUrls.push(picUrl);
        } else {
          const { data } = supabase.storage.from("products").getPublicUrl(path);
          finalUrls.push(data?.publicUrl || picUrl);
        }
      } catch {
        finalUrls.push(picUrl);
      }
    }
    mainUrl = finalUrls[0] || mainUrl;
  } else {
    finalUrls.push(...imageUrls);
  }

  // Upsert into warehouse_items
  const upsertData: Record<string, any> = {
    item_id: itemId,
    title,
    description,
    image_url: mainUrl,
    images: finalUrls,
    price_mnt: price,
    stock,
    is_active: otItem.IsSellAllowed !== false,
    provider_type: "warehouse",
  };

  const { data: existing } = await supabase
    .from("warehouse_items")
    .select("id")
    .eq("item_id", itemId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("warehouse_items").update(upsertData).eq("item_id", itemId);
    if (error) throw new Error(`Update failed: ${error.message}`);
  } else {
    const { error } = await supabase.from("warehouse_items").insert(upsertData);
    if (error) throw new Error(`Insert failed: ${error.message}`);
  }

  return { title, price, imageCount: finalUrls.length };
}
