import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Detect Cyrillic (Mongolian) characters
const CYRILLIC_RE = /[\u0400-\u04FF]/;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { query } = (await req.json()) as { query: string };

    if (!query?.trim()) {
      return new Response(JSON.stringify({ translated: query || "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only translate if contains Cyrillic (Mongolian)
    if (!CYRILLIC_RE.test(query)) {
      return new Response(JSON.stringify({ translated: query }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ translated: query }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content:
                "You are a translator. Translate the user's Mongolian search query into Chinese (Simplified). Return ONLY the Chinese translation, nothing else. No explanations, no quotes, no extra text. If the input contains brand names or English words, keep them as-is.",
            },
            { role: "user", content: query },
          ],
          stream: false,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429 || response.status === 402) {
        console.warn("AI rate limited, returning original query");
        return new Response(JSON.stringify({ translated: query }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ translated: query }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const translated =
      data.choices?.[0]?.message?.content?.trim() || query;

    return new Response(JSON.stringify({ translated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("translate-search error:", err);
    return new Response(
      JSON.stringify({ translated: "" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
