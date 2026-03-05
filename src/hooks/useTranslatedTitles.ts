import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// Global in-memory cache shared across all hook instances
const globalCache = new Map<string, string>();
// Track in-flight requests to avoid duplicates
let pendingTitles = new Set<string>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

async function flushBatch() {
  if (pendingTitles.size === 0) return;
  const titles = Array.from(pendingTitles);
  pendingTitles = new Set();

  try {
    const { data, error } = await supabase.functions.invoke("translate-titles", {
      body: { titles },
    });

    if (error) {
      console.error("Translation error:", error);
      return;
    }

    const translations = data?.translations as Record<string, string> | undefined;
    if (translations) {
      for (const [original, translated] of Object.entries(translations)) {
        globalCache.set(original, translated);
      }
      notifyListeners();
    }
  } catch (e) {
    console.error("Translation fetch error:", e);
  }
}

function requestTranslation(title: string) {
  if (globalCache.has(title) || pendingTitles.has(title)) return;
  pendingTitles.add(title);

  // Debounce: collect titles for 100ms then send batch
  if (batchTimer) clearTimeout(batchTimer);
  batchTimer = setTimeout(flushBatch, 100);
}

/**
 * Hook that returns a function to get the translated title.
 * Automatically batches and caches translations.
 */
export function useTranslatedTitles(titles: string[]): Record<string, string> {
  const [, forceUpdate] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const listener = () => {
      if (mountedRef.current) forceUpdate((n) => n + 1);
    };
    listeners.add(listener);
    return () => {
      mountedRef.current = false;
      listeners.delete(listener);
    };
  }, []);

  // Request translations for any uncached titles
  useEffect(() => {
    for (const title of titles) {
      if (title) requestTranslation(title);
    }
  }, [titles.join("|")]);

  // Build result from cache
  const result: Record<string, string> = {};
  for (const title of titles) {
    if (title && globalCache.has(title)) {
      result[title] = globalCache.get(title)!;
    }
  }
  return result;
}

/**
 * Hook for a single title translation
 */
export function useTranslatedTitle(title: string | undefined): string | undefined {
  const titles = title ? [title] : [];
  const translations = useTranslatedTitles(titles);
  return title ? translations[title] : undefined;
}
