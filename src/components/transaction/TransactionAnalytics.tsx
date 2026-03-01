"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { formatIDR } from "@/lib/formatIDR";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransactionAnalyticsProps {
  data?: {
    summary: {
      income: number;
      expense: number;
      incomeChange: number;
      expenseChange: number;
    };
    cashflow: {
      date: string;
      income: number;
      expense: number;
    }[];
  };
  isLoading: boolean;
}

export function TransactionAnalytics({ data, isLoading }: TransactionAnalyticsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-24 rounded-[20px]" />
        <Skeleton className="h-24 rounded-[20px]" />
        <Skeleton className="col-span-2 h-48 rounded-[20px]" />
      </div>
    );
  }

  if (!data) return null;

  const { summary, cashflow } = data;

  const chartData = cashflow.map((d) => ({
    ...d,
    // Short date for X axis
    shortDate: d.date.split("-")[2],
  }));

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="rounded-[20px] p-4 flex flex-col justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">Total Pemasukan</p>
            <h4 className="text-lg font-bold text-emerald-600">
              {formatIDR(summary.income)}
            </h4>
          </div>
          <div className="flex items-center gap-1 mt-2">
            {summary.incomeChange >= 0 ? (
              <TrendingUp size={14} className="text-emerald-500" />
            ) : (
              <TrendingDown size={14} className="text-rose-500" />
            )}
            <span
              className={cn(
                "text-[10px] font-medium",
                summary.incomeChange >= 0 ? "text-emerald-600" : "text-rose-600"
              )}
            >
              {summary.incomeChange >= 0 ? "+" : ""}
              {summary.incomeChange.toFixed(1)}% vs bln lalu
            </span>
          </div>
        </Card>

        <Card className="rounded-[20px] p-4 flex flex-col justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">Total Pengeluaran</p>
            <h4 className="text-lg font-bold text-rose-600">
              {formatIDR(summary.expense)}
            </h4>
          </div>
          <div className="flex items-center gap-1 mt-2">
            {summary.expenseChange <= 0 ? (
              <TrendingDown size={14} className="text-emerald-500" />
            ) : (
              <TrendingUp size={14} className="text-rose-500" />
            )}
            <span
              className={cn(
                "text-[10px] font-medium",
                summary.expenseChange <= 0 ? "text-emerald-600" : "text-rose-600"
              )}
            >
              {summary.expenseChange >= 0 ? "+" : ""}
              {summary.expenseChange.toFixed(1)}% vs bln lalu
            </span>
          </div>
        </Card>
      </div>

      {/* Cashflow Chart */}
      <Card className="rounded-[20px] p-4">
        <h3 className="text-sm font-semibold mb-4">Arus Kas Harian</h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="shortDate"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                tickMargin={8}
                minTickGap={10}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => (value >= 1000000 ? `${(value / 1000000).toFixed(1)}jt` : value >= 1000 ? `${(value / 1000).toFixed(0)}rb` : String(value))}
              />
              <Tooltip
                formatter={(value: number) => [formatIDR(value), ""]}
                labelFormatter={(label, payload) => {
                    if (payload && payload[0] && payload[0].payload) {
                        return (payload[0].payload as { date: string }).date;
                    }
                    return String(label);
                }}
                contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-card)', color: 'var(--color-card-foreground)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                itemStyle={{ color: 'var(--color-foreground)' }}
              />
              <Bar dataKey="income" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="Masuk" barSize={12} />
              <Bar dataKey="expense" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} name="Keluar" barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
