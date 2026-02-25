"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { WalletListItem } from "@/components/wallets/WalletListItem";
import { CreateWalletDrawer } from "@/components/wallets/CreateWalletDrawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Wallet } from "lucide-react";
import { api } from "@/trpc/react";
import { useState } from "react";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";

/**
 * Wallets list page — shows all wallets in the active workspace.
 */
export default function WalletsPage() {
  const router = useRouter();
  const { workspaceId } = useActiveWorkspace();
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  // Fetch current workspace info for the header
  const { data: workspace, isLoading: workspaceLoading } = api.workspace.getWorkspace.useQuery(
    { id: workspaceId },
    { enabled: !!workspaceId }
  );

  // Fetch wallets once workspace is available
  const { data: wallets, isLoading: walletsLoading } =
    api.wallet.getWallets.useQuery(
      { workspaceId },
      { enabled: !!workspaceId },
    );

  const isLoading = workspaceLoading || walletsLoading;

  return (
    <AppShell>
      <PageHeader
        title="Dompet"
        rightSlot={
          <span className="text-sm text-muted-foreground">
            {workspace?.name ?? ""}
          </span>
        }
      />
      <div className="space-y-3 px-5 pb-28">
        {/* Loading State */}
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-[20px]" />
          ))}

        {/* Empty State */}
        {!isLoading && wallets?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Wallet size={28} className="text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">
              Belum ada dompet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tambahkan dompet pertama Anda untuk mulai mencatat keuangan.
            </p>
          </div>
        )}

        {/* Wallet List */}
        {!isLoading &&
          wallets?.map((w, index) => (
            <div
              key={w.id}
            >
              <WalletListItem
                wallet={w}
                isFirst={index === 0}
                onClick={() => router.push(`/wallets/${w.id}`)}
              />
            </div>
          ))}

        {/* Add Wallet Button */}
        {!isLoading && (
          <Button
            variant="outline"
            className="h-14 w-full rounded-[20px] border-dashed border-primary/40 text-sm font-semibold text-primary hover:bg-primary/5"
            onClick={() => setShowCreateSheet(true)}
          >
            <Plus size={18} className="mr-2" />
            Tambah Dompet
          </Button>
        )}
      </div>

      {/* Create Wallet Drawer */}
      {workspace && (
        <CreateWalletDrawer
          open={showCreateSheet}
          onOpenChange={setShowCreateSheet}
          workspaceId={workspace.id}
        />
      )}
    </AppShell>
  );
}
