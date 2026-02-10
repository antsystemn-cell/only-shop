// ─── OT API Response Normalizer ──────────────────────────────
// Strips technical metadata (ErrorCode, RequestId, RequestTime)
// and returns only the business data from Result.

export interface OtNormalized<T = unknown> {
  success: boolean;
  data: T | null;
  error?: string;
}

export function normalizeOtResponse<T = unknown>(response: unknown): OtNormalized<T> {
  if (!response || typeof response !== "object") {
    return { success: false, data: null, error: "Empty response" };
  }

  const r = response as Record<string, unknown>;

  // Handle already-normalized responses from our proxy
  if ("success" in r && r.success === false) {
    return { success: false, data: null, error: (r.error as string) || "Unknown error" };
  }

  // Handle raw OT API responses
  if ("ErrorCode" in r) {
    if (r.ErrorCode !== "Ok") {
      return { success: false, data: null, error: `OT API: ${r.ErrorCode}` };
    }
    return { success: true, data: (r.Result ?? r) as T };
  }

  // Passthrough if already clean data
  return { success: true, data: r as T };
}

// ─── Typed Interfaces for Instance Info ──────────────────────

export interface OtInstanceInfo {
  WebSite?: string;
  AdminPanelLanguage?: string;
  DefaultItemProvider?: string;
  IsEmailConfirmationUsed?: boolean;
  IsIPCheckUsed?: boolean;
  ConfirmationCodeKind?: string;
  AllowedIPs?: string[];
  AvailableLanguages?: Array<{ Name: string; Description: string }>;
  Features?: Array<{ Name: string; Description: string }>;
  Hosting?: {
    Name?: string;
    ActivationDate?: string;
    ExpirationDate?: string;
    FreeSslEnabled?: boolean;
  };
  Tariff?: {
    Id?: number;
    Name?: string;
    CallPrice?: number;
    FixedPrice?: number;
    MinimumRent?: number;
    IsActual?: boolean;
    IsEnabled?: boolean;
    IsPrepaid?: boolean;
    PrepaidCallLimit?: number;
    SubAmount?: number;
    TurnoverPercent?: number;
  };
  Account?: {
    Balance?: number;
    Debt?: number;
    Prepayment?: number;
  };
}

export interface OtCallStatistics {
  CallCount?: number;
  DailyCallCount?: number;
  WeeklyCallCount?: number;
  MonthlyCallCount?: number;
  ActiveInstances?: number;
  ActiveTestInstances?: number;
  OtapiAllCallStatistics?: {
    TotalCount?: number;
    StatisticsByTimePeriod?: {
      DailyCallCount?: number;
      WeeklyCallCount?: number;
      MonthlyCallCount?: number;
    };
  };
  OtapiCallStatistics?: {
    TotalCount?: number;
    StatisticsByTimePeriod?: {
      DailyCallCount?: number;
      WeeklyCallCount?: number;
      MonthlyCallCount?: number;
    };
  };
}
