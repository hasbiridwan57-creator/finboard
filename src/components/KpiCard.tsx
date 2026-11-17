"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  label: string;
  value: string;
  delta: number | null;
  /** arah "baik": untuk Revenue/Profit naik=baik; untuk Expenses turun=baik (PRD FR-KPI) */
  goodWhenUp: boolean;
  tooltip?: string;
}

export default function KpiCard({ label, value, delta, goodWhenUp, tooltip }: Props) {
  // Warna delta mengikuti "apakah perubahan ini baik", bukan sekadar naik/turun
  let deltaClass = "text-muted-foreground";
  let Icon = Minus;
  let sign = "";

  if (delta !== null && delta !== 0) {
    const isUp = delta > 0;
    const isGood = goodWhenUp ? isUp : !isUp;
    deltaClass = isGood ? "text-success" : "text-danger";
    Icon = isUp ? TrendingUp : TrendingDown;
    sign = isUp ? "+" : "";
  }

  const neutral = delta === null;

  return (
    <div
      className="rounded-xl border border-surface-border bg-white p-5 shadow-card"
      title={tooltip}
    >
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      <p
        className={`mt-2 flex items-center gap-1 text-xs font-medium ${deltaClass}`}
        aria-label={
          neutral
            ? "Data periode tunggal"
            : `${delta! > 0 ? "naik" : "turun"} ${Math.abs(delta!).toFixed(1)} persen`
        }
      >
        <Icon className="h-3.5 w-3.5" />
        {neutral ? (
          <span>Data periode tunggal</span>
        ) : (
          <span>
            {sign}
            {Math.abs(delta!).toFixed(1).replace(".", ",")}% vs periode sebelumnya
          </span>
        )}
      </p>
    </div>
  );
}
