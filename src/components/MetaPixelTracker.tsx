import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/metaPixel";

/**
 * Fires Meta Pixel PageView on every SPA route change.
 * The initial PageView fires from index.html, so we skip the first mount
 * to avoid duplicate events.
 */
export function MetaPixelTracker() {
  const location = useLocation();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    trackPageView();
  }, [location.pathname, location.search]);

  return null;
}
