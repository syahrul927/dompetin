"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { nanoid } from "nanoid";
import {
  ArrowLeft,
  Sparkles,
  Plus,
  Camera,
  Image as Gallery,
  Trash2,
} from "lucide-react";
import {
  useSplitBill,
  getFinalTotal,
  getItemSubtotal,
} from "@/components/split-bill/split-bill-context";
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
  const { state, dispatch } = useSplitBill();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);

  const scanReceiptItems = api.ai.scanReceiptItems.useMutation({
    onSuccess: (result) => {
      if (result.success && result.items) {
        dispatch({
          type: "SET_ITEMS_FROM_SCAN",
          items: result.items.map((item) => ({ ...item, id: nanoid() })),
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

  const hasValidItems = state.items.some((item) => item.price > 0);

  return (
    <div className="bg-background min-h-screen pb-40">
      {/* Header */}
      <div className="bg-background sticky top-0 z-10 border-b">
        <div className="flex items-center gap-3 p-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="flex-1 text-lg font-semibold">Split Bill</h1>
        </div>
      </div>

      <div className="space-y-6 p-5">
        {/* AI Scan Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-12 w-full justify-start gap-2 text-base"
              disabled={isScanning}
            >
              <Sparkles className="h-5 w-5" />
              {isScanning ? "Memindai..." : "Scan Struk (AI)"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[--radix-dropdown-menu-trigger-width]"
          >
            <DropdownMenuItem
              onClick={handleCameraClick}
              className="min-h-[44px] py-3"
            >
              <Camera className="mr-2 h-5 w-5" />
              <span className="text-base">Kamera</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleGalleryClick}
              className="min-h-[44px] py-3"
            >
              <Gallery className="mr-2 h-5 w-5" />
              <span className="text-base">Galeri</span>
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

        {/* Items List - Card Layout for Mobile */}
        <div className="space-y-4">
          <div className="text-muted-foreground px-1 text-sm font-medium">
            Daftar Item
          </div>
          {state.items.map((item, index) => (
            <div
              key={item.id}
              className="bg-card space-y-3 rounded-lg border p-4 shadow-sm"
            >
              {/* Item Number Header */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium">
                  Item #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "REMOVE_ITEM", id: item.id })}
                  disabled={state.items.length <= 1}
                  className="hover:bg-destructive/10 hover:text-destructive flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Hapus item"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>

              {/* Item Name */}
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs font-medium">
                  Nama Item
                </label>
                <Input
                  type="text"
                  placeholder="Contoh: Nasi Goreng"
                  value={item.name}
                  onChange={(e) =>
                    dispatch({
                      type: "UPDATE_ITEM",
                      id: item.id,
                      field: "name",
                      value: e.target.value,
                    })
                  }
                  className="h-12"
                />
              </div>

              {/* Quantity and Price Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-muted-foreground text-xs font-medium">
                    Jumlah
                  </label>
                  <Input
                    type="number"
                    placeholder="1"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={item.qty}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_ITEM",
                        id: item.id,
                        field: "qty",
                        value: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-12"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-muted-foreground text-xs font-medium">
                    Harga (Rp)
                  </label>
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    step="100"
                    inputMode="numeric"
                    value={item.price || ""}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_ITEM",
                        id: item.id,
                        field: "price",
                        value: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-12"
                  />
                </div>
              </div>

              {/* Subtotal Display */}
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-sm font-medium">Subtotal</span>
                <span className="text-primary text-lg font-bold">
                  {formatIDR(getItemSubtotal(item))}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Add Item Button */}
        <Button
          variant="outline"
          className="h-12 w-full gap-2 text-base"
          onClick={() => dispatch({ type: "ADD_ITEM" })}
        >
          <Plus className="h-5 w-5" />
          Tambah Item
        </Button>

        {/* Tax and Discount */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-muted-foreground text-sm font-medium">
              Pajak (Rp)
            </label>
            <Input
              type="number"
              placeholder="0"
              min="0"
              step="100"
              inputMode="numeric"
              value={state.tax || ""}
              onChange={(e) =>
                dispatch({
                  type: "SET_TAX",
                  value: parseFloat(e.target.value) || 0,
                })
              }
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <label className="text-muted-foreground text-sm font-medium">
              Diskon (Rp)
            </label>
            <Input
              type="number"
              placeholder="0"
              min="0"
              step="100"
              inputMode="numeric"
              value={state.discount || ""}
              onChange={(e) =>
                dispatch({
                  type: "SET_DISCOUNT",
                  value: parseFloat(e.target.value) || 0,
                })
              }
              className="h-12"
            />
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="bg-background fixed right-0 bottom-0 left-0 space-y-3 border-t p-4 shadow-lg">
        <div className="space-y-2 text-sm">
          {state.tax > 0 && (
            <div className="flex items-center justify-between text-green-600">
              <span>+ Pajak</span>
              <span className="font-medium">+ {formatIDR(state.tax)}</span>
            </div>
          )}
          {state.discount > 0 && (
            <div className="text-destructive flex items-center justify-between">
              <span>- Diskon</span>
              <span className="font-medium">- {formatIDR(state.discount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 text-xl font-bold">
            <span>Total</span>
            <span className="text-primary">
              {formatIDR(getFinalTotal(state))}
            </span>
          </div>
        </div>

        <Link href="/split-bill/new/split">
          <Button
            disabled={!hasValidItems}
            className="w-full text-base"
          >
            Lanjut
          </Button>
        </Link>
      </div>
    </div>
  );
}
