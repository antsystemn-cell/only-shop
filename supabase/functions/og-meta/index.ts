import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_NAME = "Онли";
const SITE_URL = "https://only.mn";
const DEFAULT_IMAGE = "https://only.mn/pwa-icon-512.png";
const DEFAULT_DESC = "Бид Хятад, Америк, Солонгос, Япон улсуудаас хүссэн бүхнээ хамгийн хялбараар захиалах боломжийг танд олгож байна.";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildHtml(title: string, description: string, image: string, url: string): string {
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
  <meta property="og:type" content="product">
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "product";
    const idOrSlug = url.searchParams.get("id") || "";

    if (!idOrSlug) {
      return new Response(buildHtml(SITE_NAME, DEFAULT_DESC, DEFAULT_IMAGE, SITE_URL), {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
        buildHtml(title + priceText, description, image, productUrl),
        {
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        }
      );
    }

    // OT product
    if (type === "ot-product") {
      // For OT products, we'd need to call the OT API. For now return default.
      const productUrl = `${SITE_URL}/ot/product/${idOrSlug}`;
      return new Response(
        buildHtml(SITE_NAME, DEFAULT_DESC, DEFAULT_IMAGE, productUrl),
        { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
      );
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
