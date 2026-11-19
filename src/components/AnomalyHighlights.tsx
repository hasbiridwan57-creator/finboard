"use client";

/**
 * AnomalyHighlights (Gemini M5.2).
 * Menampilkan maksimal 4 transaksi outlier hasil `detectAnomalies()`.
 * Kartu dapat diklik untuk memeriksa baris terkait di tabel transaksi.
 */
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { AlertTriangle, TrendingUp, Coins, MousePointerClick } from "lucide-react";
import type { NormalizedTransaction } from "@/lib/types";
import type { Anomaly } from "@/lib/insightGenerator";
import { formatCurrency } from "@/lib/format";
import { useFinBoardStore } from "@/store/finBoardStore";

interface Props {
  anomalies: Anomaly[];
  onInspect: (tx: NormalizedTransaction) => void;
}

const KIND_STYLE: Record<
  Anomaly["kind"],
  { badge: string; dot: string; icon: React.ComponentType<{ className?: string }> }
> = {
  loss: {
    badge: "bg-danger-soft text-danger border-danger/30",
    dot: "bg-danger",
    icon: AlertTriangle,
  },
  revenue_spike: {
    badge: "bg-success-soft text-success border-success/30",
    dot: "bg-success",
    icon: TrendingUp,
  },
  cost_ratio: {
    badge: "bg-amber-100 text-amber-700 border-amber-300",
    dot: "bg-amber-500",
    icon: Coins,
  },
};

function keyAmount(a: Anomaly): number {
  if (a.kind === "loss") return a.tx.profit;
  if (a.kind === "revenue_spike") return a.tx.revenue;
  return a.tx.expenses;
}

export default function AnomalyHighlights({ anomalies, onInspect }: Props) {
  const { currency, exchangeRate } = useFinBoardStore();

  return (
    <div className="rounded-xl border border-surface-border bg-white shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-4 w-4 text-danger" />
        <h3 className="text-sm font-semibold text-foreground">Deteksi Anomali &amp; Outlier</h3>
      </div>

      {anomalies.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Tidak ada anomali terdeteksi.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {anomalies.map((a) => {
              const style = KIND_STYLE[a.kind];
              const Icon = style.icon;
              return (
                <li key={`${a.kind}-${a.tx.id}`}>
                  <button
                    type="button"
                    onClick={() => onInspect(a.tx)}
                    className="w-full text-left rounded-lg border border-surface-border bg-white hover:bg-slate-50 transition-colors cursor-pointer p-3 flex items-start gap-3 group"
                  >
                    <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${style.dot}`} aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${style.badge}`}
                        >
                          <Icon className="h-3 w-3" />
                          {a.label}
                        </span>
                        {a.severity && (
                          <span className="text-xs text-muted-foreground">{a.severity}</span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {format(parseISO(a.tx.date), "dd MMM yyyy", { locale: id })} · {a.tx.category} ·{" "}
                        {a.tx.department}
                      </div>
                      <div className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(keyAmount(a), currency, false, exchangeRate)}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
            <MousePointerClick className="h-3 w-3" />
            Klik untuk periksa di tabel.
          </p>
        </>
      )}
    </div>
  );
}
