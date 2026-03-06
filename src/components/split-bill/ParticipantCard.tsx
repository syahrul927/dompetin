"use client";

import { cn } from "@/lib/utils";
import { formatIDR } from "@/lib/formatIDR";
import type { Participant, SplitBillState } from "./split-bill-context";
import { getParticipantShare } from "./split-bill-context";

interface ParticipantCardProps {
  participant: Participant;
  state: SplitBillState;
}

export function ParticipantCard({ participant, state }: ParticipantCardProps) {
  const { taxShare, discountShare, total, itemsBreakdown } = getParticipantShare(
    participant,
    state // Use the full state
  );

  const assignedItems = itemsBreakdown.map((item) => {
    return (
      <div key={item.itemId} className="flex justify-between text-sm">
        <span>
          {item.name || "Item tanpa nama"} {item.qty > 1 ? `${item.qty}x` : ""}
        </span>
        <span className="font-medium">{formatIDR(item.subtotal)}</span>
      </div>
    );
  });

  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-3",
        participant.isOwner && "border-primary"
      )}
    >
      <h3 className="text-lg font-bold">{participant.name}</h3>

      {assignedItems.some((item) => item !== null) && (
        <div className="space-y-1">
          {assignedItems}
        </div>
      )}

      {taxShare > 0 && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Pajak</span>
          <span>+{formatIDR(taxShare)}</span>
        </div>
      )}

      {discountShare > 0 && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Diskon</span>
          <span>-{formatIDR(discountShare)}</span>
        </div>
      )}

      <div className="border-t pt-3 flex justify-between font-bold">
        <span>Total</span>
        <span>{formatIDR(total)}</span>
      </div>
    </div>
  );
}
