"use client";

import React, { useState } from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/trpc/react";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { CategoryIconPicker } from "@/components/categories/CategoryIconPicker";
import { DEFAULT_CATEGORY_ICON } from "@/lib/category-icons";

// Basic colors to choose from
const CATEGORY_COLORS = [
  "#ef4444", // Red
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#84cc16", // Yellow
  "#22c55e", // Lime
  "#10b981", // Emerald
  "#14b8a6", // Teal
  "#06b6d4", // Cyan
  "#0ea5e9", // Sky
  "#3b82f6", // Blue
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#a855f7", // Purple
  "#d946ef", // Fuchsia
  "#ec4899", // Pink
  "#f43f5e", // Rose
];

const createCategorySchema = z.object({
  name: z.string().min(1, "Nama kategori wajib diisi").max(255),
  type: z.enum(["income", "expense"]),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

type CreateCategoryValues = z.infer<typeof createCategorySchema>;

interface CreateCategoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: "income" | "expense";
}

export function CreateCategoryDrawer({
  open,
  onOpenChange,
  defaultType = "expense",
}: CreateCategoryDrawerProps) {
  const { workspaceId } = useActiveWorkspace();
  const utils = api.useUtils();

  const form = useForm<CreateCategoryValues>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      name: "",
      type: defaultType,
      icon: DEFAULT_CATEGORY_ICON,
      color: CATEGORY_COLORS[0],
    },
  });

  // Reset form when drawer opens/closes or defaultType changes
  React.useEffect(() => {
    if (open) {
      form.reset({
        name: "",
        type: defaultType,
        icon: DEFAULT_CATEGORY_ICON,
        color: CATEGORY_COLORS[0],
      });
    }
  }, [open, defaultType, form]);

  const createCategory = api.category.createCategory.useMutation({
    onSuccess: async () => {
      await utils.category.getCategories.invalidate();
      onOpenChange(false);
    },
  });

  const onSubmit = (values: CreateCategoryValues) => {
    if (!workspaceId) return;
    createCategory.mutate({
      ...values,
      workspaceId,
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="px-5 pb-8 pt-2">
        <div className="mb-6 text-center">
          <h2 className="text-[22px] font-bold text-foreground">
            Kategori Baru
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tambahkan kategori khusus untuk workspace Anda
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-semibold">
              Nama Kategori
            </Label>
            <Input
              id="name"
              placeholder="Contoh: Kopi, Bensin"
              className="h-12 rounded-xl bg-muted/50 px-4 text-base"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Ikon</Label>
            <CategoryIconPicker
              value={form.watch("icon")}
              onChange={(icon) => form.setValue("icon", icon)}
              defaultGroup={form.watch("type") === "income" ? "pemasukan" : undefined}
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Warna</Label>
            <div className="flex flex-wrap gap-3">
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => form.setValue("color", color)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-95 ${
                    form.watch("color") === color
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : ""
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="mt-6 h-14 w-full rounded-[20px] text-base font-bold"
            disabled={createCategory.isPending || !workspaceId}
          >
            {createCategory.isPending ? "Menyimpan..." : "Simpan Kategori"}
          </Button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
