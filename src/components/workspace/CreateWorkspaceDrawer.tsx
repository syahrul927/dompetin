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
import { api } from "@/trpc/react";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { Loader2 } from "lucide-react";

interface CreateWorkspaceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Drawer for creating a new workspace.
 * Input: name (required), icon emoji (optional).
 */
export function CreateWorkspaceDrawer({
  open,
  onOpenChange,
}: CreateWorkspaceDrawerProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("💼");
  const { setWorkspaceId } = useActiveWorkspace();
  const utils = api.useUtils();

  const createWorkspace = api.workspace.createWorkspace.useMutation({
    onSuccess: async (data) => {
      // Invalidate queries so the new workspace shows up in lists
      await utils.workspace.getWorkspaces.invalidate();

      // Auto-select the newly created workspace
      if (data && data[0]?.id) {
        setWorkspaceId(data[0].id);
      }

      // Reset and close
      setName("");
      setIcon("💼");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Failed to create workspace:", error);
    }
  });

  const handleSubmit = () => {
    if (name.trim().length === 0) return;
    createWorkspace.mutate({ name: name.trim(), icon });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[70dvh]">
        <DrawerHeader>
          <DrawerTitle>Buat Workspace Baru</DrawerTitle>
        </DrawerHeader>
        <div className="space-y-4 px-4 pb-6">
          {/* Icon selector */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Ikon
            </Label>
            <div className="flex gap-2">
              {["💼", "🏠", "🏢", "💰", "🎯", "👥"].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl text-lg transition-colors ${
                    icon === emoji
                      ? "bg-primary/10 ring-2 ring-primary"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Name field */}
          <div className="space-y-2">
            <Label
              htmlFor="workspace-name"
              className="text-xs font-medium text-muted-foreground"
            >
              Nama Workspace
            </Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Misal: Keluarga"
              className="h-14 rounded-2xl border-border"
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={name.trim().length === 0 || createWorkspace.isPending}
            className="h-12 w-full rounded-full bg-primary text-base font-semibold text-white hover:bg-primary active:scale-[0.97] transition-transform duration-150"
          >
            {createWorkspace.isPending ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              "Buat Workspace"
            )}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
