"use client";

import { useEffect, useState } from "react";
import { detectPlatform, canShowInstallPrompt, dismissInstall } from "@/lib/pwa/pwa-helpers";
import { useAnalytics } from "@/hooks/use-analytics";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [platform, setPlatform] = useState("desktop");
  const [isInstalling, setIsInstalling] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    // Detect platform
    const detectedPlatform = detectPlatform();
    setPlatform(detectedPlatform);

    // Check if we can show the prompt
    if (!canShowInstallPrompt()) {
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as InstallPromptEvent);

      // Delay showing the banner for better UX
      setTimeout(() => {
        if (canShowInstallPrompt()) {
          setShowBanner(true);
          trackEvent("pwa_banner_shown", { platform: detectPlatform() });
          // Trigger animation
          setTimeout(() => setIsVisible(true), 50);
        }
      }, 2000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowBanner(false);
      setIsVisible(false);
      trackEvent("pwa_installed", { method: "banner" });
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    // For iOS, show banner after more page views or time
    if (detectedPlatform === "ios") {
      const pageViews = Number.parseInt(
        localStorage.getItem("dompetin-page-views") ?? "0",
        10,
      );
      const newPageViews = pageViews + 1;
      localStorage.setItem("dompetin-page-views", newPageViews.toString());

      // Show after 3 page views or 60 seconds
      if (newPageViews >= 3) {
        setTimeout(() => {
          if (canShowInstallPrompt()) {
            setShowBanner(true);
            trackEvent("pwa_banner_shown", { platform: "ios" });
            setTimeout(() => setIsVisible(true), 50);
          }
        }, 1000);
      }
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [platform, trackEvent]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // For iOS or when no deferred prompt is available
      const instructions =
        platform === "ios"
          ? "To install: Tap the Share button, then 'Add to Home Screen'"
          : "To install: Look for the install icon in your browser's menu";
      alert(instructions);
      trackEvent("pwa_banner_instructions_viewed", { platform });
      return;
    }

    setIsInstalling(true);
    trackEvent("pwa_banner_install_clicked", { platform });

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        console.log("[PWA] User accepted the install prompt");
        trackEvent("pwa_banner_install_accepted", { platform });
      } else {
        console.log("[PWA] User dismissed the install prompt");
        trackEvent("pwa_banner_install_dismissed", { platform });
      }

      setDeferredPrompt(null);
      setShowBanner(false);
      setIsVisible(false);
    } catch (error) {
      console.error("[PWA] Install banner error:", error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      setShowBanner(false);
    }, 300); // Wait for animation to complete
    dismissInstall();
    trackEvent("pwa_banner_dismissed", { platform });
  };

  if (!showBanner) {
    return null;
  }

  const isIOS = platform === "ios";

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 bg-background border-b border-border shadow-md transition-all duration-300 ${
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3 flex-1">
            {/* App icon placeholder */}
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">D</span>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground truncate">
                Dompetin
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                Personal finance management
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isInstalling ? "Installing..." : isIOS ? "GET" : "INSTALL"}
              </button>
              <button
                onClick={handleDismiss}
                className="inline-flex items-center justify-center p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
                aria-label="Close"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
