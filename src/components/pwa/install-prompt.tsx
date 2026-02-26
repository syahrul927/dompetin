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
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-background border-border rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-foreground">
              Install Dompetin
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {getInstallInstructions(platform)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isInstalling ? "Installing..." : "Install"}
            </button>
            <button
              onClick={handleDismiss}
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-2 py-1.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
