"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";

export default function InvitationsPage() {
  const router = useRouter();
  const utils = api.useUtils();
  const { setWorkspaceId } = useActiveWorkspace();

  const { data: invitations, isLoading } = api.workspace.getPendingInvitations.useQuery();

  const respond = api.workspace.respondToInvitation.useMutation({
    onSuccess: async (_, variables) => {
      await utils.workspace.getPendingInvitations.invalidate();
      await utils.workspace.getWorkspaces.invalidate();

      // If accepted, find the workspace ID and switch to it
      if (variables.accept && invitations) {
        const acceptedInvite = invitations.find(inv => inv.id === variables.invitationId);
        if (acceptedInvite) {
          setWorkspaceId(acceptedInvite.workspaceId);
          router.push("/dashboard");
        }
      }
    }
  });

  return (
    <>
      <PageHeader variant="back" title="Undangan" onBack={() => router.back()} />
      <div className="px-5 pt-4 space-y-4">
        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        )}

        {!isLoading && (!invitations || invitations.length === 0) && (
          <p className="text-center text-sm text-muted-foreground py-10">Tidak ada undangan baru</p>
        )}

        {invitations?.map((inv) => (
          <div key={inv.id} className="rounded-[20px] bg-card p-5 border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                {inv.workspace.icon}
              </div>
              <div>
                <h3 className="font-bold text-foreground">{inv.workspace.name}</h3>
                <p className="text-xs text-muted-foreground">Dari: {inv.inviter.name}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1 rounded-xl bg-primary font-semibold"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ invitationId: inv.id, accept: true })}
              >
                Terima
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-xl font-semibold border-border"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ invitationId: inv.id, accept: false })}
              >
                Tolak
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}