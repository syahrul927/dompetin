"use client";

import React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const INCOME_CATEGORIES = [
  { id: "gaji", label: "Gaji" },
  { id: "freelance", label: "Freelance" },
  { id: "bisnis", label: "Bisnis" },
  { id: "investasi", label: "Investasi" },
  { id: "hadiah", label: "Hadiah" },
  { id: "lainnya", label: "Lainnya" },
];

const EXPENSE_CATEGORIES = [
  { id: "makanan", label: "Makanan" },
  { id: "transportasi", label: "Transportasi" },
  { id: "belanja", label: "Belanja" },
  { id: "hiburan", label: "Hiburan" },
  { id: "tagihan", label: "Tagihan" },
  { id: "kesehatan", label: "Kesehatan" },
  { id: "pendidikan", label: "Pendidikan" },
  { id: "tabungan", label: "Tabungan" },
  { id: "lainnya", label: "Lainnya" },
];

interface CategoryPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "income" | "expense";
  selectedCategory?: string;
  onSelect: (categoryId: string) => void;
}

/**
 * Nested picker drawer for category selection.
 * Uses vaul's `nested` prop so it animates and dismisses independently
 * from the parent AddTransactionSheet drawer.
 */
export function CategoryPicker({
  open,
  onOpenChange,
  type,
  selectedCategory,
  onSelect,
}: CategoryPickerProps) {
  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} nested>
      <DrawerContent className="max-h-[60dvh]">
        <DrawerHeader>
          <DrawerTitle>Pilih Kategori</DrawerTitle>
        </DrawerHeader>
        <div className="grid grid-cols-2 gap-2 px-4 pb-6">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant="ghost"
              onClick={() => {
                onSelect(category.id);
                onOpenChange(false);
              }}
              className={`flex h-auto items-center justify-between rounded-2xl p-4 text-left ${
                selectedCategory === category.id
                  ? "bg-primary/10 hover:bg-primary/20"
                  : "hover:bg-muted"
              }`}
            >
              <span className="text-sm font-medium text-foreground">
                {category.label}
              </span>
              {selectedCategory === category.id && (
                <Check size={16} className="text-primary" />
              )}
            </Button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
