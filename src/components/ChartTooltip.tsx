"use client";

/**
 * Tooltip chart bersih & konsisten (PRD FR-CHR-03).
 * Tipe props didefinisikan manual agar stabil lintas versi Recharts.
 */
import { formatCurrency } from "@/lib/format";
import { useFinBoardStore } from "@/store/finBoardStore";

export interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  fill?: string;
}

interface Props {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  valueFormatter?: (v: number, name: string) => string;
}

export default function ChartTooltip({ active, payload, label, valueFormatter }: Props) {
  const { currency } = useFinBoardStore();
  if (!active || !payload || payload.length === 0) return null;

  // Default: ikut mode mata uang global (IDR/USD), agar konsisten dengan chart lain.
  const fmt = valueFormatter ?? ((v: number) => formatCurrency(v, currency));

  return (
    <div className="rounded-lg border border-surface-border bg-white px-3 py-2 shadow-lg">
      {label !== undefined && (
        <p className="mb-1.5 text-xs font-semibold text-foreground">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: entry.color ?? entry.fill }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground">
              {typeof entry.value === "number"
                ? fmt(entry.value, String(entry.name ?? ""))
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
