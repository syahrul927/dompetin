"use client";

import { useCallback } from "react";

export function useAnalytics() {
  const trackEvent = useCallback((eventName: string, eventData?: Record<string, string | number | boolean>) => {
    if (typeof window !== "undefined" && window.umami) {
      window.umami.track(eventName, eventData);
    }
  }, []);

  return { trackEvent };
}
