import { supabase } from "@/integrations/supabase/client";

// ─── OT API Session Manager ─────────────────────────────────
// Handles operator and anonymous sessions with caching

const SESSION_CACHE: Record<string, { id: string; expiresAt: number }> = {};
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

async function callProxy<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ot-api", {
    body: { action, params },
  });
  if (error) throw new Error(`OT API proxy error: ${error.message}`);
  if (data?.error) throw new Error(`OT API error: ${data.error}`);
  return data as T;
}

// ─── Operator Session ────────────────────────────────────────

interface SessionResponse {
  SessionId?: { Value?: string };
  ErrorCode?: string;
}

export async function getOperatorSession(): Promise<string> {
  const cached = SESSION_CACHE["operator"];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.id;
  }

  const data = await callProxy<SessionResponse>("authenticateOperator", {});

  const sessionId = data?.SessionId?.Value;
  if (!sessionId) {
    throw new Error("Оператор session авч чадсангүй. Нэвтрэх мэдээлэл буруу байж болзошгүй.");
  }

  SESSION_CACHE["operator"] = {
    id: sessionId,
    expiresAt: Date.now() + SESSION_TTL,
  };

  return sessionId;
}

// ─── Anonymous Session (for storefront users) ────────────────

export async function getAnonymousSession(): Promise<string> {
  const cached = SESSION_CACHE["anonymous"];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.id;
  }

  const data = await callProxy<SessionResponse>("getAnonymousSession", {});

  const sessionId = data?.SessionId?.Value;
  if (!sessionId) {
    throw new Error("Anonymous session авч чадсангүй");
  }

  SESSION_CACHE["anonymous"] = {
    id: sessionId,
    expiresAt: Date.now() + SESSION_TTL,
  };

  return sessionId;
}

// ─── Session-aware API caller ────────────────────────────────
// Wraps any OT API call that requires sessionId

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
  delete SESSION_CACHE["operator"];
  delete SESSION_CACHE["anonymous"];
}
