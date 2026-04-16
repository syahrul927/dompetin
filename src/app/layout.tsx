import "@/styles/globals.css";

import { TRPCReactProvider } from "@/trpc/react";
import { type Metadata } from "next";
import { DM_Sans } from "next/font/google";
import Script from "next/script";
import { env } from "@/env";

// PWA Components
import { OfflineIndicator } from "@/components/pwa/offline-indicator";

// PWA Utilities (only on client side)
import { registerServiceWorker } from "@/lib/pwa/service-worker-registration";

import { WorkspaceProvider } from "@/components/providers/workspace-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AppShell } from "@/components/shared/AppShell";
import { InstallPrompt } from "@/components/pwa/install-prompt";

export const metadata: Metadata = {
  title: "Dompetin - Catat Keuangan Tanpa Ribet",
  description: "Aplikasi pencatat keuangan pribadi dengan fitur scan struk AI. Catat pemasukan dan pengeluaran harian jadi lebih gampang.",
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

        {/* Apple Splash Screens — portrait only */}
        {/* iPhone 5/5S/SE (1st gen) */}
        <link rel="apple-touch-startup-image" href="/splash/splash-640x1136.png" media="screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        {/* iPhone 6/7/8/SE (2nd/3rd gen) */}
        <link rel="apple-touch-startup-image" href="/splash/splash-750x1334.png" media="screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        {/* iPhone 6+/7+/8+ */}
        <link rel="apple-touch-startup-image" href="/splash/splash-1242x2208.png" media="screen and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        {/* iPhone X/XS/11 Pro */}
        <link rel="apple-touch-startup-image" href="/splash/splash-1125x2436.png" media="screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        {/* iPhone XR/11 */}
        <link rel="apple-touch-startup-image" href="/splash/splash-828x1792.png" media="screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        {/* iPhone XS Max/11 Pro Max */}
        <link rel="apple-touch-startup-image" href="/splash/splash-1242x2688.png" media="screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        {/* iPhone 12/13/14 */}
        <link rel="apple-touch-startup-image" href="/splash/splash-1170x2532.png" media="screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        {/* iPhone 14 Pro/15/15 Pro */}
        <link rel="apple-touch-startup-image" href="/splash/splash-1179x2556.png" media="screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        {/* iPhone 14 Pro Max/15 Plus/15 Pro Max */}
        <link rel="apple-touch-startup-image" href="/splash/splash-1290x2796.png" media="screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        {/* iPhone 16 Pro Max */}
        <link rel="apple-touch-startup-image" href="/splash/splash-1320x2868.png" media="screen and (device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        {/* iPad */}
        <link rel="apple-touch-startup-image" href="/splash/splash-1536x2048.png" media="screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        {/* iPad Pro 10.5" */}
        <link rel="apple-touch-startup-image" href="/splash/splash-1668x2224.png" media="screen and (device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        {/* iPad Pro 11" */}
        <link rel="apple-touch-startup-image" href="/splash/splash-1668x2388.png" media="screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        {/* iPad Pro 12.9" */}
        <link rel="apple-touch-startup-image" href="/splash/splash-2048x2732.png" media="screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
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
                {process.env.NODE_ENV === "production" && env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && env.NEXT_PUBLIC_UMAMI_URL && (
                  <Script
                    defer
                    src={`${env.NEXT_PUBLIC_UMAMI_URL}/script.js`}
                    data-website-id={env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
                    strategy="afterInteractive"
                  />
                )}
              </AppShell>
            </WorkspaceProvider>
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
