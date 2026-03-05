import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { titles } = await req.json() as { titles: string[] };
    if (!titles?.length) {
      return new Response(JSON.stringify({ translations: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit batch size
    const batch = titles.slice(0, 30);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Check cache
    const { data: cached } = await supabase
      .from("title_translations")
      .select("original_text, translated_text")
      .in("original_text", batch);

    const translations: Record<string, string> = {};
    const cachedSet = new Set<string>();
    if (cached) {
      for (const row of cached) {
        translations[row.original_text] = row.translated_text;
        cachedSet.add(row.original_text);
      }
    }

    // 2. Find uncached titles
    const uncached = batch.filter((t) => !cachedSet.has(t));
    if (uncached.length === 0) {
      return new Response(JSON.stringify({ translations }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Call Lovable AI Gateway for translation
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Return originals if no API key
      for (const t of uncached) translations[t] = t;
      return new Response(JSON.stringify({ translations }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const numberedList = uncached.map((t, i) => `${i + 1}. ${t}`).join("\n");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a product title translator. Translate product titles to Mongolian (Монгол хэл).
Rules:
- Keep brand names in original language (Nike, Adidas, Apple, etc.)
- Keep model numbers/codes as-is
- Translate descriptive words to natural Mongolian
- Keep it concise - product title style, not a sentence
- If the title is already in English, translate the descriptive parts to Mongolian
- Return ONLY the numbered translations, one per line, matching the input numbering
- Format: "1. translated title" (one per line)
- Do NOT add any explanation or extra text`,
          },
          {
            role: "user",
            content: `Translate these product titles to Mongolian:\n${numberedList}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI gateway error:", aiResponse.status, await aiResponse.text());
      for (const t of uncached) translations[t] = t;
      return new Response(JSON.stringify({ translations }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse numbered responses
    const lines = content.split("\n").filter((l: string) => l.trim());
    const newTranslations: { original_text: string; translated_text: string }[] = [];

    for (const line of lines) {
      const match = line.match(/^\d+\.\s*(.+)/);
      if (match) {
        const idx = parseInt(line) - 1;
        if (idx >= 0 && idx < uncached.length) {
          const translated = match[1].trim();
          translations[uncached[idx]] = translated;
          newTranslations.push({
            original_text: uncached[idx],
            translated_text: translated,
          });
        }
      }
    }

    // Fill any missing with originals
    for (const t of uncached) {
      if (!translations[t]) translations[t] = t;
    }

    // 4. Cache new translations
    if (newTranslations.length > 0) {
      await supabase
        .from("title_translations")
        .upsert(newTranslations, { onConflict: "original_text", ignoreDuplicates: true });
    }

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-titles error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
