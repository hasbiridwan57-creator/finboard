"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  label: string;
  value: string;
  delta: number | null;
  /** arah "baik": untuk Revenue/Profit naik=baik; untuk Expenses turun=baik (PRD FR-KPI) */
  goodWhenUp: boolean;
  tooltip?: string;
  /** sub-metrik kontekstual di bawah angka utama (audit UI Bagian 4) */
  subtitle?: string;
  /** index urutan kartu untuk stagger animation (CSS) */
  index?: number;
}

export default function KpiCard({ label, value, delta, goodWhenUp, tooltip, subtitle, index = 0 }: Props) {
  // Warna delta mengikuti "apakah perubahan ini baik", bukan sekadar naik/turun
  let deltaClass = "bg-slate-100 text-muted-foreground";
  let Icon = Minus;
  let sign = "";

  if (delta !== null && delta !== 0) {
    const isUp = delta > 0;
    const isGood = goodWhenUp ? isUp : !isUp;
    deltaClass = isGood ? "bg-success-soft text-success" : "bg-danger-soft text-danger";
    Icon = isUp ? TrendingUp : TrendingDown;
    sign = isUp ? "+" : "";
  }

  const neutral = delta === null;

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both rounded-xl border border-surface-border bg-white p-5 shadow-card"
      style={{ animationDelay: `${index * 80}ms` }}
      title={tooltip}
    >
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {/* Delta periode sebagai pill badge (UI Bagian 4) */}
      <span
        className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${deltaClass}`}
        aria-label={
          neutral
            ? "Data periode tunggal"
            : `${delta! > 0 ? "naik" : "turun"} ${Math.abs(delta!).toFixed(1)} persen`
        }
      >
        <Icon className="h-3 w-3" />
        {neutral ? (
          <span>Periode tunggal</span>
        ) : (
          <span>
            {sign}
            {Math.abs(delta!).toFixed(1).replace(".", ",")}%
          </span>
        )}
      </span>
      {/* Sub-metrik kontekstual */}
      {subtitle && (
        <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
