"use client";

import React from "react";

interface AmountInputProps {
  value: number; // Will hold the raw amount
  // No internal state needed, we'll let react-hook-form pass it in
}

/**
 * The large centered amount display for use with the custom Numpad.
 */
export function AmountInput({ value }: AmountInputProps) {
  // Format without the Rp symbol to keep the design clean, just formatted numbers
  const formattedValue =
    value === 0 ? "0" : value.toLocaleString("id-ID");

  return (
    <div className="flex flex-col items-center py-6">
      <label className="text-center text-xs text-muted-foreground">
        Jumlah (IDR)
      </label>
      <div
        className={`mt-1 min-h-[56px] text-center text-[48px] font-bold tracking-tighter ${
          value === 0 ? "text-muted-foreground/30" : "text-foreground"
        }`}
      >
        {formattedValue}
      </div>
    </div>
  );
}
