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
import { CategoryIconPicker } from "@/components/categories/CategoryIconPicker";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CATEGORY_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#10b981",
  "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899", "#f43f5e",
];

const editCategorySchema = z.object({
  name: z.string().min(1, "Nama kategori wajib diisi").max(255),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

type EditCategoryValues = z.infer<typeof editCategorySchema>;

interface Category {
  id: string;
  name: string;
  type: string; // "income" | "expense"
  icon: string;
  color: string;
  isSystem?: boolean;
}

interface EditCategoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
}

export function EditCategoryDrawer({
  open,
  onOpenChange,
  category,
}: EditCategoryDrawerProps) {
  const utils = api.useUtils();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const form = useForm<EditCategoryValues>({
    resolver: zodResolver(editCategorySchema),
    defaultValues: {
      name: "",
      icon: "",
      color: "#6366f1",
    },
  });

  React.useEffect(() => {
    if (open && category) {
      form.reset({
        name: category.name,
        icon: category.icon,
        color: category.color,
      });
    }
  }, [open, category, form]);

  const updateCategory = api.category.updateCategory.useMutation({
    onSuccess: async () => {
      await utils.category.getCategories.invalidate();
      onOpenChange(false);
    },
  });

  const deleteCategory = api.category.deleteCategory.useMutation({
    onSuccess: async () => {
      await utils.category.getCategories.invalidate();
      setShowDeleteConfirm(false);
      onOpenChange(false);
    },
  });

  const onSubmit = (values: EditCategoryValues) => {
    if (!category || category.isSystem) return;
    updateCategory.mutate({
      id: category.id,
      ...values,
    });
  };

  const handleDelete = () => {
    if (!category || category.isSystem) return;
    deleteCategory.mutate({ id: category.id });
  };

  if (!category) return null;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-5 pb-8 pt-2">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[22px] font-bold text-foreground">
              Edit Kategori
            </h2>
            {!category.isSystem && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 size={20} />
              </Button>
            )}
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold">
                Nama Kategori
              </Label>
              <Input
                id="name"
                disabled={category.isSystem}
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
              {category.isSystem ? (
                <div className="flex h-11 w-full items-center justify-between rounded-xl border px-4 opacity-50">
                  <div className="flex items-center gap-3">
                    <span>{category.icon}</span>
                  </div>
                </div>
              ) : (
                <CategoryIconPicker
                  value={form.watch("icon")}
                  onChange={(icon) => form.setValue("icon", icon)}
                  defaultGroup={category.type === "income" ? "pemasukan" : undefined}
                />
              )}
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Warna</Label>
              <div className="flex flex-wrap gap-3">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    disabled={category.isSystem}
                    onClick={() => form.setValue("color", color)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-50 ${
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
              disabled={updateCategory.isPending || category.isSystem}
            >
              {category.isSystem
                ? "Kategori Bawaan Sistem"
                : updateCategory.isPending
                  ? "Menyimpan..."
                  : "Simpan Perubahan"}
            </Button>
          </form>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="w-[calc(100%-40px)] rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kategori?</AlertDialogTitle>
            <AlertDialogDescription>
              Transaksi yang menggunakan kategori ini akan kehilangan referensi kategorinya.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteCategory.isPending}
              className="h-12 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCategory.isPending ? "Menghapus..." : "Ya, Hapus Kategori"}
            </AlertDialogAction>
            <AlertDialogCancel className="h-12 rounded-full border-none bg-muted hover:bg-muted/80 sm:mt-0">
              Batal
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
