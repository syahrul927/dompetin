"use client";

import React, { useState } from "react";
import { authClient } from "@/server/better-auth/client";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await authClient.signOut();
      localStorage.removeItem("dompetin_workspace_id");
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="flex w-full items-center gap-4 rounded-2xl bg-card p-4 transition-colors active:bg-muted/50"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        {isLoading ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          <LogOut size={20} />
        )}
      </div>
      <p className="text-sm font-semibold text-destructive">
        {isLoading ? "Keluar..." : "Keluar"}
      </p>
    </button>
  );
}
