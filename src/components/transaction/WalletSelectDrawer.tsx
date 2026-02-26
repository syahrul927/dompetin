"use client";

import React, { useState } from "react";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { api } from "@/trpc/react";
import { getWalletIcon } from "@/lib/wallet-icons";
import { Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface WalletSelectDrawerProps {
  value: string; // walletId
  onChange: (id: string) => void;
  workspaceId: string;
  children: React.ReactNode; // Trigger element
}

export function WalletSelectDrawer({
  value,
  onChange,
  workspaceId,
  children,
}: WalletSelectDrawerProps) {
  const [open, setOpen] = useState(false);
  const { data: wallets, isLoading } = api.wallet.getWallets.useQuery(
    { workspaceId },
    { enabled: open && !!workspaceId }
  );

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <Drawer nested open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent className="max-h-[85vh] px-0 pb-0">
        <div className="px-5 pb-6 pt-2">
          <div className="mb-4 text-center">
            <DrawerTitle className="text-lg font-bold text-foreground">Pilih Dompet</DrawerTitle>
          </div>

          <div className="space-y-1">
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="h-10 w-10 rounded-2xl" />
                  <Skeleton className="h-5 w-1/3" />
                </div>
              ))}

            {!isLoading && wallets?.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Belum ada dompet
              </p>
            )}

            {!isLoading &&
              wallets?.map((wallet) => {
                const Icon = getWalletIcon(wallet.icon);
                const isSelected = value === wallet.id;

                return (
                  <div
                    key={wallet.id}
                    onClick={() => handleSelect(wallet.id)}
                    className="flex cursor-pointer items-center justify-between py-3 transition-colors active:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-foreground">
                        <Icon size={20} />
                      </div>
                      <span className="text-base font-medium text-foreground">
                        {wallet.name}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check size={14} />
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
