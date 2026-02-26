# Drawer UI Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the drawer component's height constraint on small screens and resolve the jarring jump/collapse behavior when typing in form inputs.

**Architecture:** We will update the underlying `Drawer` configuration to disable Vaul's native `repositionInputs` behavior, allowing forms to be scrolled manually without jumping. We will also update the global `DrawerContent` class definitions to allow `max-h-[95dvh]`.

**Tech Stack:** React, Tailwind CSS v4, Vaul (Radix UI)

---

### Task 1: Update Drawer Configuration

**Files:**
- Modify: `src/components/ui/drawer.tsx`

**Step 1: Disable `repositionInputs` in Root Drawer**

In `src/components/ui/drawer.tsx`, locate the `Drawer` functional component and add `repositionInputs={false}` to the `DrawerPrimitive.Root` props.

```tsx
function Drawer({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" repositionInputs={false} {...props} />
}
```

**Step 2: Update `DrawerContent` max height**

In the same file, locate the `DrawerContent` component. In its `className` prop, change all occurrences of `max-h-[80vh]` to `max-h-[95dvh]`.

```tsx
        className={cn(
          "group/drawer-content bg-background fixed z-50 flex h-auto flex-col",
          "data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[95dvh] data-[vaul-drawer-direction=top]:rounded-b-lg data-[vaul-drawer-direction=top]:border-b",
          "data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[95dvh] data-[vaul-drawer-direction=bottom]:rounded-t-lg data-[vaul-drawer-direction=bottom]:border-t",
          "data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:sm:max-w-sm",
          "data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=left]:sm:max-w-sm",
          className
        )}
```

**Step 3: Typecheck & Lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/ui/drawer.tsx
git commit -m "fix(ui): increase drawer max height and disable input repositioning"
```