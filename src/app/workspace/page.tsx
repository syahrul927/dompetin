"use client";

import React, { useState } from "react";
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
import { api } from "@/trpc/react";
import { Skeleton } from "@/components/ui/skeleton";

// Mock members for active workspace
const MOCK_MEMBERS = [
  {
    id: "m-1",
    name: "Syahrul Ataufik",
    email: "syahrul@email.com",
    initials: "SA",
    role: "owner" as const,
  },
];

/**
 * Workspace management page.
 * Shows workspace list, active workspace members, and actions to create/invite.
 */
export default function WorkspacePage() {
  const router = useRouter();
  const { workspaceId, setWorkspaceId } = useActiveWorkspace();
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [showInviteDrawer, setShowInviteDrawer] = useState(false);

  // Fetch workspaces
  const { data: workspaces, isLoading: isLoadingWorkspaces } =
    api.workspace.getWorkspaces.useQuery({});

  // Auto-select first workspace if none is selected
  React.useEffect(() => {
    if (!workspaceId && workspaces && workspaces.length > 0) {
      setWorkspaceId(workspaces[0]!.id);
    }
  }, [workspaceId, workspaces, setWorkspaceId]);

  const activeWorkspace = workspaces?.find((ws) => ws.id === workspaceId);
  const isOwner = activeWorkspace?.isOwner ?? false;

  return (
    <AppShell>
      <PageHeader
        variant="back"
        title="Workspace"
        onBack={() => router.back()}
      />

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-200 space-y-6 px-5 pb-28">
        {/* Workspace List */}
        <div>
          <SectionHeader title="Workspace Anda" />
          <div className="space-y-3">
            {isLoadingWorkspaces &&
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px] rounded-[20px]" />
              ))}

            {!isLoadingWorkspaces && workspaces?.map((workspace, index) => (
              <div
                key={workspace.id}
                className="animate-in fade-in slide-in-from-bottom-1"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <WorkspaceListItem
                  workspace={workspace}
                  isActive={workspace.id === workspaceId}
                  onSelect={() => {
                    setWorkspaceId(workspace.id);
                    router.push("/dashboard");
                  }}
                />
              </div>
            ))}

            {/* Create Workspace Button */}
            <Button
              variant="outline"
              onClick={() => setShowCreateDrawer(true)}
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
                      onClick: () => setShowInviteDrawer(true),
                    }
                  : undefined
              }
            />
            {/* TODO: Connect MemberList to tRPC workspace.getMembers */}
            <MemberList members={MOCK_MEMBERS} isOwner={isOwner} />

            {/* Invite button (alternative) */}
            {isOwner && (
              <Button
                variant="outline"
                onClick={() => setShowInviteDrawer(true)}
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
