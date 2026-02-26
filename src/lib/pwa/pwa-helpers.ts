"use client";

export type PWAPlatform = "desktop" | "android" | "ios" | "unknown";

export interface PWAInstallState {
  canInstall: boolean;
  isInstalled: boolean;
  platform: PWAPlatform;
  dismissed: boolean;
}

const DISMISS_KEY = "dompetin-pwa-install-dismissed";

/**
 * Detect the current platform based on user agent
 */
export function detectPlatform(): PWAPlatform {
  if (typeof window === "undefined") return "unknown";

  const userAgent = window.navigator.userAgent;

  // iOS detection
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) ||
    (userAgent.includes("Mac") && "ontouchend" in document);
  if (isIOS) return "ios";

  // Android detection
  const isAndroid = userAgent.includes("Android");
  if (isAndroid) return "android";

  // Desktop detection
  if (
    userAgent.includes("Windows") ||
    userAgent.includes("Macintosh") ||
    userAgent.includes("Mac OS X") ||
    userAgent.includes("Linux")
  ) {
    return "desktop";
  }

  return "unknown";
}

/**
 * Check if the PWA is installed (running in standalone mode)
 */
export function isPWAInstalled(): boolean {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error - iOS standalone mode
    window.navigator.standalone === true ||
    document.referrer?.includes("android-app://")
  );
}

/**
 * Check if the install prompt has been dismissed
 */
export function isInstallDismissed(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return localStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Mark the install prompt as dismissed
 */
export function dismissInstall(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(DISMISS_KEY, "true");
  } catch {
    // Ignore storage errors
  }
}

/**
 * Reset the dismissed state (for testing or re-prompting)
 */
export function resetInstallDismissed(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(DISMISS_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get the current PWA install state
 */
export function getPWAInstallState(): PWAInstallState {
  return {
    canInstall: false, // Will be updated by the install component
    isInstalled: isPWAInstalled(),
    platform: detectPlatform(),
    dismissed: isInstallDismissed(),
  };
}

/**
 * Check if the current browser supports PWA installation
 */
export function supportsPWAInstall(): boolean {
  if (typeof window === "undefined") return false;

  // iOS doesn't support beforeinstallprompt, but can be installed via "Add to Home Screen"
  const platform = detectPlatform();
  if (platform === "ios") return true;

  // Chrome/Edge on desktop and Android support beforeinstallprompt
  return "beforeinstallprompt" in window;
}

/**
 * Check if the app can show the install prompt
 * (not dismissed, not already installed, and supports installation)
 */
export function canShowInstallPrompt(): boolean {
  return (
    !isInstallDismissed() &&
    !isPWAInstalled() &&
    supportsPWAInstall()
  );
}

/**
 * Get the install instructions based on platform
 */
export function getInstallInstructions(platform: PWAPlatform): string {
  switch (platform) {
    case "ios":
      return "To install: Tap the Share button, then 'Add to Home Screen'";
    case "android":
      return "To install: Tap the menu button, then 'Install app' or 'Add to Home Screen'";
    case "desktop":
      return "To install: Click the install button in the address bar";
    default:
      return "This app can be installed on your device";
  }
}
