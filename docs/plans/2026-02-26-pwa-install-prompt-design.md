# PWA Install Prompt Design

## Context
The application is a Progressive Web App (PWA) with existing logic in `src/lib/pwa/pwa-helpers.ts` and an unused `InstallPrompt` component in `src/components/pwa/install-prompt.tsx`. The user wants to properly integrate this feature so users are prompted to install the app on their devices.

## Requirements
1. The install prompt should appear globally.
2. It must not overlap with the new `BottomNav` and `FAB` at the bottom of the screen.
3. It should match the application's UI aesthetics (rounded corners, correct colors).
4. It should respect native PWA APIs (`beforeinstallprompt` on Android/Desktop) and gracefully provide instructions on iOS where native prompts aren't supported.

## Architecture

### 1. UI Refactoring
- Modify `src/components/pwa/install-prompt.tsx`:
  - Change the positioning from `fixed bottom-4 right-4` to `fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-lg`.
  - Update the animation from `slide-in-from-bottom` to `slide-in-from-top-4`.
  - Update styling to use `rounded-2xl`, `bg-card`, and `border-border` to match the rest of Dompetin's UI.

### 2. Global Integration
- Update `src/app/layout.tsx`:
  - Import the `InstallPrompt` component.
  - Render it alongside the `OfflineIndicator` inside the `AppShell` (or just inside the main layout body) so it can trigger globally.
  - Ensure it mounts on the client side since it relies on window events.

### 3. State Management
- The `InstallPrompt` component already uses `pwa-helpers.ts` to track dismissal state in `localStorage` (`dompetin-pwa-install-dismissed`), which is correct.
- If a user clicks "X", it won't show up again.
- If they click "Install", it will trigger the native prompt on Android/Desktop. On iOS, it will show an alert (or the existing instructional text) telling them to use the Share menu.

## Implementation Plan Handoff
This design will be handed off to the implementation plan generator to create byte-sized tasks for execution.