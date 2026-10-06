"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { Webhook, Copy, RefreshCw, Trash2, Plus, Check } from "lucide-react";

const WEBHOOK_PATH = "/api/shortcut/expense";

/**
 * Webhook integration management page.
 * One webhook per user per workspace; the plain key is shown only once
 * on create/regenerate.
 */
export default function IntegrationsPage() {
  const router = useRouter();
  const { workspaceId } = useActiveWorkspace();
  const apiUtils = api.useUtils();

  const { data: webhooks, isLoading } = api.webhook.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("iOS Shortcut");
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false);
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false);

  // origin only exists client-side; set after mount to avoid hydration mismatch
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const createMutation = api.webhook.create.useMutation({
    onSuccess: (data) => {
      setShownKey(data.secretKey);
      setCreateOpen(false);
      void apiUtils.webhook.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "Gagal membuat webhook"),
  });
  const regenerateMutation = api.webhook.regenerate.useMutation({
    onSuccess: (data) => setShownKey(data.secretKey),
    onError: (e) => toast.error(e.message || "Gagal regenerate key"),
  });
  const revokeMutation = api.webhook.revoke.useMutation({
    onSuccess: () => {
      toast.success("Webhook dihapus");
      void apiUtils.webhook.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "Gagal menghapus webhook"),
  });

  const copy = (text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(label);
        setTimeout(() => setCopied(null), 1500);
      })
      .catch(() => toast.error("Gagal menyalin ke clipboard"));
  };

  const activeWebhook = webhooks?.[0];
  const webhookUrl = `${origin}${WEBHOOK_PATH}`;
  const curlSample = [
    `curl -X POST ${webhookUrl} \\`,
    `  -H "secret-key: ${shownKey ?? ""}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"message": "Transfer Berhasil Rp 300.000 ke NAMA PENERIMA"}'`,
  ].join("\n");

  return (
    <AppShell>
      <PageHeader
        variant="back"
        title="Integrasi Webhook"
        onBack={() => router.back()}
      />

      <div className="space-y-4 px-5 pt-2 pb-10">
        <p className="text-sm text-muted-foreground">
          Kirim transaksi otomatis dari Shortcut iOS atau aplikasi lain lewat
          webhook. Satu webhook per pengguna per workspace.
        </p>

        {isLoading && <Skeleton className="h-20 w-full rounded-[20px]" />}

        {!isLoading && !activeWebhook && (
          <Card className="rounded-[20px] border-dashed bg-secondary/20 p-8 text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              Belum ada webhook untuk workspace ini.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={16} className="mr-2" /> Buat Webhook
            </Button>
          </Card>
        )}

        {!isLoading && activeWebhook && (
          <Card className="space-y-3 rounded-[20px] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-primary/10">
                <Webhook size={18} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{activeWebhook.name}</p>
                <p className="text-xs text-muted-foreground">
                  Dibuat{" "}
                  {new Date(activeWebhook.createdAt).toLocaleDateString("id-ID")}
                  {activeWebhook.lastUsedAt
                    ? ` · Terakhir dipakai ${new Date(activeWebhook.lastUsedAt).toLocaleString("id-ID")}`
                    : " · Belum pernah dipakai"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setConfirmRegenerateOpen(true)}
              >
                <RefreshCw size={14} className="mr-1" /> Regenerate
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-destructive"
                onClick={() => setConfirmRevokeOpen(true)}
              >
                <Trash2 size={14} className="mr-1" /> Hapus
              </Button>
            </div>
          </Card>
        )}

        {/* Key shown once dialog */}
        <Dialog open={!!shownKey} onOpenChange={(o) => !o && setShownKey(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Simpan key sekarang</DialogTitle>
              <DialogDescription>
                Key hanya ditampilkan sekali. Tidak bisa dilihat lagi setelah
                ditutup.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-xs">
              {/* Full webhook URL row + copy button */}
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-secondary px-2 py-1.5">
                  {webhookUrl}
                </code>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => copy(webhookUrl, "url")}
                  disabled={!origin}
                >
                  {copied === "url" ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
              {/* Secret key row + copy button */}
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-secondary px-2 py-1.5 break-all">
                  {shownKey}
                </code>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => shownKey && copy(shownKey, "key")}
                >
                  {copied === "key" ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
              {/* Sample cURL snippet + copy button */}
              <div className="pt-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium">
                    Contoh cURL (untuk Shortcut iOS)
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => copy(curlSample, "curl")}
                  >
                    {copied === "curl" ? <Check size={14} /> : <Copy size={14} />}
                  </Button>
                </div>
                <pre className="overflow-x-auto rounded bg-secondary p-2 text-[11px] leading-relaxed whitespace-pre">
                  {curlSample}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat Webhook</DialogTitle>
            </DialogHeader>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama webhook"
            />
            <Button
              disabled={!name.trim() || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({ workspaceId, name: name.trim() })
              }
            >
              {createMutation.isPending
                ? "Membuat..."
                : "Buat & Tampilkan Key"}
            </Button>
          </DialogContent>
        </Dialog>

        {/* Regenerate confirmation */}
        <AlertDialog
          open={confirmRegenerateOpen}
          onOpenChange={setConfirmRegenerateOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Regenerate key?</AlertDialogTitle>
              <AlertDialogDescription>
                Key lama akan berhenti bekerja. Shortcut yang memakai key lama
                perlu diperbarui.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                disabled={regenerateMutation.isPending}
                onClick={() =>
                  activeWebhook &&
                  regenerateMutation.mutate({ id: activeWebhook.id })
                }
              >
                Regenerate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Revoke confirmation */}
        <AlertDialog
          open={confirmRevokeOpen}
          onOpenChange={setConfirmRevokeOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus webhook ini?</AlertDialogTitle>
              <AlertDialogDescription>
                Webhook akan dihapus dan key tidak bisa dipakai lagi. Kamu bisa
                membuat webhook baru setelahnya.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={revokeMutation.isPending}
                onClick={() =>
                  activeWebhook && revokeMutation.mutate({ id: activeWebhook.id })
                }
              >
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}
