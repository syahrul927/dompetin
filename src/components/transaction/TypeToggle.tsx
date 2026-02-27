"use client";

import React from "react";

type TransactionType = "income" | "expense" | "transfer";

interface TypeToggleProps {
  value: TransactionType;
  onChange: (type: TransactionType) => void;
  disabled?: boolean;
}

/**
 * The 3-option pill segmented control for Income / Expense / Transfer.
 */
export function TypeToggle({ value, onChange, disabled }: TypeToggleProps) {
  const options: { value: TransactionType; label: string }[] = [
    { value: "income", label: "Pemasukan" },
    { value: "expense", label: "Pengeluaran" },
    { value: "transfer", label: "Transfer" },
  ];

  return (
    <div className={`flex gap-0.5 rounded-full bg-muted p-1 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-full px-3 py-2 text-center text-[13px] font-medium transition-all duration-180 ${
            value === option.value
              ? "bg-primary text-white shadow-[0_2px_8px_rgba(201,120,128,0.35)]"
              : "bg-transparent text-muted-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
