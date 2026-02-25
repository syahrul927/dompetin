"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { FAB } from "./FAB";
import { AddTransactionSheet } from "../transaction/AddTransactionSheet";
import { AppTransition } from "./AppTransition";

const HIDDEN_ROUTES = ["/login", "/register", "/onboarding"];

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * The root layout wrapper for all authenticated pages.
 * Constrains width to mobile (390px max), provides scrollable content area,
 * and renders BottomNav and FAB at the bottom.
 */
export function AppShell({ children }: AppShellProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const pathname = usePathname();

  const isHidden = HIDDEN_ROUTES.some((route) => pathname.startsWith(route));

  return (
    <div className="bg-background min-h-screen">
      <div className="relative mx-auto min-h-screen max-w-lg">
        {/* We keep the inner div scrollable */}
        <div className="scrollbar-hide overflow-y-auto pb-28">
          <AppTransition>{children}</AppTransition>
        </div>

        {!isHidden && (
          <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2">
            <BottomNav />
            <FAB onClick={() => setIsAddOpen(true)} />
          </div>
        )}
      </div>

      <AddTransactionSheet open={isAddOpen} onOpenChange={setIsAddOpen} />
    </div>
  );
}
