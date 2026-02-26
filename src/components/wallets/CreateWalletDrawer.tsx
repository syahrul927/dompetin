"use client";

import React from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WalletIconPicker } from "./WalletIconPicker";
import { DEFAULT_ICON_FOR_TYPE } from "@/lib/wallet-icons";
import { api } from "@/trpc/react";

const WALLET_TYPES = [
  { value: "cash", label: "Tunai" },
  { value: "bank", label: "Rekening Bank" },
  { value: "ewallet", label: "E-Wallet" },
  { value: "savings", label: "Tabungan" },
  { value: "investment", label: "Investasi" },
] as const;

const createWalletSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(255),
  type: z.enum(["cash", "bank", "ewallet", "savings", "investment"]),
  icon: z.string().min(1),
  initialBalance: z.number().nonnegative("Saldo tidak boleh negatif"),
});

type CreateWalletForm = z.infer<typeof createWalletSchema>;

interface CreateWalletDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

export function CreateWalletDrawer({
  open,
  onOpenChange,
  workspaceId,
}: CreateWalletDrawerProps) {
  const utils = api.useUtils();

  const form = useForm<CreateWalletForm>({
    resolver: zodResolver(createWalletSchema),
    defaultValues: {
      name: "",
      type: "cash",
      icon: "banknote",
      initialBalance: 0,
    },
  });

  const createMutation = api.wallet.createWallet.useMutation({
    onSuccess: () => {
      void utils.wallet.getWallets.invalidate();
      form.reset();
      onOpenChange(false);
    },
  });

  const onSubmit = (data: CreateWalletForm) => {
    createMutation.mutate({
      ...data,
      workspaceId,
    });
  };

  const selectedType = form.watch("type");
  const selectedIcon = form.watch("icon");

  // Auto-update icon when type changes
  const handleTypeChange = (v: CreateWalletForm["type"]) => {
    form.setValue("type", v);
    const defaultIcon = DEFAULT_ICON_FOR_TYPE[v];
    if (defaultIcon) {
      form.setValue("icon", defaultIcon);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[20px]">
        <DrawerHeader className="px-5">
          <DrawerTitle className="text-[22px] font-bold">
            Tambah Dompet
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
              placeholder="Contoh: BCA, GoPay, Tunai"
              className="h-12 rounded-2xl"
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Tipe
            </Label>
            <Select value={selectedType} onValueChange={handleTypeChange}>
              <SelectTrigger className="h-12 rounded-2xl">
                <SelectValue placeholder="Pilih tipe dompet" />
              </SelectTrigger>
              <SelectContent>
                {WALLET_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Ikon
            </Label>
            <WalletIconPicker
              value={selectedIcon}
              onChange={(iconName) => form.setValue("icon", iconName)}
              walletType={selectedType}
            />
          </div>

          {/* Initial Balance */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Saldo Awal (IDR)
            </Label>
            <Input
              type="number"
              min={0}
              step="1"
              {...form.register("initialBalance", { valueAsNumber: true })}
              placeholder="0"
              className="h-12 rounded-2xl"
            />
            {form.formState.errors.initialBalance && (
              <p className="text-xs text-destructive">
                {form.formState.errors.initialBalance.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="h-12 w-full rounded-full text-base font-semibold active:scale-[0.97] transition-transform duration-150"
          >
            {createMutation.isPending ? "Menyimpan..." : "Simpan Dompet"}
          </Button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
