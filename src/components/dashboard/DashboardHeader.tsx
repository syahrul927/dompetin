"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface DashboardHeaderProps {
  workspace: {
    name: string;
    icon: string;
  } | null;
  user: {
    name: string;
    initials: string;
    image?: string | null;
  } | null;
  isLoading?: boolean;
}

/**
 * Top bar with workspace selector pill and user avatar.
 */
export function DashboardHeader({ workspace, user, isLoading }: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between">
      <Link
        href="/workspace"
        className="flex items-center gap-1.5 rounded-full border border-border bg-card py-2 pl-2.5 pr-3.5 shadow-sm transition-transform active:scale-[0.97]"
      >
        {isLoading ? (
          <span className="h-4 w-20 animate-pulse rounded bg-muted" />
        ) : (
          <>
            <span className="text-sm">{workspace?.icon ?? "💼"}</span>
            <span className="text-[13px] font-semibold text-foreground">
              {workspace?.name ?? "Workspace"}
            </span>
            <ChevronDown size={12} className="text-muted-foreground" />
          </>
        )}
      </Link>

      <Link href="/profile">
        <Avatar className="h-9 w-9 bg-primary/10">
          {user?.image && <AvatarImage src={user.image} alt={user?.name ?? ""} />}
          <AvatarFallback className="text-xs font-bold text-primary">
            {user?.initials ?? "??"}
          </AvatarFallback>
        </Avatar>
      </Link>
    </header>
  );
}
