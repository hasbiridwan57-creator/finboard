"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useId } from "react";

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
  /** data mini-tren bulanan untuk sparkline SVG di sisi kanan kartu (Gemini M3.1) */
  sparkline?: number[];
}

/** Mini sparkline SVG murni (tanpa recharts). Normalisasi ke viewBox 80x28. */
function Sparkline({ data }: { data: number[] }) {
  const gradientId = useId();
  if (data.length < 2) return null;
  const w = 80;
  const h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // hindari divide-by-zero saat semua nilai sama
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * 26 - 1; // padding 1px atas/bawah
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const linePts = pts.join(" ");
  const areaPath = `M${pts[0]} L${pts.join(" L")} L${w},${h} L0,${h} Z`;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0 overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <polyline
        points={linePts}
        fill="none"
        stroke="#2563EB"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function KpiCard({ label, value, delta, goodWhenUp, tooltip, subtitle, index = 0, sparkline }: Props) {
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
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
          {value}
        </p>
        {sparkline && sparkline.length >= 2 && <Sparkline data={sparkline} />}
      </div>
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
