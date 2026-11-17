"use client";

/** Kumpulan 5 chart interaktif (PRD FR-CHR). Semua pakai Recharts + ResponsiveContainer. */
import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Label,
} from "recharts";
import { formatRupiah, formatPercent } from "@/lib/format";
import type { MonthlyPoint, DimensionPoint } from "@/lib/chartAggregator";
import ChartTooltip from "./ChartTooltip";

const CHART_COLORS = ["#2563eb", "#0ea5e9", "#16a34a", "#f59e0b", "#6366f1"];

function EmptyChart({ msg }: { msg: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
      {msg}
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-white p-5 shadow-card">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

/** 1. Tren Revenue vs Expenses (Area) — PRD FR-CHR-1 */
export function RevenueExpenseChart({ data }: { data: MonthlyPoint[] }) {
  if (data.length === 0) return <ChartCard title="Tren Revenue vs Expenses"><EmptyChart msg="Tidak ada data." /></ChartCard>;
  return (
    <ChartCard title="Tren Revenue vs Expenses (Bulanan)">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dc2626" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#dc2626" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v) => formatRupiah(v)} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={70} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" strokeWidth={2} fill="url(#revGrad)" />
          <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#dc2626" strokeWidth={2} fill="url(#expGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** 2. Revenue vs Budget (kondisional) — PRD FR-CHR-2 */
export function RevenueBudgetChart({ data }: { data: MonthlyPoint[] }) {
  const withBudget = data.filter((d) => d.budget !== null && d.budget > 0);
  if (withBudget.length === 0) return null;
  return (
    <ChartCard title="Realisasi Revenue vs Budget">
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={withBudget} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v) => formatRupiah(v)} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={70} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="revenue" name="Revenue Aktual" fill="#2563eb" radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="budget" name="Budget" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** 3. Profit by Category (Vertical Bar + toggle Donut jika >6) — PRD FR-CHR-3 */
export function CategoryProfitChart({ data }: { data: DimensionPoint[] }) {
  const [chartType, setChartType] = useState<"bar" | "donut">("bar");

  if (data.length === 0) return <ChartCard title="Profit per Kategori"><EmptyChart msg="Kolom kategori tidak tersedia." /></ChartCard>;

  const showToggle = data.length > 6;

  return (
    <ChartCard title="Profit per Kategori">
      {showToggle && (
        <div className="mb-3 flex justify-end">
          <div className="inline-flex rounded-lg border border-surface-border bg-background p-0.5">
            <button
              onClick={() => setChartType("bar")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                chartType === "bar"
                  ? "bg-surface text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Bar
            </button>
            <button
              onClick={() => setChartType("donut")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                chartType === "donut"
                  ? "bg-surface text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Donut
            </button>
          </div>
        </div>
      )}
      <ResponsiveContainer width="100%" height={280}>
        {chartType === "donut" && showToggle ? (
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.value >= 0 ? CHART_COLORS[i % CHART_COLORS.length] : "#dc2626"} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip valueFormatter={(v) => `${formatRupiah(v)} (${formatPercent((v / data.reduce((s, d) => s + d.value, 0)) * 100)})`} />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        ) : (
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} interval={0} />
            <YAxis tickFormatter={(v) => formatRupiah(v)} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={70} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
            <Bar dataKey="value" name="Profit" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.value >= 0 ? "#2563eb" : "#dc2626"} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** 4. Profit by Department (Horizontal Bar) — PRD FR-CHR-4 */
export function DepartmentProfitChart({ data }: { data: DimensionPoint[] }) {
  if (data.length === 0) return <ChartCard title="Profit per Departemen"><EmptyChart msg="Kolom departemen tidak tersedia." /></ChartCard>;
  return (
    <ChartCard title="Profit per Departemen">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => formatRupiah(v)} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={150} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
          <Bar dataKey="value" name="Profit" radius={[0, 4, 4, 0]} barSize={20}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.value >= 0 ? "#16a34a" : "#dc2626"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** 5. Profit by Channel (Donut) — PRD FR-CHR-5 */
export function ChannelProfitChart({ data }: { data: DimensionPoint[] }) {
  const positive = data.filter((d) => d.value > 0);
  if (positive.length === 0)
    return <ChartCard title="Profit per Kanal Penjualan"><EmptyChart msg="Kolom kanal tidak tersedia atau tidak ada profit." /></ChartCard>;
  const total = positive.reduce((s, d) => s + d.value, 0);
  return (
    <ChartCard title="Profit per Kanal Penjualan">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={positive}
            dataKey="value"
            nameKey="name"
            innerRadius="60%"
            outerRadius="85%"
            paddingAngle={2}
          >
            {positive.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip valueFormatter={(v) => `${formatRupiah(v)} (${formatPercent((v / total) * 100)})`} />} />
          <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground" fontSize={14} fontWeight={700}>
            {formatRupiah(total)}
          </text>
          <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground" fontSize={11}>
            Total Profit
          </text>
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
