"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Crown, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Member {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: "owner" | "member";
}

interface MemberListProps {
  members: Member[];
  isOwner: boolean;
}

/**
 * Member list section for the active workspace.
 * Shows avatar, name, email, and role badge for each member.
 */
export function MemberList({ members, isOwner }: MemberListProps) {
  return (
    <Card className="divide-y divide-border rounded-[20px]">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center gap-3 px-4 py-3"
        >
          {/* Avatar */}
          <Avatar className="h-9 w-9 bg-primary/10">
            <AvatarFallback className="text-xs font-bold text-primary">
              {member.initials}
            </AvatarFallback>
          </Avatar>

          {/* Name + Email */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-foreground">
                {member.name}
              </p>
              {member.role === "owner" && (
                <Crown size={12} className="text-primary" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{member.email}</p>
          </div>

          {/* Role Badge */}
          <Badge
            variant="secondary"
            className={`text-[10px] font-medium ${
              member.role === "owner"
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {member.role === "owner" ? "Pemilik" : "Anggota"}
          </Badge>

          {/* Actions (only visible to owner, and not on self) */}
          {isOwner && member.role !== "owner" && (
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal size={16} className="text-muted-foreground" />
            </Button>
          )}
        </div>
      ))}
    </Card>
  );
}
