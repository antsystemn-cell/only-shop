import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// ── Types ────────────────────────────────────────────────────
export interface ViewedItem {
  provider: string;
  provider_product_id: string;
  canonical_key: string; // e.g. "poizon:123", "local:uuid", "taobao:456"
  title_snapshot: string;
  image_snapshot: string;
  price_snapshot: number;
  currency: string;
  product_url: string;
}

interface StoredItem extends ViewedItem {
  first_viewed_at: string;
  last_viewed_at: string;
  view_count: number;
}

// ── Provider helpers ─────────────────────────────────────────
export const PROVIDER_CONFIG: Record<string, { label: string; color: string }> = {
  poizon: { label: "Poizon", color: "bg-emerald-500" },
  dewu: { label: "Poizon", color: "bg-emerald-500" },
  taobao: { label: "Taobao", color: "bg-orange-500" },
  tmall: { label: "Tmall", color: "bg-red-500" },
  local: { label: "Ready", color: "bg-primary" },
  warehouse: { label: "Агуулах", color: "bg-blue-500" },
};

export function getProviderLabel(provider: string): string {
  return PROVIDER_CONFIG[provider.toLowerCase()]?.label ?? provider;
}

export function getUniqueProviders(items: StoredItem[]): string[] {
  const set = new Set(items.map((i) => normalizeProvider(i.provider)));
  return Array.from(set);
}

function normalizeProvider(p: string): string {
  const lower = p.toLowerCase();
  if (lower === "dewu") return "poizon";
  return lower;
}

// ── Local Storage (guest) ────────────────────────────────────
const LS_KEY = "only_recently_viewed";
const MAX_LOCAL_ITEMS = 150;

function getLocalHistory(): StoredItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalHistory(items: StoredItem[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items.slice(0, MAX_LOCAL_ITEMS)));
  } catch { /* quota exceeded – silently ignore */ }
}

function addToLocalHistory(item: ViewedItem) {
  const now = new Date().toISOString();
  const items = getLocalHistory();
  const idx = items.findIndex((i) => i.canonical_key === item.canonical_key);
  if (idx >= 0) {
    items[idx] = {
      ...items[idx],
      ...item,
      last_viewed_at: now,
      view_count: items[idx].view_count + 1,
    };
    // Move to front (most recent)
    const [moved] = items.splice(idx, 1);
    items.unshift(moved);
  } else {
    items.unshift({
      ...item,
      first_viewed_at: now,
      last_viewed_at: now,
      view_count: 1,
    });
  }
  setLocalHistory(items);
}

export function clearLocalHistory() {
  localStorage.removeItem(LS_KEY);
}

// ── DB sync (logged-in) ─────────────────────────────────────
const syncQueue: ViewedItem[] = [];
let syncTimer: ReturnType<typeof setTimeout> | null = null;

async function flushSyncQueue(userId: string) {
  if (syncQueue.length === 0) return;
  const batch = syncQueue.splice(0, syncQueue.length);
  const now = new Date().toISOString();

  // Upsert with ON CONFLICT
  for (const item of batch) {
    await supabase.from("recently_viewed" as any).upsert(
      {
        user_id: userId,
        provider: item.provider,
        provider_product_id: item.provider_product_id,
        canonical_key: item.canonical_key,
        title_snapshot: item.title_snapshot,
        image_snapshot: item.image_snapshot,
        price_snapshot: item.price_snapshot,
        currency: item.currency,
        product_url: item.product_url,
        last_viewed_at: now,
      } as any,
      { onConflict: "user_id,canonical_key" as any }
    );
  }
}

function enqueueSyncItem(item: ViewedItem, userId: string) {
  // Dedupe in queue
  const idx = syncQueue.findIndex((i) => i.canonical_key === item.canonical_key);
  if (idx >= 0) syncQueue[idx] = item;
  else syncQueue.push(item);

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => flushSyncQueue(userId), 2000);
}

// ── Merge guest → DB on login ────────────────────────────────
export async function mergeGuestHistoryToDb(userId: string) {
  const local = getLocalHistory();
  if (local.length === 0) return;

  // Batch upsert (fire-and-forget)
  const now = new Date().toISOString();
  for (const item of local.slice(0, 100)) {
    await supabase.from("recently_viewed" as any).upsert(
      {
        user_id: userId,
        provider: item.provider,
        provider_product_id: item.provider_product_id,
        canonical_key: item.canonical_key,
        title_snapshot: item.title_snapshot,
        image_snapshot: item.image_snapshot,
        price_snapshot: item.price_snapshot,
        currency: item.currency,
        product_url: item.product_url,
        last_viewed_at: item.last_viewed_at > now ? now : item.last_viewed_at,
        first_viewed_at: item.first_viewed_at,
        view_count: item.view_count,
      } as any,
      { onConflict: "user_id,canonical_key" as any }
    );
  }
  clearLocalHistory();
}

// ── Cooldown map (prevent repeated writes within 60s) ────────
const cooldownMap = new Map<string, number>();
const COOLDOWN_MS = 60_000;

// ── Main tracking hook ───────────────────────────────────────
export function useTrackRecentlyViewed() {
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  const track = useCallback((item: ViewedItem) => {
    // Cooldown check
    const lastTime = cooldownMap.get(item.canonical_key) || 0;
    if (Date.now() - lastTime < COOLDOWN_MS) return;
    cooldownMap.set(item.canonical_key, Date.now());

    // Always save locally (for guest fallback)
    addToLocalHistory(item);

    // If logged in, also queue DB sync
    if (userRef.current?.id) {
      enqueueSyncItem(item, userRef.current.id);
    }
  }, []);

  return track;
}

// ── Hook for login merge ─────────────────────────────────────
export function useRecentlyViewedLoginMerge() {
  const { user } = useAuth();
  const mergedRef = useRef(false);

  useEffect(() => {
    if (user?.id && !mergedRef.current) {
      mergedRef.current = true;
      mergeGuestHistoryToDb(user.id).catch(() => {});
    }
    if (!user) mergedRef.current = false;
  }, [user]);
}

// ── Exported getter for local items ──────────────────────────
export { getLocalHistory };
export type { StoredItem };
