"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { WorkspaceListItem } from "@/components/workspace/WorkspaceListItem";
import { MemberList } from "@/components/workspace/MemberList";
import { CreateWorkspaceDrawer } from "@/components/workspace/CreateWorkspaceDrawer";
import { InviteMemberDrawer } from "@/components/workspace/InviteMemberDrawer";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus } from "lucide-react";

import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { useAnalytics } from "@/hooks/use-analytics";
import { api } from "@/trpc/react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Workspace management page.
 * Shows workspace list, active workspace members, and actions to create/invite.
 */
export default function WorkspacePage() {
  const router = useRouter();
  const { workspaceId, setWorkspaceId } = useActiveWorkspace();
  const { trackEvent } = useAnalytics();
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [showInviteDrawer, setShowInviteDrawer] = useState(false);

  // Fetch workspaces
  const { data: workspaces, isLoading: isLoadingWorkspaces } =
    api.workspace.getWorkspaces.useQuery({});

  // Fetch members
  const { data: membersData, isLoading: isLoadingMembers } =
    api.workspace.getWorkspaceMembers.useQuery(
      { workspaceId },
      { enabled: !!workspaceId }
    );

  // Auto-select first workspace if none is selected
  useEffect(() => {
    if (!workspaceId && workspaces && workspaces.length > 0) {
      setWorkspaceId(workspaces[0]!.id);
    }
  }, [workspaceId, workspaces, setWorkspaceId]);

  const activeWorkspace = workspaces?.find((ws) => ws.id === workspaceId);
  const isOwner = activeWorkspace?.isOwner ?? false;

  const mappedMembers = membersData?.map((m) => {
    const initials = m.user.name.split(" ").map((n) => n[0]).join("").toUpperCase() || "??";
    return {
      id: m.userId,
      name: m.user.name,
      email: m.user.email,
      initials,
      role: m.role as "owner" | "admin" | "member" | "viewer",
    };
  }) ?? [];

  return (
    <AppShell>
      <PageHeader
        variant="back"
        title="Workspace"
        onBack={() => router.back()}
      />

      <div className="space-y-6 px-5 pt-2">
        {/* Workspace List */}
        <div>
          <SectionHeader title="Workspace Anda" />
          <div className="space-y-3">
            {isLoadingWorkspaces &&
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px] rounded-[20px]" />
              ))}

            {!isLoadingWorkspaces && workspaces?.map((workspace) => (
              <div
                key={workspace.id}
              >
                <WorkspaceListItem
                  workspace={workspace}
                  isActive={workspace.id === workspaceId}
                  onSelect={() => {
                    setWorkspaceId(workspace.id);
                    trackEvent("workspace_switched");
                    router.push("/dashboard");
                  }}
                />
              </div>
            ))}

            {/* Create Workspace Button */}
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDrawer(true);
                trackEvent("workspace_create_initiated");
              }}
              className="h-14 w-full rounded-[20px] border-dashed border-primary/40 text-sm font-semibold text-primary hover:bg-primary/5"
            >
              <Plus size={18} className="mr-2" />
              Buat Workspace Baru
            </Button>
          </div>
        </div>

        {/* Active Workspace Members */}
        {activeWorkspace && (
          <div>
            <SectionHeader
              title={`Anggota — ${activeWorkspace.name}`}
              action={
                isOwner
                  ? {
                      label: "Undang",
                      onClick: () => {
                        setShowInviteDrawer(true);
                        trackEvent("workspace_invite_initiated");
                      },
                    }
                  : undefined
              }
            />
            {isLoadingMembers ? (
              <div className="space-y-3 px-1"><Skeleton className="h-14 w-full rounded-2xl" /></div>
            ) : (
              <MemberList members={mappedMembers} isOwner={isOwner} />
            )}

            {/* Invite button (alternative) */}
            {isOwner && (
              <Button
                variant="outline"
                onClick={() => {
                  setShowInviteDrawer(true);
                  trackEvent("workspace_invite_initiated");
                }}
                className="mt-3 h-12 w-full rounded-[20px] border-dashed border-primary/40 text-sm font-semibold text-primary hover:bg-primary/5"
              >
                <UserPlus size={18} className="mr-2" />
                Undang Anggota
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Drawers */}
      <CreateWorkspaceDrawer
        open={showCreateDrawer}
        onOpenChange={setShowCreateDrawer}
      />
      <InviteMemberDrawer
        open={showInviteDrawer}
        onOpenChange={setShowInviteDrawer}
      />
    </AppShell>
  );
}
