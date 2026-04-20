// Meta (Facebook) Pixel helper utilities
// Pixel is initialized in index.html. These helpers safely fire events.

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

const DEBUG = import.meta.env.DEV;

function safeFbq(...args: any[]) {
  if (typeof window === "undefined") return;
  if (typeof window.fbq !== "function") {
    if (DEBUG) console.warn("[MetaPixel] fbq not loaded yet:", args);
    return;
  }
  try {
    window.fbq(...args);
    if (DEBUG) console.log("[MetaPixel]", ...args);
  } catch (e) {
    if (DEBUG) console.error("[MetaPixel] error", e);
  }
}

export function trackPageView() {
  safeFbq("track", "PageView");
}

export function trackViewContent(params: {
  content_name?: string;
  content_ids?: (string | number)[];
  value?: number;
  currency?: string;
}) {
  safeFbq("track", "ViewContent", {
    content_type: "product",
    currency: "MNT",
    ...params,
  });
}

export function trackAddToCart(params: {
  content_name?: string;
  content_ids?: (string | number)[];
  value?: number;
  currency?: string;
}) {
  safeFbq("track", "AddToCart", {
    content_type: "product",
    currency: "MNT",
    ...params,
  });
}

export function trackInitiateCheckout(params?: {
  content_ids?: (string | number)[];
  value?: number;
  currency?: string;
  num_items?: number;
}) {
  safeFbq("track", "InitiateCheckout", {
    currency: "MNT",
    ...params,
  });
}

export function trackPurchase(params: {
  value: number;
  currency?: string;
  content_ids?: (string | number)[];
  order_id?: string;
}) {
  safeFbq("track", "Purchase", {
    currency: "MNT",
    ...params,
  });
}
