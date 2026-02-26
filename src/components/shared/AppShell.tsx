"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BottomNav } from "./BottomNav";
import { FAB } from "./FAB";
import { AddTransactionSheet } from "../transaction/AddTransactionSheet";

const HIDDEN_ROUTES = ["/login", "/register", "/onboarding"];

const TOP_LEVEL_ROUTES = [
  "/dashboard",
  "/transactions",
  "/wallets",
  "/budget",
  "/profile",
];

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

  // Hide nav on specific explicit routes OR on any subpage (e.g., /profile/categories)
  const isExplicitlyHidden = HIDDEN_ROUTES.some((route) => pathname.startsWith(route));
  const isTopLevel = TOP_LEVEL_ROUTES.includes(pathname);
  const isHidden = isExplicitlyHidden || !isTopLevel;

  return (
    <div className="bg-background min-h-screen">
      <div className="relative mx-auto min-h-screen max-w-lg">
        {/* We keep the inner div scrollable */}
        <div className={`scrollbar-hide overflow-y-auto ${isHidden ? "" : "pb-28"}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="min-h-screen"
            >
              {children}
            </motion.div>
          </AnimatePresence>
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
