import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_NAME = "Онли";
const SITE_URL = "https://only.mn";
const DEFAULT_IMAGE = "https://only.mn/pwa-icon-512.png";
const DEFAULT_DESC = "Бид Хятад, Америк, Солонгос, Япон улсуудаас хүссэн бүхнээ хамгийн хялбараар захиалах боломжийг танд олгож байна.";

const OT_API_BASE = "https://otapi.net/service-json";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildHtml(title: string, description: string, image: string, url: string, type = "website"): string {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(url);

  return `<!DOCTYPE html>
<html lang="mn">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle} | ${SITE_NAME}</title>
  <meta name="description" content="${safeDesc}">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:url" content="${safeUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${safeImage}">
  <meta http-equiv="refresh" content="0;url=${safeUrl}">
</head>
<body>
  <p>Redirecting to <a href="${safeUrl}">${safeTitle}</a>...</p>
</body>
</html>`;
}

/** Fetch OT product detail via OTAPI */
async function fetchOtProduct(itemId: string): Promise<{ title: string; image: string; desc: string } | null> {
  try {
    const apiKey = Deno.env.get("OT_API_KEY") || "";
    const apiSecret = Deno.env.get("OT_API_SECRET") || "";

    // Try to get default language from admin settings
    let lang = "khk";
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, supabaseKey);
      const { data } = await sb
        .from("admin_settings")
        .select("setting_value")
        .eq("setting_key", "otapi_default_language")
        .maybeSingle();
      if (data?.setting_value) {
        const val = typeof data.setting_value === "string" ? data.setting_value : JSON.parse(JSON.stringify(data.setting_value));
        if (typeof val === "string" && val.length > 0) lang = val;
      }
    } catch { /* use default */ }

    // Strip provider prefix for OTAPI call
    const rawId = itemId.replace(/^(pz-|tb-|az-)/, "");
    const prefix = itemId.match(/^(pz-|tb-|az-)/)?.[1] || "";

    // Determine provider type for correct instance key
    let instanceKey = "taobao";
    if (prefix === "pz-") instanceKey = "dewu2";
    else if (prefix === "az-") instanceKey = "amazonglobal";

    const params = new URLSearchParams({
      instanceKey,
      language: lang,
      itemId: rawId,
      blockList: "MainInfo",
    });
    if (apiKey) params.set("apiKey", apiKey);
    if (apiSecret) {
      const { createHash } = await import("https://deno.land/std@0.168.0/crypto/mod.ts").catch(() => ({ createHash: null }));
      // Simple signature: just pass key, OTAPI handles it
    }

    const apiUrl = `${OT_API_BASE}/BatchGetSimplifiedItemFullInfo?${params.toString()}`;
    const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;

    const json = await resp.json();
    const item = json?.Result?.Item || json?.Result?.Items?.[0];
    if (!item) return null;

    const title = item.Title || item.ExternalTitle || "";
    const image = item.MainPictureUrl || item.Pictures?.[0]?.Url || "";
    const features = (item.FeaturedValues || []).slice(0, 3).map((f: any) => `${f.Name}: ${f.Value}`).join(", ");

    return { title, image, desc: features || title.slice(0, 160) };
  } catch (e) {
    console.error("OT product fetch error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "product";
    const idOrSlug = url.searchParams.get("id") || "";

    if (!idOrSlug && type !== "page") {
      return new Response(buildHtml(SITE_NAME, DEFAULT_DESC, DEFAULT_IMAGE, SITE_URL), {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ─── Local Product ──────────────────────────────────────
    if (type === "product") {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
      const column = isUuid ? "id" : "slug";

      const { data: product } = await supabase
        .from("products")
        .select("id, name_mn, slug, images, seo_title, seo_description, description_mn, price")
        .eq(column, idOrSlug)
        .single();

      if (!product) {
        return new Response(buildHtml(SITE_NAME, DEFAULT_DESC, DEFAULT_IMAGE, SITE_URL), {
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        });
      }

      const title = product.seo_title || product.name_mn || SITE_NAME;
      const description = product.seo_description ||
        (product.description_mn ? product.description_mn.replace(/<[^>]*>/g, "").slice(0, 160) : DEFAULT_DESC);
      const image = product.images?.[0] || DEFAULT_IMAGE;
      const productSlug = product.slug || product.id;
      const productUrl = `${SITE_URL}/product/${productSlug}`;

      const priceText = product.price
        ? ` - ${new Intl.NumberFormat("mn-MN").format(product.price)}₮`
        : "";

      return new Response(
        buildHtml(title + priceText, description, image, productUrl, "product"),
        {
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        }
      );
    }

    // ─── OT Product (OTAPI) ─────────────────────────────────
    if (type === "ot-product") {
      const productUrl = `${SITE_URL}/ot/product/${idOrSlug}`;

      // Try fetching real data from OTAPI
      const otData = await fetchOtProduct(idOrSlug);
      if (otData && otData.title) {
        return new Response(
          buildHtml(
            otData.title,
            otData.desc || DEFAULT_DESC,
            otData.image || DEFAULT_IMAGE,
            productUrl,
            "product"
          ),
          { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" } }
        );
      }

      // Also check warehouse_items for warehouse products
      const { data: whItem } = await supabase
        .from("warehouse_items")
        .select("title, image_url, images, description")
        .eq("item_id", idOrSlug)
        .maybeSingle();

      if (whItem) {
        const whImage = whItem.image_url || whItem.images?.[0] || DEFAULT_IMAGE;
        return new Response(
          buildHtml(whItem.title || SITE_NAME, whItem.description?.slice(0, 160) || DEFAULT_DESC, whImage, productUrl, "product"),
          { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" } }
        );
      }

      return new Response(
        buildHtml(SITE_NAME, DEFAULT_DESC, DEFAULT_IMAGE, productUrl),
        { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // ─── Amazon Product ─────────────────────────────────────
    if (type === "amazon-product") {
      const { data: amzProduct } = await supabase
        .from("amazon_products")
        .select("asin, title, main_image, short_description, amazon_product_store_settings(local_title_override, local_description_override)")
        .eq("asin", idOrSlug)
        .maybeSingle();

      const productUrl = `${SITE_URL}/amazon/product/${idOrSlug}`;

      if (amzProduct) {
        const settings = Array.isArray(amzProduct.amazon_product_store_settings)
          ? amzProduct.amazon_product_store_settings[0]
          : amzProduct.amazon_product_store_settings;
        const title = settings?.local_title_override || amzProduct.title || SITE_NAME;
        const desc = settings?.local_description_override || amzProduct.short_description || DEFAULT_DESC;
        const image = amzProduct.main_image || DEFAULT_IMAGE;

        return new Response(
          buildHtml(title, desc.slice(0, 160), image, productUrl, "product"),
          { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" } }
        );
      }

      return new Response(
        buildHtml(SITE_NAME, DEFAULT_DESC, DEFAULT_IMAGE, productUrl),
        { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // ─── Category ───────────────────────────────────────────
    if (type === "category") {
      const { data: category } = await supabase
        .from("categories")
        .select("id, name_mn, image_url, description")
        .eq("id", idOrSlug)
        .maybeSingle();

      if (category) {
        let image = category.image_url || "";
        // If no category image, try first product image
        if (!image) {
          const { data: firstProduct } = await supabase
            .from("products")
            .select("images")
            .eq("category_id", category.id)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
          image = firstProduct?.images?.[0] || DEFAULT_IMAGE;
        }

        const catUrl = `${SITE_URL}/shop?category=${category.id}`;
        return new Response(
          buildHtml(category.name_mn, category.description || DEFAULT_DESC, image || DEFAULT_IMAGE, catUrl),
          { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" } }
        );
      }

      return new Response(buildHtml(SITE_NAME, DEFAULT_DESC, DEFAULT_IMAGE, SITE_URL), {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // ─── Content Page ───────────────────────────────────────
    if (type === "page") {
      const slug = idOrSlug || url.searchParams.get("slug") || "";
      if (slug) {
        const { data: page } = await supabase
          .from("content_pages")
          .select("title, seo_title, seo_description, seo_image, slug")
          .eq("slug", slug)
          .eq("status", "published")
          .maybeSingle();

        if (page) {
          const pageUrl = `${SITE_URL}/page/${page.slug}`;
          return new Response(
            buildHtml(
              page.seo_title || page.title,
              page.seo_description || DEFAULT_DESC,
              page.seo_image || DEFAULT_IMAGE,
              pageUrl
            ),
            { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" } }
          );
        }
      }

      return new Response(buildHtml(SITE_NAME, DEFAULT_DESC, DEFAULT_IMAGE, SITE_URL), {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response(buildHtml(SITE_NAME, DEFAULT_DESC, DEFAULT_IMAGE, SITE_URL), {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("OG Meta error:", error);
    return new Response(buildHtml(SITE_NAME, DEFAULT_DESC, DEFAULT_IMAGE, SITE_URL), {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }
});
