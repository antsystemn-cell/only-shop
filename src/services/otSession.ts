import { supabase } from "@/integrations/supabase/client";

// ─── OT API Session Manager ─────────────────────────────────
// Handles operator and anonymous sessions with caching

const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

// Use localStorage to persist sessions across HMR reloads
function getSessionCache(): Record<string, { id: string; expiresAt: number }> {
  try {
    const raw = localStorage.getItem("ot_session_cache");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setSessionCache(key: string, value: { id: string; expiresAt: number }) {
  try {
    const cache = getSessionCache();
    cache[key] = value;
    localStorage.setItem("ot_session_cache", JSON.stringify(cache));
  } catch {
    // ignore
  }
}

async function callProxy<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ot-api", {
    body: { action, params },
  });
  if (error) throw new Error(`OT API proxy error: ${error.message}`);
  if (data?.success === false) throw new Error(data.error || "Unknown OT API error");
  if (data?.error && typeof data.error === "string") throw new Error(`OT API error: ${data.error}`);
  return data as T;
}

// ─── Operator Session ────────────────────────────────────────

interface SessionResponse {
  SessionId?: { Value?: string };
  ErrorCode?: string;
}

export async function getOperatorSession(): Promise<string> {
  const cached = getSessionCache()["operator"];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.id;
  }

  const data = await callProxy<SessionResponse>("authenticateOperator", {});

  const sessionId = data?.SessionId?.Value;
  if (!sessionId) {
    throw new Error("Оператор session авч чадсангүй. Нэвтрэх мэдээлэл буруу байж болзошгүй.");
  }

  setSessionCache("operator", {
    id: sessionId,
    expiresAt: Date.now() + SESSION_TTL,
  });

  return sessionId;
}

// ─── Anonymous Session (for storefront users) ────────────────

export async function getAnonymousSession(): Promise<string> {
  const cached = getSessionCache()["anonymous"];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.id;
  }

  const data = await callProxy<SessionResponse>("getAnonymousSession", {});

  const sessionId = data?.SessionId?.Value;
  if (!sessionId) {
    throw new Error("Anonymous session авч чадсангүй");
  }

  setSessionCache("anonymous", {
    id: sessionId,
    expiresAt: Date.now() + SESSION_TTL,
  });

  return sessionId;
}

// ─── Session-aware API caller ────────────────────────────────

export async function callWithOperatorSession<T = unknown>(
  action: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const sessionId = await getOperatorSession();
  return callProxy<T>(action, { ...params, sessionId });
}

export async function callWithAnonymousSession<T = unknown>(
  action: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const sessionId = await getAnonymousSession();
  return callProxy<T>(action, { ...params, sessionId });
}

// ─── Clear cached sessions ──────────────────────────────────

export function clearSessionCache() {
  try {
    localStorage.removeItem("ot_session_cache");
  } catch {
    // ignore
  }
}
