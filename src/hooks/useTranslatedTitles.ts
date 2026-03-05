import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// Global in-memory cache shared across all hook instances
const globalCache = new Map<string, string>();
// Track in-flight requests to avoid duplicates
let pendingTitles = new Set<string>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

// Translation mode: "ai" or "default"
let translationMode: "ai" | "default" | null = null;
let modeLoading = false;

function isLikelyMongolian(text: string): boolean {
  // Cyrillic block + Mongolian-specific letters
  return /[\u0400-\u04FFӨөҮүЁё]/.test(text);
}

function containsChinese(text: string): boolean {
  // CJK Unified Ideographs
  return /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text);
}

async function loadTranslationMode() {
  if (translationMode !== null || modeLoading) return;
  modeLoading = true;
  try {
    const { data } = await supabase
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", "translation_mode")
      .maybeSingle();
    if (data?.setting_value) {
      const val = typeof data.setting_value === "string" ? JSON.parse(data.setting_value) : data.setting_value;
      translationMode = val === "ai" ? "ai" : "default";
    } else {
      translationMode = "ai"; // default to AI
    }
  } catch {
    translationMode = "ai";
  }
  modeLoading = false;
}

// Allow external reset (e.g. when admin changes setting)
export function resetTranslationMode() {
  translationMode = null;
  modeLoading = false;
}

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

async function flushBatch() {
  if (pendingTitles.size === 0) return;

  // Ensure mode is loaded
  await loadTranslationMode();

  const titles = Array.from(pendingTitles);
  pendingTitles = new Set();

  // In "default" mode, OTAPI title is preferred.
  // But many providers return Chinese title even for khk, so we only fallback-translate
  // titles that don't look Mongolian.
  // In "default" mode: only translate titles containing Chinese characters
  // (skip English-only or already-Mongolian titles)
  // In "ai" mode: translate everything that has Chinese; skip already-Mongolian
  const titlesToTranslate = titles.filter((title) => {
    if (!title) return false;
    if (isLikelyMongolian(title)) return false;
    if (!containsChinese(title)) return false;
    return true;
  });

  if (titlesToTranslate.length === 0) return;

  try {
    const { data, error } = await supabase.functions.invoke("translate-titles", {
      body: { titles: titlesToTranslate },
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

    // Ensure translation mode is loaded
    loadTranslationMode();

    return () => {
      mountedRef.current = false;
      listeners.delete(listener);
    };
  }, []);

  // Request translations for any uncached titles.
  // Mode-specific filtering is handled inside flushBatch().
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
