"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Pencil, Trash2 } from "lucide-react";
import { useAnalytics } from "@/hooks/use-analytics";

interface WalletActionsProps {
  onTransfer: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Action buttons on Wallet Detail: Transfer, Edit, and Delete.
 */
export function WalletActions({ onTransfer, onEdit, onDelete }: WalletActionsProps) {
  const { trackEvent } = useAnalytics();

  return (
    <div className="grid grid-cols-3 gap-2">
      <Button
        onClick={() => {
          onTransfer();
          trackEvent("wallet_transfer_initiated");
        }}
        className="h-10 rounded-full text-xs font-semibold active:scale-[0.97] transition-transform duration-150"
      >
        <ArrowRightLeft size={14} className="mr-1.5" />
        Transfer
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          onEdit();
          trackEvent("wallet_edit_initiated");
        }}
        className="h-10 rounded-full border-primary/40 text-xs font-semibold text-primary hover:bg-primary/5 active:scale-[0.97] transition-transform duration-150"
      >
        <Pencil size={14} className="mr-1.5" />
        Edit
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          onDelete();
          trackEvent("wallet_delete_initiated");
        }}
        className="h-10 rounded-full border-destructive/40 text-xs font-semibold text-destructive hover:bg-destructive/5 active:scale-[0.97] transition-transform duration-150"
      >
        <Trash2 size={14} className="mr-1.5" />
        Hapus
      </Button>
    </div>
  );
}
