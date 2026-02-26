"use client";

import { useEffect, useState } from "react";
import {
  detectPlatform,
  canShowInstallPrompt,
  dismissInstall,
  getInstallInstructions,
  type PWAPlatform,
} from "@/lib/pwa/pwa-helpers";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [platform, setPlatform] = useState<PWAPlatform>("unknown");
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Detect platform
    setPlatform(detectPlatform());

    // Check if we can show the prompt
    if (!canShowInstallPrompt()) {
      return;
    }

    // Listen for beforeinstallprompt event (Chrome/Edge/Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as InstallPromptEvent);
      // Update UI to notify the user they can add to home screen
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      // Clear the deferredPrompt
      setDeferredPrompt(null);
      setShowPrompt(false);
      console.log("[PWA] App was installed");
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    // For iOS, we can show the prompt after a delay
    if (platform === "ios") {
      const timer = setTimeout(() => {
        if (canShowInstallPrompt()) {
          setShowPrompt(true);
        }
      }, 30000); // Show after 30 seconds

      return () => {
        clearTimeout(timer);
        window.removeEventListener(
          "beforeinstallprompt",
          handleBeforeInstallPrompt,
        );
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [platform]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // For iOS or when no deferred prompt is available, show instructions
      alert(getInstallInstructions(platform));
      return;
    }

    setIsInstalling(true);

    try {
      // Show the install prompt
      await deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        console.log("[PWA] User accepted the install prompt");
      } else {
        console.log("[PWA] User dismissed the install prompt");
      }

      // Clear the deferredPrompt
      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error("[PWA] Install prompt error:", error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    dismissInstall();
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed left-1/2 top-4 z-[60] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 animate-in slide-in-from-top-4 duration-300">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              Install Dompetin
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {getInstallInstructions(platform)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isInstalling ? "..." : "Install"}
            </button>
            <button
              onClick={handleDismiss}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
