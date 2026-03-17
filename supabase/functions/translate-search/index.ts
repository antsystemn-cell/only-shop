import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Detect Cyrillic (Mongolian) characters
const CYRILLIC_RE = /[\u0400-\u04FF]/;
// Detect Latin (English) characters
const LATIN_RE = /[a-zA-Z]/;
// Detect Chinese characters
const CHINESE_RE = /[\u4e00-\u9fff]/;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { query, fromLang } = (await req.json()) as { query: string; fromLang?: string };

    if (!query?.trim()) {
      return new Response(JSON.stringify({ translated: query || "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine source language and whether translation is needed
    const hasCyrillic = CYRILLIC_RE.test(query);
    const hasLatin = LATIN_RE.test(query);
    const hasChinese = CHINESE_RE.test(query);

    // If explicit fromLang="en", translate English→Chinese
    // If Cyrillic detected, translate Mongolian→Chinese
    // If already Chinese or no translatable text, return as-is
    let sourceLang: string | null = null;
    if (fromLang === "en" && hasLatin && !hasChinese) {
      sourceLang = "en";
    } else if (hasCyrillic) {
      sourceLang = "mn";
    }

    if (!sourceLang) {
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

    const systemPrompt = sourceLang === "en"
      ? "You are a translator. Translate the user's English search query into Chinese (Simplified) for searching products on Chinese e-commerce platforms. Return ONLY the Chinese translation, nothing else. No explanations, no quotes, no extra text. If the input contains brand names, translate them to how they are commonly known in Chinese e-commerce (e.g., 'Dior' → 'Dior迪奥', 'Penhaligons' → '潘海利根'). Keep model numbers and sizes as-is."
      : "You are a translator. Translate the user's Mongolian search query into Chinese (Simplified). Return ONLY the Chinese translation, nothing else. No explanations, no quotes, no extra text. If the input contains brand names or English words, keep them as-is.";

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
            { role: "system", content: systemPrompt },
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