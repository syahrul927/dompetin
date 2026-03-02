"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WalletIconPicker } from "./WalletIconPicker";
import { api } from "@/trpc/react";
import { useAnalytics } from "@/hooks/use-analytics";

const editWalletSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(255),
  icon: z.string().min(1),
});

type EditWalletForm = z.infer<typeof editWalletSchema>;

interface EditWalletDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: {
    id: string;
    name: string;
    icon: string;
    type: string;
  } | null;
}

export function EditWalletDrawer({
  open,
  onOpenChange,
  wallet,
}: EditWalletDrawerProps) {
  const utils = api.useUtils();
  const { trackEvent } = useAnalytics();

  const form = useForm<EditWalletForm>({
    resolver: zodResolver(editWalletSchema),
    defaultValues: {
      name: "",
      icon: "wallet",
    },
  });

  // Reset form when wallet changes
  useEffect(() => {
    if (wallet) {
      form.reset({
        name: wallet.name,
        icon: wallet.icon,
      });
    }
  }, [wallet, form]);

  const updateMutation = api.wallet.updateWallet.useMutation({
    onSuccess: () => {
      void utils.wallet.getWallets.invalidate();
      void utils.wallet.getWallet.invalidate();
      trackEvent("wallet_updated", { type: wallet?.type ?? "" });
      onOpenChange(false);
    },
  });

  const onSubmit = (data: EditWalletForm) => {
    if (!wallet) return;
    updateMutation.mutate({
      id: wallet.id,
      ...data,
    });
  };

  const selectedIcon = form.watch("icon");

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[20px]">
        <DrawerHeader className="px-5">
          <DrawerTitle className="text-[22px] font-bold">
            Edit Dompet
          </DrawerTitle>
        </DrawerHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-5 px-5 pb-8"
        >
          {/* Name */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Nama Dompet
            </Label>
            <Input
              {...form.register("name")}
              placeholder="Nama dompet"
              className="h-12 rounded-2xl"
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Ikon
            </Label>
            <WalletIconPicker
              value={selectedIcon}
              onChange={(iconName) => form.setValue("icon", iconName)}
              walletType={wallet?.type}
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            className="h-12 w-full rounded-full text-base font-semibold active:scale-[0.97] transition-transform duration-150"
          >
            {updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
