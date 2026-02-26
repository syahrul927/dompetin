"use client";

import React, { useState } from "react";
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_ICONS_BY_GROUP,
  getCategoryIcon,
  CATEGORY_ICONS,
} from "@/lib/category-icons";
import { ChevronDown } from "lucide-react";

interface CategoryIconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  /**
   * If provided, will only show icons related to this group first.
   */
  defaultGroup?: string;
}

const CATEGORY_GROUP_LABELS: Record<string, string> = {
  makanan: "Makanan & Minuman",
  transportasi: "Transportasi",
  belanja: "Belanja",
  hiburan: "Hiburan",
  tagihan: "Tagihan & Utilitas",
  kesehatan: "Kesehatan",
  pendidikan: "Pendidikan",
  pemasukan: "Pemasukan",
  investasi: "Investasi",
  lainnya: "Lainnya",
};

/**
 * Drawer for selecting a category icon.
 */
export function CategoryIconPicker({
  value,
  onChange,
  defaultGroup,
}: CategoryIconPickerProps) {
  const [open, setOpen] = useState(false);
  const SelectedIcon = getCategoryIcon(value);

  const handleSelect = (iconName: string) => {
    onChange(iconName);
    setOpen(false);
  };

  // Sort groups: if defaultGroup is provided, put it first.
  const groups = Object.keys(CATEGORY_ICONS_BY_GROUP).sort((a, b) => {
    if (a === defaultGroup) return -1;
    if (b === defaultGroup) return 1;
    return 0;
  });

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          type="button"
          className="h-11 w-full justify-between rounded-xl px-4 text-left font-normal"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SelectedIcon size={16} />
            </div>
            <span>Pilih Ikon</span>
          </div>
          <ChevronDown size={16} className="text-muted-foreground opacity-50" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85vh] px-0 pb-0">
        <div className="px-5 pb-4 pt-2">
          <div className="mb-4 text-center">
            <DrawerTitle className="text-lg font-bold text-foreground">Pilih Ikon</DrawerTitle>
            <p className="text-sm text-muted-foreground">
              Pilih ikon untuk kategori ini
            </p>
          </div>

          <div className="h-[50vh] overflow-y-auto overflow-x-hidden pr-2">
            <div className="space-y-6">
              {groups.map((group) => {
                const iconNames = CATEGORY_ICONS_BY_GROUP[group] || [];
                if (iconNames.length === 0) return null;

                return (
                  <div key={group}>
                    <h3 className="mb-3 text-sm font-semibold text-foreground">
                      {CATEGORY_GROUP_LABELS[group] || group}
                    </h3>
                    <div className="grid grid-cols-5 gap-3">
                      {iconNames.map((iconName) => {
                        const IconComponent = CATEGORY_ICONS[iconName];
                        if (!IconComponent) return null;

                        const isSelected = value === iconName;

                        return (
                          <button
                            key={iconName}
                            type="button"
                            onClick={() => handleSelect(iconName)}
                            className={`flex aspect-square flex-col items-center justify-center rounded-2xl transition-all active:scale-95 ${
                              isSelected
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "bg-muted text-foreground hover:bg-muted/80"
                            }`}
                          >
                            <IconComponent size={24} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
