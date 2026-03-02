"use client";

import React, { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { api } from "@/trpc/react";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { useAnalytics } from "@/hooks/use-analytics";

interface InviteMemberDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Drawer for inviting a new member to the workspace.
 * Input: email address.
 */
export function InviteMemberDrawer({
  open,
  onOpenChange,
}: InviteMemberDrawerProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const { workspaceId } = useActiveWorkspace();
  const { trackEvent } = useAnalytics();

  const inviteMember = api.workspace.inviteMember.useMutation({
    onSuccess: () => {
      setEmail("");
      setError("");
      trackEvent("member_invited");
      onOpenChange(false);
    },
    onError: (err) => {
      setError(err.message);
    }
  });

  const handleSubmit = () => {
    if (email.trim().length === 0 || !workspaceId) return;
    setError("");
    inviteMember.mutate({ workspaceId, email: email.trim() });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[60dvh]">
        <DrawerHeader>
          <DrawerTitle>Undang Anggota</DrawerTitle>
        </DrawerHeader>
        <div className="space-y-4 px-4 pb-6">
          {error && (
            <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Email field */}
          <div className="space-y-2">
            <Label
              htmlFor="invite-email"
              className="text-xs font-medium text-muted-foreground"
            >
              Email
            </Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="h-14 rounded-2xl border-border"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Undangan akan dikirim melalui email. Penerima harus memiliki akun
            Dompetin untuk bergabung.
          </p>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={email.trim().length === 0 || inviteMember.isPending}
            className="h-12 w-full rounded-full bg-primary text-base font-semibold text-white hover:bg-primary active:scale-[0.97] transition-transform duration-150"
          >
            {inviteMember.isPending ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              "Kirim Undangan"
            )}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
