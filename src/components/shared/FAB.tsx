"use client";

import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FABProps {
  onClick: () => void;
}

/**
 * The floating pink action button (+ Add Transaction).
 * Fixed position, bottom-right, above the bottom nav.
 */
export function FAB({ onClick }: FABProps) {
  return (
    <Button
      onClick={onClick}
      className="h-[66px] w-[66px] flex-shrink-0 rounded-full bg-primary shadow-[0_4px_16px_rgba(201,120,128,0.4)] transition-transform duration-150 hover:bg-primary active:scale-[0.93]"
    >
      <Plus size={26} className="stroke-[2.5] text-white" />
    </Button>
  );
}
