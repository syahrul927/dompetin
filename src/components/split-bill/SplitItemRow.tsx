"use client";

import { useSplitBill, type BillItem } from "@/components/split-bill/split-bill-context";
import { cn, getAvatarUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  const subtotal = item.qty * item.price;

  // Find participants who have shares in this item
  const assignedParticipants = state.participants.filter(p =>
    p.assignments.some(a => a.itemId === item.id && a.qty > 0)
  );

  // Check if this item is highlighted (active participant has assigned qty > 0)
  const isHighlighted = activeParticipantId !== null && currentQty > 0;

  const handleDecrement = () => {
    if (currentQty > 0 && activeParticipantId !== null) {
      onSetAssignment(activeParticipantId, item.id, currentQty - 1);
    }
  };

  const handleIncrement = () => {
    if (activeParticipantId !== null) {
      onSetAssignment(activeParticipantId, item.id, currentQty + 1);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3 transition-all duration-200",
        isHighlighted ? "ring-2 ring-primary bg-primary/5 border-transparent" : "bg-card"
      )}
    >
        {/* Item details */}
        <div className="space-y-1">
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

      <div className="flex items-center justify-between mt-3 pt-3 border-t">
        {/* Avatar Stack */}
        <div className="flex -space-x-2 overflow-hidden">
          {assignedParticipants.length > 0 ? (
            assignedParticipants.map((p) => (
              <div
                key={p.id}
                className="relative inline-block h-6 w-6 rounded-full ring-2 ring-background bg-muted overflow-hidden border border-border"
                title={p.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getAvatarUrl(p.name)}
                  alt={p.name}
                  className="h-full w-full object-cover"
                />
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
            disabled={activeParticipantId === null}
            className="h-8 w-8 rounded-full"
            aria-label="Tambah jumlah"
          >
            <span className="text-sm font-medium">+</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
