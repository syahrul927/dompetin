# Category Pages Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the category creation and editing flows from nested Vaul drawers into dedicated Next.js pages to resolve mobile scrolling and nesting UX issues.

**Architecture:**
1. Create `src/app/profile/categories/create/page.tsx`
2. Create `src/app/profile/categories/[id]/edit/page.tsx`
3. Update `src/app/profile/categories/page.tsx` to use links instead of state for drawers
4. Delete the old drawer components (`CreateCategoryDrawer` and `EditCategoryDrawer`)
5. Update `CategoryIconPicker` to not be a `nested` drawer anymore since it will now be the primary drawer on the new pages.

**Tech Stack:** Next.js 15, React Hook Form, Zod, tRPC, Tailwind CSS

---

### Task 1: Create the Create Category Page

**Files:**
- Create: `src/app/profile/categories/create/page.tsx`

**Step 1: Write the Create Category Page**

```tsx
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
```

**Step 2: Commit**
```bash
git add src/app/profile/categories/create/page.tsx
git commit -m "feat(category): add create category page"
```

### Task 2: Create the Edit Category Page

**Files:**
- Create: `src/app/profile/categories/[id]/edit/page.tsx`

**Step 1: Write the Edit Category Page**

```tsx
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
      router.back();
    },
  });

  const deleteCategory = api.category.deleteCategory.useMutation({
    onSuccess: async () => {
      await utils.category.getCategories.invalidate();
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
```

**Step 2: Commit**
```bash
git add src/app/profile/categories/[id]/edit/page.tsx
git commit -m "feat(category): add edit category page"
```

### Task 3: Update Category List and Cleanup

**Files:**
- Modify: `src/app/profile/categories/page.tsx`
- Modify: `src/components/categories/CategoryIconPicker.tsx`
- Delete: `src/components/categories/CreateCategoryDrawer.tsx`
- Delete: `src/components/categories/EditCategoryDrawer.tsx`

**Step 1: Update Categories Page to use Links**

In `src/app/profile/categories/page.tsx`, remove drawer imports and state. Wrap the Add Button in a Link, and use `router.push` for list items.

```tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { api } from "@/trpc/react";
import { CategoryListItem } from "@/components/categories/CategoryListItem";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

type CategoryType = "expense" | "income";

export default function CategoriesPage() {
  const router = useRouter();
  const { workspaceId } = useActiveWorkspace();
  const [activeTab, setActiveTab] = useState<CategoryType>("expense");

  const { data: categories, isLoading } = api.category.getCategories.useQuery(
    { workspaceId, type: activeTab },
    { enabled: !!workspaceId }
  );

  return (
    <>
      <PageHeader variant="back" title="Kategori" onBack={() => router.back()} />

      <div className="px-5 pt-2 pb-28">
        {/* Type Toggle */}
        <div className="mb-6 flex rounded-xl bg-muted/50 p-1">
          <button
            onClick={() => setActiveTab("expense")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
              activeTab === "expense" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pengeluaran
          </button>
          <button
            onClick={() => setActiveTab("income")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
              activeTab === "income" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pemasukan
          </button>
        </div>

        {/* Category List */}
        <div className="space-y-1">
          {isLoading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <Skeleton className="h-10 w-10 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}

          {!isLoading && categories?.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">Belum ada kategori</div>
          )}

          {!isLoading && categories?.map((cat) => (
            <CategoryListItem
              key={cat.id}
              category={cat}
              onClick={() => router.push(`/profile/categories/${cat.id}/edit`)}
            />
          ))}
        </div>

        {/* Add Button */}
        <div className="fixed bottom-0 left-1/2 w-full max-w-lg -translate-x-1/2 bg-background/80 p-5 backdrop-blur-md">
          <Link href={`/profile/categories/create?type=${activeTab}`}>
            <Button className="h-14 w-full rounded-full text-base font-bold shadow-md shadow-primary/20">
              <Plus size={20} className="mr-2" /> Tambah Kategori
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
```

**Step 2: Update Icon Picker**

In `src/components/categories/CategoryIconPicker.tsx`, ensure the drawer is NOT nested:

```tsx
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
```

**Step 3: Remove old files and Typecheck**

Run:
```bash
rm src/components/categories/CreateCategoryDrawer.tsx
rm src/components/categories/EditCategoryDrawer.tsx
pnpm typecheck && pnpm lint
```

**Step 4: Commit**

```bash
git add src/app/profile/categories/page.tsx src/components/categories/CategoryIconPicker.tsx
git rm src/components/categories/CreateCategoryDrawer.tsx src/components/categories/EditCategoryDrawer.tsx
git commit -m "refactor(category): replace drawers with dedicated pages for category management"
```