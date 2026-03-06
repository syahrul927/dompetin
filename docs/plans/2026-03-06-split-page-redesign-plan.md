# Split-Bill Page Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a mobile-first redesign of the split-bill allocation page, changing the math logic to a proportional "shares" system instead of strict item quantities.

**Architecture:** We will modify the existing `SplitItemRow` and `ParticipantBar` components to improve UI symmetry and introduce a stacked avatar display. We will update the underlying `split-bill-context.tsx` reducer and helper functions to calculate costs proportionally based on shares.

**Tech Stack:** Next.js (App Router), React, Tailwind CSS, shadcn/ui, TypeScript.

---

### Task 1: Update ParticipantBar Symmetry

**Files:**
- Modify: `src/components/split-bill/ParticipantBar.tsx`

**Step 1: Write the minimal implementation**

Modify the `ParticipantBar` to show a disabled, invisible delete button placeholder for the owner ("Kamu") so the flex height matches the other participants.

```tsx
// Inside src/components/split-bill/ParticipantBar.tsx around line 179:
          {/* Delete button or placeholder for symmetry */}
          {!participant.isOwner ? (
            <button
              onMouseDown={(e) => handleDeleteStart(e, participant.id)}
              onMouseUp={handleDeleteEnd}
              onMouseLeave={handleDeleteEnd}
              onTouchStart={(e) => handleDeleteStart(e, participant.id)}
              onTouchEnd={handleDeleteEnd}
              onTouchCancel={handleDeleteEnd}
              className="text-[10px] text-destructive hover:text-destructive/80 select-none"
              aria-label="Tekan lama untuk hapus peserta"
            >
              (Tahan Hapus)
            </button>
          ) : (
            <div className="h-[15px]" aria-hidden="true" /> // Invisible placeholder
          )}
```

**Step 2: Commit**

```bash
git add src/components/split-bill/ParticipantBar.tsx
git commit -m "fix(split-bill): add placeholder to ParticipantBar for symmetry"
```

---

### Task 2: Refactor Split Logic to "Shares" (Context Updates)

**Files:**
- Modify: `src/components/split-bill/split-bill-context.tsx`

**Step 1: Write the minimal implementation**

1. Remove or modify `getRemainingQty`. It is no longer needed to strictly limit additions.
2. Update `getParticipantShare` to use the proportional logic:
   - Calculate total shares for an item across all participants.
   - Calculate price per share = `(item.qty * item.price) / totalShares`.
   - Participant's cost for that item = `participantItemQty * pricePerShare`.

```tsx
// Inside src/components/split-bill/split-bill-context.tsx

// Remove or deprecate getRemainingQty, or just change it to not strictly limit maxQty.
// For now, we can just remove the max limit checks in the UI, but let's update the math.

export function getParticipantShare(participant: Participant, state: SplitBillState) {
  let itemsTotal = 0;

  participant.assignments.forEach((assignment) => {
    const item = state.items.find((i) => i.id === assignment.itemId);
    if (!item) return;

    // Calculate total shares for this item across ALL participants
    const totalShares = state.participants.reduce((sum, p) => {
      const pAssignment = p.assignments.find((a) => a.itemId === item.id);
      return sum + (pAssignment?.qty || 0);
    }, 0);

    if (totalShares > 0) {
      const itemTotalPrice = item.qty * item.price;
      const pricePerShare = itemTotalPrice / totalShares;
      itemsTotal += assignment.qty * pricePerShare;
    }
  });

  // Calculate tax and discount proportionally based on itemsTotal vs subtotal
  const subtotal = getGrandSubtotal(state.items);
  const proportion = subtotal > 0 ? itemsTotal / subtotal : 0;
  
  const taxShare = state.tax * proportion;
  const discountShare = state.discount * proportion;
  const finalTotal = itemsTotal + taxShare - discountShare;

  return {
    itemsTotal,
    taxShare,
    discountShare,
    finalTotal,
  };
}
```

**Step 2: Commit**

```bash
git add src/components/split-bill/split-bill-context.tsx
git commit -m "feat(split-bill): refactor split logic to proportional shares system"
```

---

### Task 3: Redesign SplitItemRow UI

**Files:**
- Modify: `src/components/split-bill/SplitItemRow.tsx`

**Step 1: Write the minimal implementation**

1. Remove the strict limit checking `maxQty` logic.
2. Remove the "pilih peserta" logic entirely.
3. Change the layout to show a stacked avatar list on the left and the stepper on the right ALWAYS (but disabled if no active participant).

```tsx
// Inside src/components/split-bill/SplitItemRow.tsx

// 1. Remove getRemainingQty from imports.
// 2. Add an avatar stack below the item details showing participants who have assigned qty > 0.
// 3. Make the stepper always visible. Disable the '-' button if currentQty <= 0 or if activeParticipantId is null. Disable '+' if activeParticipantId is null.

// Find participants who have shares in this item
const assignedParticipants = state.participants.filter(p => 
  p.assignments.some(a => a.itemId === item.id && a.qty > 0)
);

// In the JSX, after the item details:
<div className="flex items-center justify-between mt-3 pt-3 border-t">
  {/* Avatar Stack */}
  <div className="flex -space-x-2 overflow-hidden">
    {assignedParticipants.length > 0 ? (
      assignedParticipants.map((p) => (
        <div 
          key={p.id} 
          className="inline-block h-6 w-6 rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-[10px] font-medium"
          title={p.name}
        >
          {p.name.charAt(0).toUpperCase()}
        </div>
      ))
    ) : (
      <span className="text-xs text-muted-foreground">Belum ada pembagian</span>
    )}
  </div>

  {/* Always visible Stepper */}
  <div className="flex items-center gap-2">
    <Button
      variant="outline"
      size="icon-sm"
      onClick={handleDecrement}
      disabled={currentQty <= 0 || activeParticipantId === null}
      className="h-8 w-8 rounded-full"
    >
      <span className="text-sm font-medium">−</span>
    </Button>

    <div className="flex h-8 w-12 items-center justify-center rounded-md border bg-background text-sm font-medium tabular-nums">
      {currentQty}
    </div>

    <Button
      variant="outline"
      size="icon-sm"
      onClick={handleIncrement}
      disabled={activeParticipantId === null} // No max limit anymore!
      className="h-8 w-8 rounded-full"
    >
      <span className="text-sm font-medium">+</span>
    </Button>
  </div>
</div>
```

**Step 2: Commit**

```bash
git add src/components/split-bill/SplitItemRow.tsx
git commit -m "feat(split-bill): redesign SplitItemRow with avatar stack and persistent stepper"
```
