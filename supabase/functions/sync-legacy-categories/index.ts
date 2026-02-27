import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { mappings } = await req.json() as {
      mappings: Array<{ category_id: string; alias: string; display_order?: number }>;
    };

    if (!mappings || !Array.isArray(mappings)) {
      return new Response(JSON.stringify({ error: "mappings array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updated = 0;
    let notFound = 0;
    const batchSize = 50;

    for (let i = 0; i < mappings.length; i += batchSize) {
      const batch = mappings.slice(i, i + batchSize);
      
      for (const item of batch) {
        const updateData: Record<string, unknown> = { seo_alias: item.alias };
        if (item.display_order !== undefined) {
          updateData.display_order = item.display_order;
        }

        const { data, error } = await supabase
          .from("ot_categories")
          .update(updateData)
          .eq("internal_id", item.category_id)
          .select("id");

        if (data && data.length > 0) {
          updated++;
        } else {
          notFound++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, updated, notFound, total: mappings.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
