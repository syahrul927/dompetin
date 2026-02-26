# Drawer UI Fixes Design

## Context
The user identified two major UX issues when testing the application on real mobile devices:
1. **Drawer Height:** The `Drawer` component (specifically `AddTransactionSheet` and others) has a maximum height that cuts off the submit button at the bottom of smaller screens. The user wants the default maximum height increased to 95vh globally.
2. **Keyboard Scrolling & Repositioning:** When a form input inside the drawer is focused, the soft keyboard appears. Vaul's default behavior is to reposition the drawer to keep the input visible, but this causes the form to hide or jump. If the user tries to scroll down to see what they are typing, the drawer interprets the drag as a "close" gesture and collapses.

## Architecture

### 1. Update Global Drawer Height
- File: `src/components/ui/drawer.tsx`
- Change: In the `DrawerContent` component, locate the Tailwind classes defining `max-h-[80vh]` for both top and bottom directions.
- Update: Replace `max-h-[80vh]` with `max-h-[95dvh]` (using `dvh` for better mobile browser viewport handling).

### 2. Disable Input Repositioning
- File: `src/components/ui/drawer.tsx`
- Change: In the root `Drawer` component wrapper, pass `repositionInputs={false}` to the underlying `DrawerPrimitive.Root`.
- Note: This prevents Vaul from aggressively jumping the layout when the keyboard opens, allowing the user to manually scroll the inner `overflow-y-auto` container natively without triggering the drag-to-close gesture.

## Implementation Plan Handoff
This design will be handed off to the implementation plan generator to create byte-sized tasks for execution.