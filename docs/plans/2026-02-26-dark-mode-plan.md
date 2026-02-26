# Dark Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a fully functional Dark Mode system using `next-themes` and a UI toggle in the Profile page.

**Architecture:**
1. Install `next-themes`
2. Create a global `ThemeProvider` and inject it into `layout.tsx`
3. Create a `ThemeToggle` UI component for the profile page
4. Add the toggle to `src/app/profile/page.tsx` under a new "Tampilan" section

**Tech Stack:** Next.js 15, React, Tailwind CSS v4, `next-themes`

---

### Task 1: Setup Theme Provider

**Files:**
- Modify: `package.json`
- Create: `src/components/providers/theme-provider.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Install next-themes**

Run: `pnpm add next-themes`
Expected: Installs successfully

**Step 2: Create ThemeProvider component**

Create `src/components/providers/theme-provider.tsx`:

```tsx
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

**Step 3: Inject ThemeProvider into Layout**

Modify `src/app/layout.tsx` to wrap the app with `ThemeProvider`. Make sure to add `suppressHydrationWarning` to the `<html>` tag as required by `next-themes`.

```tsx
import { ThemeProvider } from "@/components/providers/theme-provider";

// Update the html tag:
    <html lang="en" className={`${fontSans.variable}`} suppressHydrationWarning>

// Inside body:
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCReactProvider>
            {/* ... rest of the app ... */}
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
```

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/providers/theme-provider.tsx src/app/layout.tsx
git commit -m "feat(theme): add next-themes provider for dark mode support"
```

### Task 2: Create Theme Toggle Component

**Files:**
- Create: `src/components/profile/ThemeToggle.tsx`
- Modify: `src/app/profile/page.tsx`

**Step 1: Create ThemeToggle component**

Create `src/components/profile/ThemeToggle.tsx`:

```tsx
"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-10 w-full rounded-xl bg-muted animate-pulse" />;
  }

  return (
    <div className="flex w-full items-center justify-between rounded-xl bg-muted/50 p-1">
      <button
        onClick={() => setTheme("light")}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
          theme === "light"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Sun size={16} />
        <span>Terang</span>
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
          theme === "dark"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Moon size={16} />
        <span>Gelap</span>
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
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
```

**Step 2: Add to Profile Page**

Modify `src/app/profile/page.tsx` to include the new "Tampilan" section with the `ThemeToggle`.

```tsx
import { ThemeToggle } from "@/components/profile/ThemeToggle";

// Inside the profile page content, before the "Pengaturan Data" section:
        {/* Appearance */}
        <div className="mt-6">
          <SectionHeader title="Tampilan" />
          <div className="mt-2 rounded-2xl bg-card p-4">
            <ThemeToggle />
          </div>
        </div>
```

**Step 3: Typecheck & Lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/profile/ThemeToggle.tsx src/app/profile/page.tsx
git commit -m "feat(profile): add dark mode toggle UI"
```