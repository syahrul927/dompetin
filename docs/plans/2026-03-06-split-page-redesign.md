# Split-Bill "Bagi Tagihan" Page Redesign

**Date**: 2026-03-06
**Context**: `/split-bill/new/split`
**Target Platform**: Mobile-first Web App

## 1. Overview
The "Bagi Tagihan" (Split) page needs UI/UX refinement to fix asymmetric layout issues, simplify item assignment interactions, and change the underlying split logic from a strict "quantity-based" allocation to a flexible "shares/ratio-based" system.

## 2. Problem Statement
1. **Asymmetric Participant Bar**: The first participant ("Kamu") doesn't have a delete button, causing their avatar container height to differ from other participants, breaking vertical alignment.
2. **Clunky Item Assignment UI**: Currently, items show "pilih peserta" and switch to a number input when clicked. This feels disjointed.
3. **Inflexible Split Logic**: The current logic strictly divides item quantity. Users want to split the *value* of an item, not just its quantity. For example, two people sharing 1 portion of "Mie" (Rp 3000) where one person eats 2/3 and the other 1/3 (resulting in Rp 2000 and Rp 1000).

## 3. Design Decisions & Implementation Plan

### A. Participant Bar Symmetry
**Solution**: Show a disabled (greyed-out/invisible but taking up space) delete button for the "Kamu" (Owner) participant.
- **Why**: Keeps the flex container height identical across all participant items without changing the underlying DOM structure too drastically.

### B. Item Card UI Overhaul
**Solution**: Remove "pilih peserta" entirely. The item card will always display two elements below the main details:
1. **Left Side**: A stacked avatar list of participants who have claimed at least 1 share of this item.
2. **Right Side**: A stepper component (`- [number] +`).
   - The stepper is ALWAYS visible.
   - If no participant is currently selected in the top bar, the stepper is `disabled`.
   - When a participant is selected, the stepper updates their specific "shares" for that item.

### C. Logic Change: Shares/Ratio System
**Solution**: Change the definition of "quantity assigned" to "shares claimed".
- **Current Logic**: `(Item Price) * (Participant Qty)`
- **New Logic**:
  1. Calculate `Total Shares` = sum of all shares claimed by all participants on an item.
  2. Calculate `Price Per Share` = `(Item Total Price) / (Total Shares)`.
  3. Participant's Cost = `(Participant's Shares) * (Price Per Share)`.
- **Example**: Item is "Mie" (Rp 3000, qty 1).
  - Andi adds 2 shares (taps `+` twice).
  - Kamu adds 1 share (taps `+` once).
  - Total shares = 3. Price per share = 1000.
  - Andi pays 2000, Kamu pays 1000.
- **Edge Case**: If an item is partially assigned (Total Shares < Item Qty *some abstract target*), we will need to ensure the system gracefully handles unassigned value. *Note: We will treat "Shares" as purely proportional.* If Total Shares > 0, the ENTIRE item price is split among those shares. If Total Shares = 0, the item is unassigned.

## 4. Component Updates Required

1. **`ParticipantBar.tsx`**: Add disabled delete button placeholder for the owner.
2. **`SplitItemRow.tsx`**:
   - Redesign layout to stack avatars (left) and stepper (right) below the item details.
   - Remove "pilih peserta" text.
   - Update stepper logic to handle "shares" instead of remaining item quantity limitations.
3. **`split-bill-context.tsx`**:
   - Remove/update `getRemainingQty` logic. Items no longer have a "max" quantity limit based on the receipt; participants can add unlimited "shares" to define ratios.
   - Update `getParticipantShare` to calculate costs based on the proportional ratio system described above.

## 5. User Approval Status
Approved via conversation on 2026-03-06. The user specifically selected the "Share-Based Stepper" approach and the "Shares/Ratio System" for the math logic.