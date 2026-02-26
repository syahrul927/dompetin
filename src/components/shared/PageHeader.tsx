import React from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  variant?: "title" | "back";
  onBack?: () => void;
  rightSlot?: React.ReactNode;
}

/**
 * Top header bar used on secondary pages.
 * Two variants: title-only or back+centered title.
 */
export function PageHeader({
  title,
  variant = "title",
  onBack,
  rightSlot,
}: PageHeaderProps) {
  if (variant === "back") {
    return (
      <header className="flex items-center justify-between px-5 pb-4 pt-14">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-9 w-9 rounded-full bg-card shadow-sm"
        >
          <ChevronLeft size={18} className="text-foreground" />
        </Button>
        <h1 className="text-[17px] font-semibold">{title}</h1>
        <div className="h-9 w-9">{rightSlot}</div>
      </header>
    );
  }

  return (
    <header className="flex items-center justify-between px-5 pb-4 pt-14">
      <h1 className="text-[22px] font-bold">{title}</h1>
      {rightSlot}
    </header>
  );
}
