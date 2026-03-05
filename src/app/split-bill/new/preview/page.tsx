"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useSplitBill,
  getGrandSubtotal,
  getFinalTotal,
  getParticipantShare,
} from "@/components/split-bill/split-bill-context";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { api } from "@/trpc/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ParticipantCard } from "@/components/split-bill/ParticipantCard";
import { formatIDR } from "@/lib/formatIDR";
import { useEffect } from "react";

export default function PreviewPage() {
  const router = useRouter();
  const { workspaceId } = useActiveWorkspace();
  const { state, dispatch } = useSplitBill();

  useEffect(() => {
    if (state.items.length === 0) {
      router.push("/split-bill/new/items");
    }
  }, [state.items.length, router]);

  const sortedParticipants = [...state.participants].sort((a, b) =>
    Number(b.isOwner) - Number(a.isOwner)
  );

  const createMutation = api.splitBill.create.useMutation({
    onSuccess: (result) => {
      dispatch({ type: "RESET" });
      router.push(`/split-bill/${result.id}`);
    },
  });

  const handleSave = () => {
    const title = state.items[0]?.name || "Split Bill";

    const subtotal = getGrandSubtotal(state.items);

    const participants = state.participants.map((p) => {
      const items = p.assignments.map((a) => {
        const item = state.items.find((i) => i.id === a.itemId);
        return {
          name: item?.name || "",
          qty: a.qty,
          price: item?.price || 0,
          subtotal: (item?.price || 0) * a.qty,
        };
      });

      const { itemsTotal, taxShare, discountShare, total } =
        getParticipantShare(p, state);

      return {
        name: p.name,
        isOwner: p.isOwner,
        items,
        taxShare,
        discountShare,
        total,
      };
    });

    const total = getFinalTotal(state);

    createMutation.mutate({
      workspaceId,
      title,
      subtotal,
      tax: state.tax,
      discount: state.discount,
      total,
      participants,
    });
  };

  if (state.items.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-background border-b z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/split-bill/new/split">
            <Button variant="ghost" size="icon" asChild>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold">Ringkasan</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Participants List */}
        <div className="space-y-4">
          {sortedParticipants.map((participant) => (
            <ParticipantCard
              key={participant.id}
              participant={participant}
              items={state.items}
              tax={state.tax}
              discount={state.discount}
            />
          ))}
        </div>

        {/* Grand Total Bar */}
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatIDR(getGrandSubtotal(state.items))}</span>
          </div>
          {state.tax > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>+Pajak</span>
              <span>+{formatIDR(state.tax)}</span>
            </div>
          )}
          {state.discount > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>-Diskon</span>
              <span>-{formatIDR(state.discount)}</span>
            </div>
          )}
          <div className="border-t pt-2 flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>{formatIDR(getFinalTotal(state))}</span>
          </div>
        </div>

        {/* Save & Share Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleSave}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            "Simpan & Bagikan"
          )}
        </Button>
      </div>
    </div>
  );
}
