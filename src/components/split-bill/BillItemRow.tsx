"use client";

import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSplitBill, getItemSubtotal, type BillItem } from "@/components/split-bill/split-bill-context";
import { formatIDR } from "@/lib/formatIDR";

interface BillItemRowProps {
  item: BillItem;
  index: number;
}

export function BillItemRow({ item, index }: BillItemRowProps) {
  const { state, dispatch } = useSplitBill();
  const subtotal = getItemSubtotal(item);

  const canDelete = state.items.length > 1;

  return (
    <div className="grid grid-cols-[2fr_1fr_2fr_1.5fr_1.5fr_auto] gap-2 items-center">
      <Input
        type="text"
        placeholder="Nama item"
        value={item.name}
        onChange={(e) => dispatch({
          type: "UPDATE_ITEM",
          id: item.id,
          field: "name",
          value: e.target.value,
        })}
      />
      <Input
        type="number"
        placeholder="Jml"
        min="0"
        step="0.01"
        value={item.qty}
        onChange={(e) => dispatch({
          type: "UPDATE_ITEM",
          id: item.id,
          field: "qty",
          value: parseFloat(e.target.value) || 0,
        })}
      />
      <Input
        type="number"
        placeholder="Harga"
        min="0"
        step="100"
        value={item.price || ""}
        onChange={(e) => dispatch({
          type: "UPDATE_ITEM",
          id: item.id,
          field: "price",
          value: parseFloat(e.target.value) || 0,
        })}
      />
      <div className="text-sm text-muted-foreground">
        {formatIDR(subtotal)}
      </div>
      <div className="text-xs text-muted-foreground text-right">
        #{index + 1}
      </div>
      <button
        type="button"
        onClick={() => dispatch({ type: "REMOVE_ITEM", id: item.id })}
        disabled={!canDelete}
        className="p-2 rounded-md hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Hapus item"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
