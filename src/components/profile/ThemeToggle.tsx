"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { useAnalytics } from "@/hooks/use-analytics";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const { trackEvent } = useAnalytics();

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-12 w-full rounded-xl bg-muted animate-pulse" />;
  }

  const handleSetTheme = (newTheme: string) => {
    setTheme(newTheme);
    trackEvent("theme_changed", { theme: newTheme });
  };

  return (
    <div className="flex w-full items-center justify-between rounded-xl bg-muted/50 p-1">
      <button
        onClick={() => handleSetTheme("light")}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
          theme === "light"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Sun size={16} />
        <span>Terang</span>
      </button>
      <button
        onClick={() => handleSetTheme("dark")}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
          theme === "dark"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Moon size={16} />
        <span>Gelap</span>
      </button>
      <button
        onClick={() => handleSetTheme("system")}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
          theme === "system"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Monitor size={16} />
        <span>Sistem</span>
      </button>
    </div>
  );
}