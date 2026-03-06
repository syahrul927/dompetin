# Split-Bill UI Polish

**Date**: 2026-03-06
**Context**: `/split-bill/new/split`
**Target Platform**: Mobile-first Web App

## 1. Overview
Further refinements to the "Bagi Tagihan" (Split) page based on user feedback. The goal is to clean up the item card active states, implement dynamic standard avatars using DiceBear (Lorelei style), and fix a bug where the participant "Hapus" (delete) action does not trigger correctly.

## 2. Problem Statement
1. **Item Card Active State is Clunky**: The current highlight state uses a left border and conditionally renders a Check icon, which causes minor layout shifts and feels overly complex.
2. **Text Initial Avatars look plain**: The avatars in the participant bar and item card stacks just use text initials (e.g., 'K' for Kamu) and aren't perfectly centered. They need to look more modern and visually appealing.
3. **Broken 'Hapus' Action**: The long-press action to delete a non-owner participant is failing to trigger the actual removal logic.

## 3. Design Decisions & Implementation Plan

### A. Minimalist Item Card Highlight
**Solution**: Remove the Check icon and left border completely. When an item is active (assigned to the current participant), apply a full ring border and retain the primary background tint.
- **Classes**: `ring-2 ring-primary bg-primary/5`
- **Why**: This provides a highly visible, symmetrical highlight state without altering the DOM structure or causing layout shifts.

### B. DiceBear Lorelei Avatars
**Solution**: Replace the text initial logic with dynamic `img` (or `next/image`) tags pointing to the DiceBear API.
- **URL Format**: `https://api.dicebear.com/7.x/lorelei/svg?seed=[participantName]`
- **Styling**: Add a tiny border (`border border-border` or `ring-1 ring-border`) to ensure the avatars pop against the background, especially in the stacked layout.
- **Locations**: This needs to be updated in both `ParticipantBar.tsx` (top carousel) and `SplitItemRow.tsx` (the stacked avatars below the item details).

### C. Fix 'Hapus' Bug
**Solution**: Investigate the interaction between the `longPressTimerRef`, `onMouseDown`/`onTouchStart` events, and the `AlertDialog` state in `ParticipantBar.tsx`.
- **Hypothesis**: The timer might be getting cleared improperly, or the event propagation is blocking the state update.
- **Fix**: Ensure the `participantToDelete` state is set reliably after the 500ms threshold, and verify that the `AlertDialog` correctly mounts and dispatches the `REMOVE_PARTICIPANT` action.

## 4. Component Updates Required

1. **`ParticipantBar.tsx`**:
   - Replace the `<span>{participant.name.charAt(0).toUpperCase()}</span>` with an `<img>` referencing the DiceBear URL.
   - Debug and fix the `handleDeleteStart` / `handleDeleteEnd` logic to ensure the delete dialog appears.
2. **`SplitItemRow.tsx`**:
   - Update the `isHighlighted` styling on the main card container to use `ring-2 ring-primary bg-primary/5`.
   - Remove the conditional `<Check />` container entirely.
   - Replace the stacked text-initial avatars with stacked DiceBear `<img>` tags, ensuring they maintain the `-space-x-2` overlap and have a visible ring/border.

## 5. User Approval Status
Approved via conversation on 2026-03-06. The user specifically approved the Ring Border highlight, Standard Lorelei avatars, and the bug fix plan.