"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  WALLET_ICONS,
  WALLET_ICONS_BY_TYPE,
  getWalletIcon,
} from "@/lib/wallet-icons";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

const TYPE_LABELS: Record<string, string> = {
  cash: "Tunai",
  bank: "Bank",
  ewallet: "E-Wallet",
  savings: "Tabungan",
  investment: "Investasi",
};

interface WalletIconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  walletType?: string;
}

/**
 * A button showing the selected Lucide icon.
 * On click, opens a nested drawer with an icon grid grouped by wallet type.
 */
export function WalletIconPicker({
  value,
  onChange,
  walletType,
}: WalletIconPickerProps) {
  const [open, setOpen] = useState(false);
  const SelectedIcon = getWalletIcon(value);

  // Show type-specific icons first, then others
  const typeIcons = walletType ? WALLET_ICONS_BY_TYPE[walletType] ?? [] : [];
  const otherTypes = Object.keys(WALLET_ICONS_BY_TYPE).filter(
    (t) => t !== walletType,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 rounded-2xl border bg-background p-3 transition-colors hover:bg-muted/50"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <SelectedIcon size={22} className="text-primary" />
        </div>
        <div className="text-left">
          <p className="text-sm font-medium text-foreground">Pilih Ikon</p>
          <p className="text-xs text-muted-foreground">
            Ketuk untuk mengganti ikon
          </p>
        </div>
      </button>

      <Drawer open={open} onOpenChange={setOpen} nested>
        <DrawerContent className="rounded-t-[20px]">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-bold">Pilih Ikon</DrawerTitle>
          </DrawerHeader>

          <div className="max-h-[50vh] overflow-y-auto px-4 pb-6">
            {/* Type-specific icons first */}
            {walletType && typeIcons.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {TYPE_LABELS[walletType] ?? walletType}
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {typeIcons.map((iconName) => {
                    const Icon = WALLET_ICONS[iconName];
                    if (!Icon) return null;
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => {
                          onChange(iconName);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex h-12 w-full items-center justify-center rounded-xl transition-colors",
                          value === iconName
                            ? "bg-primary/10 ring-2 ring-primary"
                            : "bg-muted hover:bg-muted-foreground/10",
                        )}
                      >
                        <Icon
                          size={22}
                          className={
                            value === iconName
                              ? "text-primary"
                              : "text-foreground"
                          }
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Other types */}
            {otherTypes.map((type) => {
              const icons = WALLET_ICONS_BY_TYPE[type] ?? [];
              return (
                <div key={type} className="mb-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    {TYPE_LABELS[type] ?? type}
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {icons.map((iconName) => {
                      const Icon = WALLET_ICONS[iconName];
                      if (!Icon) return null;
                      return (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => {
                            onChange(iconName);
                            setOpen(false);
                          }}
                          className={cn(
                            "flex h-12 w-full items-center justify-center rounded-xl transition-colors",
                            value === iconName
                              ? "bg-primary/10 ring-2 ring-primary"
                              : "bg-muted hover:bg-muted-foreground/10",
                          )}
                        >
                          <Icon
                            size={22}
                            className={
                              value === iconName
                                ? "text-primary"
                                : "text-foreground"
                            }
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
