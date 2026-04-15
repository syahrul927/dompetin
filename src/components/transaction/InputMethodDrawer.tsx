"use client";

import React from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { PenLine, Mic, MessageSquare, ScanLine, Camera, ImagePlus, Loader2, Scissors, FileStack } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface InputMethodDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMethod: (method: "manual" | "voice" | "text" | "scan" | "mutation") => void;
  isScanning?: boolean;
  onCameraClick?: () => void;
  onGalleryClick?: () => void;
  isScanningMutation?: boolean;
  onMutationCameraClick?: () => void;
  onMutationGalleryClick?: () => void;
}

export function InputMethodDrawer({
  open,
  onOpenChange,
  onSelectMethod,
  isScanning,
  onCameraClick,
  onGalleryClick,
  isScanningMutation,
  onMutationCameraClick,
  onMutationGalleryClick,
}: InputMethodDrawerProps) {
  const handleSelect = (method: "manual" | "voice" | "text" | "scan" | "mutation") => {
    if (method === "scan" || method === "mutation") {
      onSelectMethod(method);
      return;
    }
    onOpenChange(false);
    setTimeout(() => onSelectMethod(method), 300);
  };

  const menuItemClass = "flex items-center gap-4 p-4 transition-colors active:bg-muted hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[28px]">
        <DrawerHeader>
          <DrawerTitle className="text-center">Pilih Mode Input</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-4 px-5 pb-8 pt-4">
          {/* Block 1: Direct Input Methods */}
          <div className="flex flex-col rounded-2xl border bg-card overflow-hidden shadow-sm">
            <button
              onClick={() => handleSelect("manual")}
              className={cn(menuItemClass, "border-b border-border/50")}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                <PenLine size={24} className="text-muted-foreground" />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-semibold text-sm">Manual</span>
                <span className="text-xs text-muted-foreground">Input transaksi satu per satu</span>
              </div>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(menuItemClass, "border-b border-border/50 relative text-left w-full")}
                  disabled={isScanning}
                >
                  {isScanning && (
                    <div className="absolute inset-0 bg-background/50 rounded-none flex items-center justify-center z-10 backdrop-blur-[1px]">
                      <Loader2 className="animate-spin text-primary" size={24} />
                    </div>
                  )}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                    <ScanLine size={24} className="text-muted-foreground" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-semibold text-sm">Scan Struk</span>
                    <span className="text-xs text-muted-foreground">Foto struk otomatis jadi transaksi</span>
                  </div>
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
              className={cn(menuItemClass, "border-b border-border/50")}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                <Mic size={24} className="text-muted-foreground" />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-semibold text-sm">Suara</span>
                <span className="text-xs text-muted-foreground">Sebutkan transaksi anda</span>
              </div>
            </button>

            <button
              onClick={() => handleSelect("text")}
              className={menuItemClass}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                <MessageSquare size={24} className="text-muted-foreground" />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-semibold text-sm">Teks Cerdas</span>
                <span className="text-xs text-muted-foreground">Ketik seperti sedang chat</span>
              </div>
            </button>
          </div>

          {/* Block 2: Utilities */}
          <div className="flex flex-col rounded-2xl border bg-card overflow-hidden shadow-sm">
            <Link
              href="/split-bill/new/items"
              onClick={() => onOpenChange(false)}
              className={cn(menuItemClass, "border-b border-border/50")}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                <Scissors size={24} className="text-muted-foreground" />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-semibold text-sm">Split Bill</span>
                <span className="text-xs text-muted-foreground">Bagi tagihan dengan teman</span>
              </div>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(menuItemClass, "relative text-left w-full")}
                  disabled={isScanningMutation}
                >
                  {isScanningMutation && (
                    <div className="absolute inset-0 bg-background/50 rounded-none flex items-center justify-center z-10 backdrop-blur-[1px]">
                      <Loader2 className="animate-spin text-primary" size={24} />
                    </div>
                  )}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                    <FileStack size={24} className="text-muted-foreground" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-semibold text-sm">Impor Mutasi</span>
                    <span className="text-xs text-muted-foreground">Scan mutasi bank & e-wallet</span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-48 rounded-xl z-[100]">
                <DropdownMenuItem
                  onClick={() => {
                    onMutationCameraClick?.();
                    handleSelect("mutation");
                  }}
                  className="gap-2 cursor-pointer py-2.5"
                >
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <span>Ambil Foto</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    onMutationGalleryClick?.();
                    handleSelect("mutation");
                  }}
                  className="gap-2 cursor-pointer py-2.5"
                >
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                  <span>Pilih dari Galeri</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}