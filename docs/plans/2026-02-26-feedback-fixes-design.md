# Feedback Fixes Design

## Context
The user provided feedback on three distinct issues after testing the application:
1. **Transaction Date Input:** The transaction date input relies on `element.showPicker()`, which is not supported or reliable on some mobile browsers (like iOS Safari), preventing users from changing the date.
2. **Workspace Members Mock Data:** When switching to a family workspace that should contain 2 people, the UI only shows the current user. Investigation revealed `src/app/workspace/page.tsx` is still using a hardcoded `MOCK_MEMBERS` array.
3. **Screen Animation Glitch:** The user feels the `framer-motion` page transition animation looks like a "glitch" because it is too much movement. They want to remove it entirely, keeping animations only on the navigation menu itself.

## Architecture & Implementation Strategy

### 1. Transaction Date Input Fix
- **Component:** `src/components/transaction/AddTransactionSheet.tsx`
- **Current State:** Uses a visually styled `FormRow` that programmatically calls `.showPicker()` on an invisible `<input type="date">`.
- **New Design:** We will remove the `FormRow` for the date field and replace it with a fully visible, styled native `<input type="date">`. This completely bypasses the need for JavaScript `.showPicker()` and relies on the OS's native date picker UI uniformly across all platforms.

### 2. Workspace Members API Integration
- **Backend:** Add `getWorkspaceMembers` to `src/server/api/routers/workspace.ts`. It will fetch all `workspaceMember` records for a given `workspaceId` and join them with the `user` table to return names, emails, and roles.
- **Frontend:** Update `src/app/workspace/page.tsx` to:
  1. Delete the `MOCK_MEMBERS` array.
  2. Implement `api.workspace.getWorkspaceMembers.useQuery`.
  3. Transform the API data into the `MemberList` component props (calculating initials).
  4. Pass the real data to the `MemberList` component.

### 3. Remove Screen Animations
- **Component:** `src/components/shared/AppShell.tsx`
- **Current State:** Uses `framer-motion` `AnimatePresence` and `motion.div` to fade/slide the `children` on route changes.
- **New Design:**
  1. Strip out `framer-motion` imports from `AppShell.tsx`.
  2. Remove `<AnimatePresence>` and `<motion.div>`.
  3. Simply render `{children}` inside the scrollable container.
  4. The `BottomNav` component's internal `layoutId` animations will remain untouched.

## Implementation Plan Handoff
This design will be handed off to the implementation plan generator to create byte-sized tasks for execution.