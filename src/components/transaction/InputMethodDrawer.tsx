"use client";

import React from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { PenLine, Mic, MessageSquare, ScanLine, Camera, ImagePlus, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface InputMethodDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMethod: (method: "manual" | "voice" | "text" | "scan") => void;
  isScanning?: boolean;
  onCameraClick?: () => void;
  onGalleryClick?: () => void;
}

export function InputMethodDrawer({
  open,
  onOpenChange,
  onSelectMethod,
  isScanning,
  onCameraClick,
  onGalleryClick,
}: InputMethodDrawerProps) {
  const handleSelect = (method: "manual" | "voice" | "text" | "scan") => {
    onOpenChange(false);
    // Slight delay to allow this drawer to close smoothly before opening the next
    setTimeout(() => onSelectMethod(method), 300);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[28px]">
        <DrawerHeader>
          <DrawerTitle className="text-center">Pilih Mode Input</DrawerTitle>
        </DrawerHeader>
        <div className="grid grid-cols-2 gap-4 p-5 pb-8">
          <button
            onClick={() => handleSelect("manual")}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm transition-transform active:scale-95"
          >
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <PenLine size={24} />
            </div>
            <span className="text-sm font-semibold">Manual</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm transition-transform active:scale-95 relative"
                disabled={isScanning}
              >
                {isScanning && (
                  <div className="absolute inset-0 bg-background/50 rounded-2xl flex items-center justify-center z-10 backdrop-blur-[1px]">
                    <Loader2 className="animate-spin text-primary" size={24} />
                  </div>
                )}
                <div className="rounded-full bg-blue-500/10 p-3 text-blue-500">
                  <ScanLine size={24} />
                </div>
                <span className="text-sm font-semibold">Scan Struk</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48 rounded-xl z-[100]">
              <DropdownMenuItem
                onClick={() => {
                  onCameraClick?.();
                  handleSelect("scan");
                }}
                className="gap-2 cursor-pointer py-2.5"
              >
                <Camera className="h-4 w-4 text-muted-foreground" />
                <span>Ambil Foto</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  onGalleryClick?.();
                  handleSelect("scan");
                }}
                className="gap-2 cursor-pointer py-2.5"
              >
                <ImagePlus className="h-4 w-4 text-muted-foreground" />
                <span>Pilih dari Galeri</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={() => handleSelect("voice")}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm transition-transform active:scale-95"
          >
            <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-500">
              <Mic size={24} />
            </div>
            <span className="text-sm font-semibold">Suara</span>
          </button>

          <button
            onClick={() => handleSelect("text")}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm transition-transform active:scale-95"
          >
            <div className="rounded-full bg-amber-500/10 p-3 text-amber-500">
              <MessageSquare size={24} />
            </div>
            <span className="text-sm font-semibold">Teks Cerdas</span>
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}