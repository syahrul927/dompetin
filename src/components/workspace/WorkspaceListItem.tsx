"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronRight } from "lucide-react";

interface WorkspaceListItemProps {
  workspace: {
    id: string;
    name: string;
    icon: string;
    isOwner: boolean;
    memberCount: number;
    walletCount: number;
  };
  isActive: boolean;
  onSelect: () => void;
}

/**
 * A workspace row in the workspace list.
 * Shows icon, name, role badge, member/wallet count, and active indicator.
 */
export function WorkspaceListItem({
  workspace,
  isActive,
  onSelect,
}: WorkspaceListItemProps) {
  return (
    <Card
      onClick={onSelect}
      className={`flex cursor-pointer items-center gap-4 rounded-[20px] p-4 transition-colors active:bg-muted/50 ${
        isActive ? "border-primary/40 bg-primary/5" : ""
      }`}
    >
      {/* Icon */}
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-muted text-lg">
        {workspace.icon}
      </div>

      {/* Name + Meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-base font-semibold text-foreground">
            {workspace.name}
          </p>
          <Badge
            variant="secondary"
            className={`text-[10px] font-medium ${
              workspace.isOwner
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {workspace.isOwner ? "Pemilik" : "Anggota"}
          </Badge>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {workspace.memberCount} anggota · {workspace.walletCount} dompet
        </p>
      </div>

      {/* Active indicator or chevron */}
      {isActive ? (
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary">
          <Check size={14} className="text-white" />
        </div>
      ) : (
        <ChevronRight
          size={16}
          className="flex-shrink-0 text-muted-foreground/60"
        />
      )}
    </Card>
  );
}
