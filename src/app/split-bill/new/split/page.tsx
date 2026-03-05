"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSplitBill, hasUnassignedItems, getParticipantShare } from "@/components/split-bill/split-bill-context";
import { ParticipantBar } from "@/components/split-bill/ParticipantBar";
import { SplitItemRow } from "@/components/split-bill/SplitItemRow";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SplitPage() {
  const router = useRouter();
  const { state, dispatch } = useSplitBill();
  const [activeParticipantId, setActiveParticipantId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect to items page if no items
  useEffect(() => {
    if (mounted && state.items.length === 0) {
      router.push("/split-bill/new/items");
    }
  }, [mounted, state.items.length, router]);

  const handleSetAssignment = (participantId: string, itemId: string, qty: number) => {
    dispatch({ type: "SET_ASSIGNMENT", participantId, itemId, qty });
  };

  const activeParticipant =
    activeParticipantId !== null
      ? state.participants.find((p) => p.id === activeParticipantId)
      : null;

  const share =
    activeParticipantId !== null && activeParticipant
      ? getParticipantShare(activeParticipant, state)
      : null;

  const unassignedItems = hasUnassignedItems(state);

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/split-bill/new/items" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">Bagi Tagihan</h1>
        </div>
      </header>

      <main className="flex-1 space-y-6 p-4">
        {/* Participant Bar */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Peserta</h2>
          <ParticipantBar
            activeParticipantId={activeParticipantId}
            onSetActive={setActiveParticipantId}
          />
        </section>

        {/* Bill Items */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Daftar Item</h2>
          <div className="space-y-3">
            {state.items.map((item) => (
              <SplitItemRow
                key={item.id}
                item={item}
                activeParticipantId={activeParticipantId}
                onSetAssignment={handleSetAssignment}
              />
            ))}
          </div>
        </section>

        {/* Active Participant Summary */}
        {activeParticipantId !== null && activeParticipant && share && (
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium">
              Bagian {activeParticipant.name}
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Item</span>
                <span>Rp {share.itemsTotal.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bagian Pajak</span>
                <span>Rp {share.taxShare.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bagian Diskon</span>
                <span className="text-destructive">
                  -Rp {share.discountShare.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span className="text-primary">
                  Rp {share.total.toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* No participant selected message */}
        {activeParticipantId === null && (
          <section className="rounded-lg border bg-muted/50 p-4 text-center">
            <p className="text-muted-foreground text-sm">
              Pilih peserta di atas untuk melihat dan mengatur bagiannya
            </p>
          </section>
        )}
      </main>

      {/* Sticky Footer */}
      <footer className="sticky bottom-0 border-t bg-background p-4">
        <Link href={unassignedItems ? "#" : "/split-bill/new/preview"}>
          <Button
            className="w-full"
            disabled={unassignedItems}
            style={{ pointerEvents: unassignedItems ? "none" : "auto" }}
          >
            {unassignedItems
              ? "Selesaikan pembagian semua item"
              : "Lanjut ke Preview"}
          </Button>
        </Link>
      </footer>
    </div>
  );
}
