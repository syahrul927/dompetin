"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { InputMethodDrawer } from "./InputMethodDrawer";
import { SmartInputDrawer } from "./SmartInputDrawer";
import { AddTransactionSheet } from "./AddTransactionSheet";
import { api } from "@/trpc/react";
import { compressImage } from "@/lib/image";
import { useAnalytics } from "@/hooks/use-analytics";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";

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
  type ActiveView = 'input-method' | 'smart' | 'add' | null;
  const [activeView, setActiveView] = useState<ActiveView>(null);

  const router = useRouter();

  const [smartMode, setSmartMode] = useState<"text" | "voice">("text");
  const [initialData, setInitialData] = useState<Record<string, unknown> | null>(null);

  const { trackEvent } = useAnalytics();

  // Scanner logic
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const mutationCameraInputRef = React.useRef<HTMLInputElement>(null);
  const mutationGalleryInputRef = React.useRef<HTMLInputElement>(null);
  const scanMutation = api.ai.scanReceipt.useMutation();
  const scanBankMutation = api.ai.scanBankMutation.useMutation();

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
        setActiveView("add");
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

  const handleMutationFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedBase64 = await compressImage(file);
      const result = await scanBankMutation.mutateAsync({
        imageBase64: compressedBase64,
        mimeType: file.type || "image/jpeg",
        availableCategories: DEFAULT_CATEGORIES.map((c) => ({
          key: c.key,
          name: c.name,
          type: c.type,
        })),
      });

      if (result.success && result.transactions.length > 0) {
        const importData = result.transactions.map((t) => ({
          ...t,
          id: crypto.randomUUID(),
        }));
        sessionStorage.setItem("importMutationData", JSON.stringify(importData));
        onOpenChange(false);
        router.push("/transactions/import");
      } else {
        const errorMsg = (result as { error?: string }).error || "Tidak ada transaksi terdeteksi dari gambar";
        alert(errorMsg);
      }
    } catch (error) {
      console.error("Bank mutation scan error:", error);
      alert("Terjadi kesalahan saat memindai mutasi");
    } finally {
      if (mutationCameraInputRef.current) mutationCameraInputRef.current.value = "";
      if (mutationGalleryInputRef.current) mutationGalleryInputRef.current.value = "";
    }
  };

  const handleSelectMethod = (method: "manual" | "voice" | "text" | "scan" | "mutation") => {
    if (method === "manual") {
      setInitialData(null);
      setActiveView("add");
    } else if (method === "voice" || method === "text") {
      setSmartMode(method);
      setActiveView("smart");
    } else if (method === "scan" || method === "mutation") {
      // InputMethodDrawer handles opening the dropdown.
      // The dropdown options trigger the inputs below.
    }
  };

  const handleSmartInputSuccess = (data: Record<string, unknown>) => {
    // Map the flat data from AI endpoint to the nested format AddTransactionSheet expects
    const mappedData = {
      ...data,
      wallet: data.walletId ? { id: data.walletId } : null,
      category: data.categoryId ? { id: data.categoryId } : null,
    };

    setInitialData(mappedData);
    setActiveView("add");
  };

  // State machine lifecycle
  React.useEffect(() => {
    if (open) {
      if (externalInitialData) {
        setInitialData(externalInitialData);
        setActiveView("add");
      } else {
        setInitialData(null);
        setActiveView("input-method");
      }
    } else {
      setActiveView(null);
    }
  }, [open, externalInitialData]);

  // When a drawer requests to close, we notify the parent and clear view
  const handleManagerClose = () => {
    setActiveView(null);
    onOpenChange(false);
  };

  return (
    <>
      <InputMethodDrawer
        open={activeView === "input-method"}
        onOpenChange={(isOpen) => {
          if (!isOpen && activeView === "input-method") {
            handleManagerClose();
          }
        }}
        onSelectMethod={handleSelectMethod}
        isScanning={scanMutation.isPending}
        onCameraClick={() => cameraInputRef.current?.click()}
        onGalleryClick={() => galleryInputRef.current?.click()}
        isScanningMutation={scanBankMutation.isPending}
        onMutationCameraClick={() => mutationCameraInputRef.current?.click()}
        onMutationGalleryClick={() => mutationGalleryInputRef.current?.click()}
      />

      <SmartInputDrawer
        open={activeView === "smart"}
        onOpenChange={(isOpen) => {
          if (!isOpen && activeView === "smart") {
            handleManagerClose();
          }
        }}
        mode={smartMode}
        onSuccess={handleSmartInputSuccess}
      />

      <AddTransactionSheet
        open={activeView === "add"}
        onOpenChange={(isOpen) => {
          if (!isOpen && activeView === "add") {
            handleManagerClose();
          }
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

      {/* Hidden file inputs for bank mutation scanning */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        ref={mutationCameraInputRef}
        onChange={handleMutationFileChange}
      />
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={mutationGalleryInputRef}
        onChange={handleMutationFileChange}
      />
    </>
  );
}
