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
import { useAnalytics } from "@/hooks/use-analytics";
import Link from "next/link";

type CategoryType = "expense" | "income";

export default function CategoriesPage() {
  const router = useRouter();
  const { workspaceId } = useActiveWorkspace();
  const { trackEvent } = useAnalytics();
  const [activeTab, setActiveTab] = useState<CategoryType>("expense");

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

      <div className="px-5 pb-36 pt-2">
        {/* Type Toggle */}
        <div className="mb-6 flex rounded-xl bg-muted/50 p-1">
          <button
            onClick={() => {
              setActiveTab("expense");
              trackEvent("categories_tab_changed", { type: "expense" });
            }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
              activeTab === "expense"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pengeluaran
          </button>
          <button
            onClick={() => {
              setActiveTab("income");
              trackEvent("categories_tab_changed", { type: "income" });
            }}
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
                onClick={() => router.push(`/profile/categories/${cat.id}/edit`)}
              />
            ))}
        </div>

        {/* Add Button */}
        <div className="fixed bottom-0 left-1/2 w-full max-w-lg -translate-x-1/2 bg-background/80 p-5 backdrop-blur-md">
          <Link
            href={`/profile/categories/create?type=${activeTab}`}
            onClick={() => trackEvent("category_create_initiated", { type: activeTab })}
          >
            <Button className="h-14 w-full rounded-full text-base font-bold shadow-md shadow-primary/20">
              <Plus size={20} className="mr-2" /> Tambah Kategori
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
