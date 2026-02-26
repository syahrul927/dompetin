"use client";

import React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Wallet {
  id: string;
  name: string;
  type: string;
}

interface WalletPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: Wallet[];
  selectedWalletId?: string;
  onSelect: (walletId: string) => void;
}

/**
 * Nested picker drawer for wallet selection.
 * Uses vaul's `nested` prop so it animates and dismisses independently
 * from the parent AddTransactionSheet drawer.
 */
export function WalletPicker({
  open,
  onOpenChange,
  wallets,
  selectedWalletId,
  onSelect,
}: WalletPickerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} nested>
      <DrawerContent className="max-h-[60dvh]">
        <DrawerHeader>
          <DrawerTitle>Pilih Dompet</DrawerTitle>
        </DrawerHeader>
        <div className="space-y-2 px-4 pb-6">
          {wallets.map((wallet) => (
            <Button
              key={wallet.id}
              variant="ghost"
              onClick={() => {
                onSelect(wallet.id);
                onOpenChange(false);
              }}
              className="flex h-auto w-full items-center justify-between rounded-2xl p-4 text-left hover:bg-muted"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {wallet.name}
                </p>
                <p className="text-xs text-muted-foreground">{wallet.type}</p>
              </div>
              {selectedWalletId === wallet.id && (
                <Check size={18} className="text-primary" />
              )}
            </Button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
