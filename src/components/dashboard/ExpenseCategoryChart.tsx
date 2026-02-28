"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { formatIDR } from "@/lib/formatIDR";
import { getCategoryIcon } from "@/lib/category-icons";

interface CategoryData {
  id: string | null;
  name: string;
  icon: string;
  color: string;
  total: number;
}

interface ExpenseCategoryChartProps {
  categories: CategoryData[];
  grandTotal: number;
  isLoading?: boolean;
}

export function ExpenseCategoryChart({
  categories,
  grandTotal,
  isLoading,
}: ExpenseCategoryChartProps) {
  if (isLoading) {
    return (
      <Card className="rounded-[20px] p-4">
        <h3 className="text-base font-semibold">Pengeluaran per Kategori</h3>
        <Skeleton className="mx-auto mt-4 h-[140px] w-[140px] rounded-full" />
        <div className="mt-4 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Card>
    );
  }

  if (categories.length === 0) {
    return (
      <Card className="rounded-[20px] p-4">
        <h3 className="text-base font-semibold">Pengeluaran per Kategori</h3>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Belum ada pengeluaran bulan ini
        </p>
      </Card>
    );
  }

  const top5 = categories.slice(0, 5);
  const othersTotal = categories
    .slice(5)
    .reduce((sum, c) => sum + c.total, 0);

  const chartData =
    othersTotal > 0
      ? [...top5, { id: "__others", name: "Lainnya", icon: "help-circle", color: "#cbd5e1", total: othersTotal }]
      : top5;

  return (
    <Card className="rounded-[20px] p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-base font-semibold">Pengeluaran per Kategori</h3>
        <span className="text-xs text-muted-foreground">Bulan ini</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Donut chart */}
        <div className="relative h-[130px] w-[130px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={38}
                outerRadius={60}
                dataKey="total"
                stroke="none"
                paddingAngle={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.id ?? entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] text-muted-foreground">Total</span>
            <span className="text-xs font-semibold">
              {grandTotal >= 1_000_000
                ? `${(grandTotal / 1_000_000).toFixed(1)}jt`
                : formatIDR(grandTotal)}
            </span>
          </div>
        </div>

        {/* Category list */}
        <div className="flex-1 space-y-2">
          {chartData.map((cat) => {
            const pct = grandTotal > 0 ? ((cat.total / grandTotal) * 100).toFixed(0) : "0";
            const Icon = getCategoryIcon(cat.icon);
            return (
              <div key={cat.id ?? cat.name} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: cat.color }} />
                <span className="truncate text-xs">{cat.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
