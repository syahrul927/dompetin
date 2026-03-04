"use client";

import React, { useState } from "react";
import { InputMethodDrawer } from "./InputMethodDrawer";
import { SmartInputDrawer } from "./SmartInputDrawer";
import { AddTransactionSheet } from "./AddTransactionSheet";
import { api } from "@/trpc/react";
import { compressImage } from "@/lib/image";
import { useAnalytics } from "@/hooks/use-analytics";

interface TransactionManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Use this when editing an existing transaction */
  initialData?: Record<string, unknown> | null;
}

export function TransactionManager({
  open,
  onOpenChange,
  initialData: externalInitialData,
}: TransactionManagerProps) {
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [smartDrawerOpen, setSmartDrawerOpen] = useState(false);
  const [smartMode, setSmartMode] = useState<"text" | "voice">("text");
  const [initialData, setInitialData] = useState<Record<string, unknown> | null>(null);

  const { trackEvent } = useAnalytics();

  // Scanner logic
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const scanMutation = api.ai.scanReceipt.useMutation();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      trackEvent("scan_struk_initiated");
      const compressedBase64 = await compressImage(file);
      const result = await scanMutation.mutateAsync({
        imageBase64: compressedBase64,
        mimeType: file.type || "image/jpeg",
      });

      if (result.success) {
        trackEvent("scan_struk_success");
        setInitialData(result);
        setAddSheetOpen(true);
      } else {
        alert(result.notes || "Gagal membaca struk");
      }
    } catch (error) {
      console.error("Scan error:", error);
      alert("Terjadi kesalahan saat memindai struk");
    } finally {
      // Reset input so the same file can be selected again
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const handleSelectMethod = (method: "manual" | "voice" | "text" | "scan") => {
    if (method === "manual") {
      setInitialData(null);
      setAddSheetOpen(true);
    } else if (method === "voice" || method === "text") {
      setSmartMode(method);
      setSmartDrawerOpen(true);
    } else if (method === "scan") {
      // InputMethodDrawer handles opening the dropdown.
      // The dropdown options trigger the inputs below.
    }
  };

  const handleSmartInputSuccess = (data: Record<string, unknown>) => {
    setInitialData(data);
    setSmartDrawerOpen(false);
    // Add slight delay before opening AddTransactionSheet to avoid animation glitch
    setTimeout(() => {
      setAddSheetOpen(true);
    }, 300);
  };

  // If externalInitialData is provided, we bypass the input method selection
  // and go straight to AddTransactionSheet in edit mode.
  React.useEffect(() => {
    if (open && externalInitialData) {
      setInitialData(externalInitialData);
      setAddSheetOpen(true);
    }
  }, [open, externalInitialData]);

  // When all drawers are closed, we should communicate back that the manager is closed
  const handleManagerClose = () => {
    if (!addSheetOpen && !smartDrawerOpen) {
      onOpenChange(false);
    }
  };

  return (
    <>
      <InputMethodDrawer
        open={open && !addSheetOpen && !smartDrawerOpen && !externalInitialData}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleManagerClose();
          onOpenChange(isOpen);
        }}
        onSelectMethod={handleSelectMethod}
        isScanning={scanMutation.isPending}
        onCameraClick={() => cameraInputRef.current?.click()}
        onGalleryClick={() => galleryInputRef.current?.click()}
      />

      <SmartInputDrawer
        open={smartDrawerOpen}
        onOpenChange={(isOpen) => {
          setSmartDrawerOpen(isOpen);
          if (!isOpen) handleManagerClose();
        }}
        mode={smartMode}
        onSuccess={handleSmartInputSuccess}
      />

      <AddTransactionSheet
        open={addSheetOpen}
        onOpenChange={(isOpen) => {
          setAddSheetOpen(isOpen);
          if (!isOpen) handleManagerClose();
        }}
        initialData={initialData}
      />

      {/* Hidden file inputs for receipt scanning */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        ref={cameraInputRef}
        onChange={handleFileChange}
      />
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={galleryInputRef}
        onChange={handleFileChange}
      />
    </>
  );
}
