"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
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

const CATEGORY_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#10b981",
  "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899", "#f43f5e",
];

const createCategorySchema = z.object({
  name: z.string().min(1, "Nama kategori wajib diisi").max(255),
  type: z.enum(["income", "expense"]),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

type CreateCategoryValues = z.infer<typeof createCategorySchema>;

function CreateCategoryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultType = (searchParams.get("type") as "income" | "expense") || "expense";

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

  const createCategory = api.category.createCategory.useMutation({
    onSuccess: async () => {
      await utils.category.getCategories.invalidate();
      router.back();
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
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-5 pt-6 pb-28">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-semibold">Nama Kategori</Label>
        <Input
          id="name"
          placeholder="Contoh: Kopi, Bensin"
          className="h-14 rounded-2xl bg-muted/50 px-4 text-base"
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>

      {/* Type (Read Only / Hidden or just visual, let's keep it simple) */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Tipe Kategori</Label>
        <div className="h-14 flex items-center px-4 rounded-2xl bg-muted/30 border text-muted-foreground capitalize">
          {form.watch("type") === "expense" ? "Pengeluaran" : "Pemasukan"}
        </div>
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
        <div className="flex flex-wrap gap-3 pt-2">
          {CATEGORY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => form.setValue("color", color)}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-95 ${
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
          disabled={createCategory.isPending || !workspaceId}
        >
          {createCategory.isPending ? "Menyimpan..." : "Simpan Kategori"}
        </Button>
      </div>
    </form>
  );
}

export default function CreateCategoryPage() {
  const router = useRouter();

  return (
    <>
      <PageHeader variant="back" title="Kategori Baru" onBack={() => router.back()} />
      <Suspense fallback={<div className="p-5">Loading...</div>}>
        <CreateCategoryForm />
      </Suspense>
    </>
  );
}