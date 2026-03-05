"use client";

import { cn } from "@/lib/utils";
import { formatIDR } from "@/lib/formatIDR";
import type { Participant, BillItem } from "./split-bill-context";
import { getParticipantShare } from "./split-bill-context";

interface ParticipantCardProps {
  participant: Participant;
  items: BillItem[];
  tax: number;
  discount: number;
}

export function ParticipantCard({ participant, items, tax, discount }: ParticipantCardProps) {
  const { taxShare, discountShare, total } = getParticipantShare(
    participant,
    { items, tax, discount, participants: [participant] }
  );

  const assignedItems = participant.assignments.map((assignment) => {
    const item = items.find((i) => i.id === assignment.itemId);
    if (!item) return null;
    const subtotal = assignment.qty * item.price;
    return (
      <div key={assignment.itemId} className="flex justify-between text-sm">
        <span>
          {item.name} {assignment.qty > 1 ? `${assignment.qty}x` : ""}
        </span>
        <span className="font-medium">{formatIDR(subtotal)}</span>
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
