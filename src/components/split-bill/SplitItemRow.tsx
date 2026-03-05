"use client";

import { useSplitBill, getRemainingQty, type BillItem } from "@/components/split-bill/split-bill-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface SplitItemRowProps {
  item: BillItem;
  activeParticipantId: string | null;
  onSetAssignment: (participantId: string, itemId: string, qty: number) => void;
}

export function SplitItemRow({
  item,
  activeParticipantId,
  onSetAssignment,
}: SplitItemRowProps) {
  const { state } = useSplitBill();

  // Get current assignment for active participant
  const currentAssignment =
    activeParticipantId !== null
      ? state.participants.find((p) => p.id === activeParticipantId)?.assignments.find((a) => a.itemId === item.id)
      : undefined;

  const currentQty = currentAssignment?.qty ?? 0;
  const remainingQty = getRemainingQty(item.id, state);
  const maxQty = currentQty + remainingQty;
  const subtotal = item.qty * item.price;

  // Check if this item is highlighted (active participant has assigned qty > 0)
  const isHighlighted = activeParticipantId !== null && currentQty > 0;

  const handleDecrement = () => {
    if (currentQty > 0 && activeParticipantId !== null) {
      onSetAssignment(activeParticipantId, item.id, currentQty - 1);
    }
  };

  const handleIncrement = () => {
    if (currentQty < maxQty && activeParticipantId !== null) {
      onSetAssignment(activeParticipantId, item.id, currentQty + 1);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 transition-colors",
        isHighlighted && "border-l-4 border-l-primary bg-primary/5",
      )}
    >
      {/* Left indicator */}
      {isHighlighted && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-4 w-4" />
        </div>
      )}

      {/* Item details */}
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-sm">{item.name || "Item tanpa nama"}</h3>
          <div className="text-right">
            <p className="text-sm font-medium">
              Rp {(item.price || 0).toLocaleString("id-ID")}
              <span className="text-muted-foreground text-xs">/unit</span>
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Total: {item.qty} unit × Rp {(item.price || 0).toLocaleString("id-ID")}
          </span>
          <span className="font-medium">
            = Rp {subtotal.toLocaleString("id-ID")}
          </span>
        </div>
      </div>

      {/* Qty stepper - only shown when active participant is selected */}
      {activeParticipantId !== null && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleDecrement}
            disabled={currentQty <= 0}
            className="h-8 w-8 rounded-full"
            aria-label="Kurangi jumlah"
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
            disabled={currentQty >= maxQty}
            className="h-8 w-8 rounded-full"
            aria-label="Tambah jumlah"
          >
            <span className="text-sm font-medium">+</span>
          </Button>
        </div>
      )}

      {/* Status when no active participant */}
      {activeParticipantId === null && (
        <div className="shrink-0">
          <p className="text-muted-foreground text-xs">Pilih peserta</p>
        </div>
      )}
    </div>
  );
}
