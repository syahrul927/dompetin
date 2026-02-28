import "@/styles/globals.css";

import { TRPCReactProvider } from "@/trpc/react";
import { type Metadata } from "next";
import { DM_Sans } from "next/font/google";

// PWA Components
import { OfflineIndicator } from "@/components/pwa/offline-indicator";

// PWA Utilities (only on client side)
import { registerServiceWorker } from "@/lib/pwa/service-worker-registration";

import { WorkspaceProvider } from "@/components/providers/workspace-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AppShell } from "@/components/shared/AppShell";
import { InstallPrompt } from "@/components/pwa/install-prompt";

export const metadata: Metadata = {
  title: "Dompetin - Personal Finance Management",
  description: "Manage your personal finances with Dompetin",
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    {
      rel: "apple-touch-icon",
      url: "/icons/icon-180x180.png",
      sizes: "180x180",
    },
  ],
  manifest: "/manifest.json",
  themeColor: "#E8A0A8",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dompetin",
  },
  formatDetection: {
    telephone: false,
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

const fontSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

// Register service worker on client side
if (typeof window !== "undefined") {
  void registerServiceWorker().then((state) => {
    if (state.status === "error") {
      console.warn("[PWA] Service worker registration failed:", state.error);
    }
  });
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fontSans.variable}`} suppressHydrationWarning>
      <head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="Dompetin" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Dompetin" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#E8A0A8" />
        <meta name="theme-color" content="#E8A0A8" />

        {/* Apple Splash Screens */}
        <link rel="apple-touch-startup-image" href="/splash/splash-750x1334.png" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1125x2436.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1242x2208.png" media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1536x2048.png" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1668x2224.png" media="(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-2048x2732.png" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)" />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCReactProvider>
            <WorkspaceProvider>
              <AppShell>
                {children}
                <InstallPrompt />
                <OfflineIndicator />
              </AppShell>
            </WorkspaceProvider>
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
