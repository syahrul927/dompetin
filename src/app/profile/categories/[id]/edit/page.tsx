"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalytics } from "@/hooks/use-analytics";

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

export default function EditCategoryPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const utils = api.useUtils();
  const { trackEvent } = useAnalytics();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: category, isLoading } = api.category.getCategory.useQuery({ id });

  const form = useForm<EditCategoryValues>({
    resolver: zodResolver(editCategorySchema),
    defaultValues: { name: "", icon: "", color: "#6366f1" },
  });

  useEffect(() => {
    if (category) {
      form.reset({
        name: category.name,
        icon: category.icon,
        color: category.color,
      });
    }
  }, [category, form]);

  const updateCategory = api.category.updateCategory.useMutation({
    onSuccess: async () => {
      await utils.category.getCategories.invalidate();
      await utils.category.getCategory.invalidate({ id });
      trackEvent("category_updated", { type: category?.type ?? "" });
      router.back();
    },
  });

  const deleteCategory = api.category.deleteCategory.useMutation({
    onSuccess: async () => {
      await utils.category.getCategories.invalidate();
      trackEvent("category_deleted");
      router.back();
    },
  });

  const onSubmit = (values: EditCategoryValues) => {
    if (!category || category.isSystem) return;
    updateCategory.mutate({ id, ...values });
  };

  const handleDelete = () => {
    if (!category || category.isSystem) return;
    deleteCategory.mutate({ id });
  };

  if (isLoading) {
    return (
      <>
        <PageHeader variant="back" title="Edit Kategori" onBack={() => router.back()} />
        <div className="space-y-6 px-5 pt-6">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </>
    );
  }

  if (!category) {
    return (
      <>
        <PageHeader variant="back" title="Edit Kategori" onBack={() => router.back()} />
        <div className="p-5 text-center text-muted-foreground">Kategori tidak ditemukan</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        variant="back"
        title="Edit Kategori"
        onBack={() => router.back()}
        rightSlot={
          !category.isSystem && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 size={20} />
            </Button>
          )
        }
      />

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-5 pt-6 pb-28">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-semibold">Nama Kategori</Label>
          <Input
            id="name"
            disabled={category.isSystem}
            className="h-14 rounded-2xl bg-muted/50 px-4 text-base"
            {...form.register("name")}
          />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>

        {/* Icon */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Ikon</Label>
          {category.isSystem ? (
            <div className="flex h-14 w-full items-center px-4 rounded-2xl bg-muted/30 border opacity-50">
              <span className="text-xl">{category.icon}</span>
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
          <div className="flex flex-wrap gap-3 pt-2">
            {CATEGORY_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                disabled={category.isSystem}
                onClick={() => form.setValue("color", color)}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-50 ${
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
        <div className="fixed bottom-0 left-1/2 w-full max-w-lg -translate-x-1/2 bg-background/80 p-5 backdrop-blur-md">
          <Button
            type="submit"
            className="h-14 w-full rounded-full text-base font-bold shadow-md"
            disabled={updateCategory.isPending || category.isSystem}
          >
            {category.isSystem ? "Kategori Bawaan Sistem" : updateCategory.isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </div>
      </form>

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
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
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