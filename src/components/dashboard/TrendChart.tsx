"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatIDR } from "@/lib/formatIDR";

interface TrendChartProps {
  data: { label: string; value: number }[];
  isLoading?: boolean;
}

/**
 * Line chart card showing daily expense trend.
 * Uses Recharts for visualization.
 */
export function TrendChart({ data, isLoading }: TrendChartProps) {
  if (isLoading) {
    return (
      <Card className="rounded-[20px] p-4">
        <h3 className="text-base font-semibold">Tren Pengeluaran</h3>
        <Skeleton className="mt-4 h-[80px] w-full rounded-lg" />
      </Card>
    );
  }

  const hasData = data.some((d) => d.value > 0);

  if (!hasData) {
    return (
      <Card className="rounded-[20px] p-4">
        <h3 className="text-base font-semibold">Tren Pengeluaran</h3>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Belum ada data pengeluaran 7 hari terakhir
        </p>
      </Card>
    );
  }

  return (
    <Card className="rounded-[20px] p-4">
      <h3 className="mb-4 text-base font-semibold">Tren Pengeluaran (7 Hari)</h3>

      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={data}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          />
          <Tooltip
            formatter={(value: number) => [formatIDR(value), "Pengeluaran"]}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="none"
            fill="url(#colorValue)"
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
