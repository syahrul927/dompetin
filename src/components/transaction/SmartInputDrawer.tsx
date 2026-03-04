"use client";

import React, { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Send, Loader2, AlertCircle } from "lucide-react";
import { api } from "@/trpc/react";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/hooks/use-analytics";

interface SmartInputDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "text" | "voice";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess: (data: any) => void;
}

export function SmartInputDrawer({ open, onOpenChange, mode, onSuccess }: SmartInputDrawerProps) {
  const { workspaceId } = useActiveWorkspace();
  const { trackEvent } = useAnalytics();

  const [text, setText] = useState("");
  const { isListening, transcript, isSupported, startListening, stopListening } = useSpeechRecognition();

  // Queries to get IDs
  const { data: wallets } = api.wallet.getWallets.useQuery({ workspaceId }, { enabled: open && !!workspaceId });
  const { data: categories } = api.category.getCategories.useQuery({ workspaceId, type: "expense" }, { enabled: open && !!workspaceId });

  const parseMutation = api.ai.parseTransactionText.useMutation();

  // Sync transcript to text state when in voice mode
  useEffect(() => {
    if (mode === "voice" && transcript) {
      setText(transcript);
    }
  }, [transcript, mode]);

  // Auto-start listening in voice mode
  useEffect(() => {
    if (open && mode === "voice" && isSupported && !isListening) {
      startListening();
    } else if (!open && isListening) {
      stopListening();
    }
  }, [open, mode, isSupported, isListening, startListening, stopListening]);

  const handleSend = async () => {
    if (!text.trim() || parseMutation.isPending) return;

    if (isListening) stopListening();

    try {
      trackEvent("smart_input_initiated", { mode });

      const mappedWallets = wallets?.map(w => ({ id: w.id, name: w.name })) || [];
      const mappedCategories = categories?.map(c => ({ id: c.id, name: c.name })) || [];

      const result = await parseMutation.mutateAsync({
        text,
        availableWallets: mappedWallets,
        availableCategories: mappedCategories,
      });

      if (result.success) {
        trackEvent("smart_input_success", { mode });
        setText("");
        onSuccess(result);
      } else {
        alert(result.notes || "Gagal memproses data.");
      }
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan sistem.");
    }
  };

  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[28px]">
        <DrawerHeader>
          <DrawerTitle>{mode === "voice" ? "Input Suara" : "Input Teks Cerdas"}</DrawerTitle>
        </DrawerHeader>
        <div className="p-5 pb-8 space-y-4">
          {!isSupported && mode === "voice" && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-xl">
              <AlertCircle size={16} />
              <span>Browser tidak mendukung fitur suara.</span>
            </div>
          )}

          <div className="relative">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={mode === "voice" ? "Bicara sekarang..." : "Contoh: Makan siang 50rb pakai gopay"}
              className="min-h-32 rounded-2xl resize-none pb-12 text-base"
              disabled={parseMutation.isPending || (mode === "voice" && isListening)}
            />

            {mode === "voice" && isSupported && (
              <Button
                size="icon"
                variant={isListening ? "destructive" : "secondary"}
                className={cn("absolute bottom-3 left-3 rounded-full transition-all duration-300",
                  isListening && "animate-pulse scale-110 shadow-lg shadow-destructive/40"
                )}
                onClick={handleMicToggle}
                disabled={parseMutation.isPending}
              >
                <Mic size={18} />
              </Button>
            )}

            <Button
              size="icon"
              className="absolute bottom-3 right-3 rounded-full bg-primary"
              onClick={handleSend}
              disabled={!text.trim() || parseMutation.isPending}
            >
              {parseMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}