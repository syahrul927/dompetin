"use client";

import React from "react";
import { Delete } from "lucide-react";

interface NumpadProps {
  value: string;
  onChange: (val: string) => void;
  maxLength?: number;
}

/**
 * Custom numeric keypad for fast mobile amount entry.
 */
export function Numpad({ value, onChange, maxLength = 12 }: NumpadProps) {
  const handlePress = (key: string) => {
    if (key === "backspace") {
      onChange(value.slice(0, -1) || "0");
      return;
    }

    // Don't allow "000" or "0" if the value is currently exactly "0"
    // Wait, if it's "0" and we press a number, replace "0"
    let newVal = value;
    if (value === "0") {
      if (key === "0" || key === "000") return; // No multiple zeros at start
      newVal = key;
    } else {
      newVal = value + key;
    }

    if (newVal.length > maxLength) return;

    onChange(newVal);
  };

  const buttonClass =
    "flex h-14 w-full items-center justify-center rounded-[20px] text-2xl font-medium transition-all active:scale-[0.95] active:bg-muted bg-card";

  return (
    <div className="grid grid-cols-3 gap-2">
      <button type="button" onClick={() => handlePress("1")} className={buttonClass}>1</button>
      <button type="button" onClick={() => handlePress("2")} className={buttonClass}>2</button>
      <button type="button" onClick={() => handlePress("3")} className={buttonClass}>3</button>
      <button type="button" onClick={() => handlePress("4")} className={buttonClass}>4</button>
      <button type="button" onClick={() => handlePress("5")} className={buttonClass}>5</button>
      <button type="button" onClick={() => handlePress("6")} className={buttonClass}>6</button>
      <button type="button" onClick={() => handlePress("7")} className={buttonClass}>7</button>
      <button type="button" onClick={() => handlePress("8")} className={buttonClass}>8</button>
      <button type="button" onClick={() => handlePress("9")} className={buttonClass}>9</button>
      <button type="button" onClick={() => handlePress("000")} className={`${buttonClass} text-lg`}>000</button>
      <button type="button" onClick={() => handlePress("0")} className={buttonClass}>0</button>
      <button
        type="button"
        onClick={() => handlePress("backspace")}
        className={`${buttonClass} bg-transparent`}
      >
        <Delete size={28} className="text-muted-foreground" />
      </button>
    </div>
  );
}
