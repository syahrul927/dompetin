import "@/styles/globals.css";

import { TRPCReactProvider } from "@/trpc/react";
import { type Metadata } from "next";
import { DM_Sans } from "next/font/google";

// PWA Components
import { OfflineIndicator } from "@/components/pwa/offline-indicator";

// PWA Utilities (only on client side)
import { registerServiceWorker } from "@/lib/pwa/service-worker-registration";

import { WorkspaceProvider } from "@/components/providers/workspace-provider";
import { AppShell } from "@/components/shared/AppShell";

export const metadata: Metadata = {
  title: "Dompetin - Personal Finance Management",
  description: "Manage your personal finances with Dompetin",
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    {
      rel: "apple-touch-icon",
      url: "/icons/icon-192x192.png",
      sizes: "192x192",
    },
  ],
  manifest: "/manifest.json",
  themeColor: "#000000",
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
    <html lang="en" className={`${fontSans.variable}`}>
      <head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="Dompetin" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Dompetin" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body>
        <TRPCReactProvider>
          <WorkspaceProvider>
            <AppShell>
              {children}
              <OfflineIndicator />
            </AppShell>
          </WorkspaceProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
