"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Plus, Camera, Image as Gallery } from "lucide-react";
import { useSplitBill, getGrandSubtotal, getFinalTotal } from "@/components/split-bill/split-bill-context";
import { BillItemRow } from "@/components/split-bill/BillItemRow";
import { api } from "@/trpc/react";
import { compressImage } from "@/lib/image";
import { formatIDR } from "@/lib/formatIDR";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export default function ItemsPage() {
  const router = useRouter();
  const { state, dispatch } = useSplitBill();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);

  const scanReceiptItems = api.ai.scanReceiptItems.useMutation({
    onSuccess: (result) => {
      if (result.success && result.items) {
        dispatch({
          type: "SET_ITEMS_FROM_SCAN",
          items: result.items.map(item => ({ ...item, id: crypto.randomUUID() })),
          tax: result.tax ?? 0,
          discount: result.discount ?? 0,
        });
      } else {
        alert("Gagal memindai struk. Silakan coba lagi.");
      }
      setIsScanning(false);
    },
    onError: () => {
      alert("Terjadi kesalahan saat memindai struk.");
      setIsScanning(false);
    },
  });

  const handleImageSelect = async (file: File | null) => {
    if (!file) return;

    setIsScanning(true);
    try {
      const compressedBase64 = await compressImage(file);
      const mimeType = file.type;

      await scanReceiptItems.mutateAsync({
        imageBase64: compressedBase64,
        mimeType,
      });
    } catch (error) {
      console.error("Error processing image:", error);
      alert("Gagal memproses gambar.");
      setIsScanning(false);
    }
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    galleryInputRef.current?.click();
  };

  const hasValidItems = state.items.some(item => item.price > 0);

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold flex-1">Split Bill</h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* AI Scan Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              disabled={isScanning}
            >
              <Sparkles className="w-4 h-4" />
              {isScanning ? "Memindai..." : "Scan Struk (AI)"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
            <DropdownMenuItem onClick={handleCameraClick}>
              <Camera className="w-4 h-4 mr-2" />
              Kamera
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleGalleryClick}>
              <Gallery className="w-4 h-4 mr-2" />
              Galeri
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Hidden file inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleImageSelect(e.target.files?.[0] ?? null)}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleImageSelect(e.target.files?.[0] ?? null)}
        />

        {/* Items List */}
        <div className="space-y-3">
          <div className="grid grid-cols-[2fr_1fr_2fr_1.5fr_1.5fr_auto] gap-2 items-center text-xs font-medium text-muted-foreground px-1">
            <div>Nama</div>
            <div>Jml</div>
            <div>Harga</div>
            <div>Subtotal</div>
            <div className="text-right">No</div>
            <div />
          </div>
          {state.items.map((item, index) => (
            <BillItemRow key={item.id} item={item} index={index} />
          ))}
        </div>

        {/* Add Item Button */}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => dispatch({ type: "ADD_ITEM" })}
        >
          <Plus className="w-4 h-4" />
          Tambah Item
        </Button>

        {/* Tax and Discount */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Pajak</label>
            <Input
              type="number"
              placeholder="0"
              min="0"
              step="100"
              value={state.tax || ""}
              onChange={(e) => dispatch({
                type: "SET_TAX",
                value: parseFloat(e.target.value) || 0,
              })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Diskon</label>
            <Input
              type="number"
              placeholder="0"
              min="0"
              step="100"
              value={state.discount || ""}
              onChange={(e) => dispatch({
                type: "SET_DISCOUNT",
                value: parseFloat(e.target.value) || 0,
              })}
            />
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 space-y-3 shadow-lg">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatIDR(getGrandSubtotal(state.items))}</span>
          </div>
          {state.tax > 0 && (
            <div className="flex justify-between text-green-600">
              <span>+ Pajak</span>
              <span>+ {formatIDR(state.tax)}</span>
            </div>
          )}
          {state.discount > 0 && (
            <div className="flex justify-between text-destructive">
              <span>- Diskon</span>
              <span>- {formatIDR(state.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg pt-2 border-t">
            <span>Total</span>
            <span>{formatIDR(getFinalTotal(state))}</span>
          </div>
        </div>

        <Link
          href="/split-bill/new/split"
          className={`block w-full text-center py-3 rounded-md font-medium transition-colors ${
            hasValidItems
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground pointer-events-none"
          }`}
        >
          Lanjut
        </Link>
      </div>
    </div>
  );
}
