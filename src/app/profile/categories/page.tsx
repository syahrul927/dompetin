"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { api } from "@/trpc/react";
import { CategoryListItem } from "@/components/categories/CategoryListItem";
import { CreateCategoryDrawer } from "@/components/categories/CreateCategoryDrawer";
import { EditCategoryDrawer } from "@/components/categories/EditCategoryDrawer";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type CategoryType = "expense" | "income";

/**
 * Category management page inside the Profile section.
 */
export default function CategoriesPage() {
  const router = useRouter();
  const { workspaceId } = useActiveWorkspace();
  const [activeTab, setActiveTab] = useState<CategoryType>("expense");
  const [showCreate, setShowCreate] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{
    id: string;
    name: string;
    type: string;
    icon: string;
    color: string;
    isSystem?: boolean;
  } | null>(null);

  const { data: categories, isLoading } = api.category.getCategories.useQuery(
    { workspaceId, type: activeTab },
    { enabled: !!workspaceId }
  );

  return (
    <>
      <PageHeader
        variant="back"
        title="Kategori"
        onBack={() => router.back()}
      />

      <div className="px-5 pt-2">
        {/* Type Toggle */}
        <div className="mb-6 flex rounded-xl bg-muted/50 p-1">
          <button
            onClick={() => setActiveTab("expense")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
              activeTab === "expense"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pengeluaran
          </button>
          <button
            onClick={() => setActiveTab("income")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
              activeTab === "income"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pemasukan
          </button>
        </div>

        {/* Category List */}
        <div className="space-y-1">
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <Skeleton className="h-10 w-10 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}

          {!isLoading && categories?.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Belum ada kategori
            </div>
          )}

          {!isLoading &&
            categories?.map((cat) => (
              <CategoryListItem
                key={cat.id}
                category={cat}
                onClick={() => setEditingCategory(cat)}
              />
            ))}
        </div>

        {/* Add Button */}
        <Button
          onClick={() => setShowCreate(true)}
          className="mt-6 h-14 w-full rounded-[20px] text-base font-bold shadow-md shadow-primary/20"
        >
          <Plus size={20} className="mr-2" />
          Tambah Kategori
        </Button>
      </div>

      <CreateCategoryDrawer
        open={showCreate}
        onOpenChange={setShowCreate}
        defaultType={activeTab}
      />

      <EditCategoryDrawer
        open={!!editingCategory}
        onOpenChange={(open) => !open && setEditingCategory(null)}
        category={editingCategory}
      />
    </>
  );
}
