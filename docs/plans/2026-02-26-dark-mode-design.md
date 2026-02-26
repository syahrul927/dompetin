# Dark Mode Implementation Design

## Context
The application currently has a set of Tailwind CSS variables for `.dark` mode defined in `src/styles/globals.css`, but there is no mechanism for the user to toggle or activate it. The user wants to implement a fully functional Dark Mode system.

## Architecture

### 1. Theme Management Provider
We will use the industry standard `next-themes` library for Next.js app router.
- Install `next-themes`
- Create `src/components/providers/theme-provider.tsx` that wraps the app with `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`
- Inject `ThemeProvider` into `src/app/layout.tsx` so the entire app can access the theme context and the HTML element receives the `.dark` class when active.

### 2. UI Toggle Component
We will add a "Tampilan" (Appearance) section to the Profile page (`src/app/profile/page.tsx`).
- Create `src/components/profile/ThemeToggle.tsx` (a Client Component since it needs `useTheme` from `next-themes`).
- The toggle will be a nice UI (likely a segmented control or a dropdown) allowing the user to select between:
  - ☀️ Terang (Light)
  - 🌙 Gelap (Dark)
  - 💻 Sistem (System Default)

### 3. Styling Verification
Since `globals.css` already contains:
```css
@custom-variant dark (&:is(.dark *));
...
.dark {
  --background: oklch(0.1928 0.0051 67.5172);
  --foreground: oklch(0.9801 0.0034 67.7835);
  /* ... */
}
```
`next-themes` will handle adding/removing the `.dark` class to the `<html>` tag, which perfectly triggers the existing CSS variables. The Tailwind v4 `@theme inline` setup will automatically map these variables to the utility classes (`bg-background`, `text-foreground`, etc.).

## Implementation Plan Handoff
This design will be handed off to the implementation plan generator to create byte-sized tasks for execution.