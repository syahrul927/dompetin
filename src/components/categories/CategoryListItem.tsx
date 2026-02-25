"use client";

import React from "react";
import { getCategoryIcon } from "@/lib/category-icons";
import { ChevronRight } from "lucide-react";

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  isSystem?: boolean;
}

interface CategoryListItemProps {
  category: Category;
  onClick?: () => void;
  showChevron?: boolean;
}

/**
 * A tappable row displaying a category, its icon, and an optional chevron.
 */
export function CategoryListItem({
  category,
  onClick,
  showChevron = true,
}: CategoryListItemProps) {
  const Icon = getCategoryIcon(category.icon);

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 py-3 ${
        onClick ? "cursor-pointer active:bg-muted/30 transition-colors" : ""
      }`}
    >
      {/* Icon */}
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
        style={{
          backgroundColor: `${category.color}20`, // 20% opacity using hex
          color: category.color,
        }}
      >
        <Icon size={20} />
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{category.name}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {category.isSystem ? "Sistem" : "Kustom"}
        </p>
      </div>

      {/* Action / Chevron */}
      {showChevron && onClick && (
        <ChevronRight size={16} className="text-muted-foreground/50" />
      )}
    </div>
  );
}
