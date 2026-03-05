"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const steps = [
  { path: "/split-bill/new/items", label: "Item" },
  { path: "/split-bill/new/split", label: "Bagi" },
  { path: "/split-bill/new/preview", label: "Ringkasan" },
];

export function SplitBillStepper() {
  const pathname = usePathname();
  const currentIndex = steps.findIndex((s) => pathname.startsWith(s.path));

  return (
    <div className="flex items-center justify-center gap-2 px-5 py-3">
      {steps.map((step, i) => (
        <div key={step.path} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                i <= currentIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                i <= currentIndex ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                "h-px w-6",
                i < currentIndex ? "bg-primary" : "bg-muted",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
