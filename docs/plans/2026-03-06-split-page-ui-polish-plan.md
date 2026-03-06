# Split-Bill UI Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish the Split-Bill page UI by implementing DiceBear avatars, simplifying the item card active state, and fixing the participant delete action bug.

**Architecture:** We will modify `SplitItemRow` to change the highlight styling and remove the check icon. We will update both `ParticipantBar` and `SplitItemRow` to use `next/image` with the DiceBear API instead of text initials. Finally, we will debug and fix the event handling for the `handleDeleteStart` function in `ParticipantBar`.

**Tech Stack:** Next.js (App Router), React, Tailwind CSS, shadcn/ui, TypeScript, next/image.

---

### Task 1: Simplify Item Card Active State

**Files:**
- Modify: `src/components/split-bill/SplitItemRow.tsx`

**Step 1: Write the minimal implementation**

Update the styling for `isHighlighted` on the main container. Remove the left checkmark indicator entirely.

```tsx
// Inside src/components/split-bill/SplitItemRow.tsx

// 1. Update the cn() block for the main container
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3 transition-all duration-200",
        isHighlighted ? "ring-2 ring-primary bg-primary/5 border-transparent" : "bg-card"
      )}
    >
      {/* 2. REMOVE the entire Left indicator block containing the Check icon */}

      {/* Item details */}
      <div className="space-y-1">
// ... rest of the component
```

**Step 2: Commit**

```bash
git add src/components/split-bill/SplitItemRow.tsx
git commit -m "style(split-bill): simplify item card active state with ring border"
```

---

### Task 2: Implement DiceBear Avatars

**Files:**
- Modify: `src/components/split-bill/ParticipantBar.tsx`
- Modify: `src/components/split-bill/SplitItemRow.tsx`
- Update: `next.config.js` or `next.config.mjs` (to allow DiceBear images)

**Step 1: Allow DiceBear domains in Next.js config**

Check `next.config.js` or `next.config.ts` and add `api.dicebear.com` to remote patterns.

```javascript
// next.config.ts (or js)
const nextConfig = {
  // ... existing config
  images: {
    remotePatterns: [
      // ... existing patterns
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        port: "",
        pathname: "/7.x/**",
      },
    ],
  },
};
```

**Step 2: Update ParticipantBar.tsx**

Replace the text initial with the DiceBear image.

```tsx
import Image from "next/image";

// Inside ParticipantBar.tsx, replace the <span>{participant.name.charAt(0)}</span> with:
            <div className="relative size-full overflow-hidden rounded-full bg-muted">
              <Image
                src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(participant.name)}`}
                alt={participant.name}
                fill
                className="object-cover"
                unoptimized // SVG from DiceBear doesn't need Next.js optimization
              />
            </div>
```

**Step 3: Update SplitItemRow.tsx**

Replace the text initial in the stacked avatars with the DiceBear image.

```tsx
import Image from "next/image";

// Inside SplitItemRow.tsx, replace the <div...>{p.name.charAt(0)}</div> with:
        <div 
          key={p.id} 
          className="relative inline-block h-6 w-6 rounded-full ring-2 ring-background bg-muted overflow-hidden border border-border"
          title={p.name}
        >
          <Image
            src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(p.name)}`}
            alt={p.name}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
```

**Step 4: Commit**

```bash
git add next.config.ts src/components/split-bill/ParticipantBar.tsx src/components/split-bill/SplitItemRow.tsx
git commit -m "feat(split-bill): implement DiceBear avatars for participants"
```

---

### Task 3: Fix 'Hapus' (Delete) Button Bug

**Files:**
- Modify: `src/components/split-bill/ParticipantBar.tsx`

**Step 1: Write the minimal implementation**

Investigate the `handleDeleteStart` and button interactions. The issue is likely that standard `onClick` handles regular taps, but mobile browsers handle `onTouchStart`/`onMouseDown` weirdly when combined with scrollable areas.

Instead of a custom long-press timer which is buggy, let's just make it a standard `onClick` but require a double-click/double-tap to confirm, OR just trigger the dialog on a single click since the dialog *is* the confirmation. Since the button specifically says "Hapus" now, clicking it should just open the confirmation dialog immediately.

```tsx
// Inside ParticipantBar.tsx

// 1. Remove the longPressTimerRef and associated complex handlers (handleDeleteStart, handleDeleteEnd)
// 2. Add a simple click handler for delete:
  const handleDeleteClick = (e: React.MouseEvent, participantId: string) => {
    e.stopPropagation();
    setParticipantToDelete(participantId);
  };

// 3. Update the button to use onClick:
          {!participant.isOwner ? (
            <button
              onClick={(e) => handleDeleteClick(e, participant.id)}
              className="text-[10px] text-destructive hover:text-destructive/80 select-none px-2 py-1"
              aria-label="Hapus peserta"
            >
              Hapus
            </button>
          ) : (
            <div className="text-[10px] invisible select-none px-2 py-1" aria-hidden="true">
              Hapus
            </div>
          )}
```

**Step 2: Commit**

```bash
git add src/components/split-bill/ParticipantBar.tsx
git commit -m "fix(split-bill): simplify participant delete interaction to fix bug"
```
