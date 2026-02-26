"use client";

type ServiceWorkerRegistrationStatus =
  | "unsupported"
  | "supported"
  | "registered"
  | "error";

export interface ServiceWorkerState {
  status: ServiceWorkerRegistrationStatus;
  error?: string;
  controller?: ServiceWorker;
}

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerState> {
  if (typeof window === "undefined") {
    return { status: "unsupported" };
  }

  if (!("serviceWorker" in navigator)) {
    return { status: "unsupported" };
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    console.log(
      "[Service Worker] Registered successfully with scope:",
      registration.scope
    );

    return {
      status: "registered",
      controller: registration.active ?? undefined,
    };
  } catch (error) {
    console.error("[Service Worker] Registration failed:", error);
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<void> {
  if (typeof window === "undefined") return;

  if (!("serviceWorker" in navigator)) {
    console.warn("[Service Worker] Not supported in this browser");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.unregister();
      console.log("[Service Worker] Unregistered successfully");
    }
  } catch (error) {
    console.error("[Service Worker] Unregistration failed:", error);
  }
}

/**
 * Get the current service worker state
 */
export async function getServiceWorkerState(): Promise<ServiceWorkerState> {
  if (typeof window === "undefined") {
    return { status: "unsupported" };
  }

  if (!("serviceWorker" in navigator)) {
    return { status: "unsupported" };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const controller = navigator.serviceWorker.controller;

    if (registration && registration.active) {
      return {
        status: "registered",
        controller: registration.active,
      };
    }

    if (controller) {
      return {
        status: "registered",
        controller,
      };
    }

    return { status: "supported" };
  } catch (error) {
    console.error("[Service Worker] Failed to get state:", error);
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Skip waiting for the service worker to become active
 * (useful for forcing updates)
 */
export async function skipWaiting(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  } catch (error) {
    console.error("[Service Worker] Failed to skip waiting:", error);
  }
}

/**
 * Add a listener for service worker controller changes
 */
export function onControllerChange(
  callback: () => void,
): () => void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return () => {
      // No-op when service worker is not supported
    };
  }

  const handler = () => {
    console.log("[Service Worker] Controller changed");
    callback();
  };

  navigator.serviceWorker.addEventListener("controllerchange", handler);

  // Return cleanup function
  return () => {
    navigator.serviceWorker.removeEventListener("controllerchange", handler);
  };
}
