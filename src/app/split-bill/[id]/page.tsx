"use client";

import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/trpc/react";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { Share2, Check, Loader2, Copy, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatIDR } from "@/lib/formatIDR";
import { useState } from "react";
import { toast } from "sonner";

export default function SplitBillResultPage() {
  const router = useRouter();
  const params = useParams();
  const { workspaceId } = useActiveWorkspace();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const { data: splitBill, isLoading, error } = api.splitBill.getById.useQuery(
    { id: params.id as string },
    { enabled: !!params.id }
  );

  const { data: wallets } = api.wallet.getWallets.useQuery(
    { workspaceId },
    { enabled: !!workspaceId && isAddDialogOpen }
  );

  const { data: categories } = api.category.getCategories.useQuery(
    { workspaceId, type: "expense" },
    { enabled: !!workspaceId && isAddDialogOpen }
  );

  const addToTransactionMutation = api.splitBill.addToTransaction.useMutation({
    onSuccess: () => {
      void router.refresh();
      toast.success("Berhasil ditambahkan ke transaksi");
      setIsAddDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Gagal menambahkan ke transaksi");
    },
  });

  const handleShare = async () => {
    if (!splitBill) return;

    const shareUrl = `${window.location.origin}/s/${splitBill.shareCode}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: splitBill.title,
          text: `Bagi tagihan: ${splitBill.title}`,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled or share failed, fall back to clipboard
        handleCopyLink(shareUrl);
      }
    } else {
      handleCopyLink(shareUrl);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link berhasil disalin");
  };

  const handleAddToTransaction = () => {
    if (!selectedWalletId) {
      toast.error("Pilih dompet terlebih dahulu");
      return;
    }

    addToTransactionMutation.mutate({
      splitBillId: params.id as string,
      walletId: selectedWalletId,
      categoryId: selectedCategoryId || undefined,
      date: new Date().toISOString(),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 bg-background border-b z-10">
          <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-6 w-40" />
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !splitBill) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-destructive mb-4">{error?.message || "Tagihan tidak ditemukan"}</p>
          <Link href="/dashboard">
            <Button>Kembali ke Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isAlreadyAdded = !!splitBill.transactionId;
  const subtotal = parseFloat(splitBill.subtotal);
  const tax = parseFloat(splitBill.tax);
  const discount = parseFloat(splitBill.discount);
  const total = parseFloat(splitBill.total);

  // Sort participants: owner first
  const sortedParticipants = [...splitBill.participants].sort((a, b) =>
    Number(b.isOwner) - Number(a.isOwner)
  );

  // Find owner participant for the "Tambah ke transaksi" feature
  const ownerParticipant = splitBill.participants.find((p) => p.isOwner);
  const ownerTotal = ownerParticipant ? parseFloat(ownerParticipant.total) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" asChild>
              <Home className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold flex-1 truncate">{splitBill.title}</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Share Banner */}
        <div className="rounded-lg border p-4 bg-primary/5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground mb-1">Bagikan tagihan</p>
              <p className="font-mono text-xs text-muted-foreground truncate">
                {window.location.origin}/s/{splitBill.shareCode}
              </p>
            </div>
            <Button size="sm" onClick={handleShare} variant="outline">
              <Share2 className="h-4 w-4 mr-2" />
              Bagikan
            </Button>
          </div>
        </div>

        {/* Participants List */}
        <div className="space-y-4">
          {sortedParticipants.map((participant) => (
            <div
              key={participant.id}
              className="rounded-lg border p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{participant.name}</h3>
                {participant.isOwner && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    Kamu
                  </span>
                )}
              </div>

              {/* Items */}
              {participant.items.length > 0 && (
                <div className="space-y-2 pl-2 border-l-2 border-border">
                  {participant.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.name} {item.qty > 1 ? `${item.qty}x` : ""}
                      </span>
                      <span>{formatIDR(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tax/Discount shares */}
              {parseFloat(participant.taxShare) > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>+Pajak</span>
                  <span>+{formatIDR(parseFloat(participant.taxShare))}</span>
                </div>
              )}

              {parseFloat(participant.discountShare) > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>-Diskon</span>
                  <span>-{formatIDR(parseFloat(participant.discountShare))}</span>
                </div>
              )}

              {/* Total */}
              <div className="border-t pt-3 flex justify-between font-bold">
                <span>Total</span>
                <span>{formatIDR(parseFloat(participant.total))}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Grand Total Summary */}
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatIDR(subtotal)}</span>
          </div>
          {tax > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>+Pajak</span>
              <span>+{formatIDR(tax)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>-Diskon</span>
              <span>-{formatIDR(discount)}</span>
            </div>
          )}
          <div className="border-t pt-2 flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>{formatIDR(total)}</span>
          </div>
        </div>

        {/* Add to Transaction Button (only if owner) */}
        {ownerParticipant && !isAlreadyAdded && (
          <Button
            className="w-full"
            size="lg"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Copy className="h-4 w-4 mr-2" />
            Tambah ke transaksi?
          </Button>
        )}

        {isAlreadyAdded && (
          <Button className="w-full" size="lg" variant="outline" disabled>
            <Check className="h-4 w-4 mr-2" />
            Sudah ditambahkan
          </Button>
        )}
      </div>

      {/* Add to Transaction Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah ke Transaksi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Dompet</label>
              <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih dompet" />
                </SelectTrigger>
                <SelectContent>
                  {wallets?.map((wallet) => (
                    <SelectItem key={wallet.id} value={wallet.id}>
                      {wallet.icon} {wallet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Kategori (opsional)</label>
              <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg bg-muted p-3 space-y-2">
              <div className="text-sm text-muted-foreground">Jumlah</div>
              <div className="text-2xl font-bold">{formatIDR(ownerTotal)}</div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              disabled={addToTransactionMutation.isPending}
            >
              Batal
            </Button>
            <Button
              onClick={handleAddToTransaction}
              disabled={addToTransactionMutation.isPending || !selectedWalletId}
            >
              {addToTransactionMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
