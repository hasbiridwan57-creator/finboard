/**
 * MonthlyPnLTable — Kartu Laporan Laba Rugi Bulanan (FP&A style, PRD FR-CHR / UI Bagian 5).
 *
 * Kartu dapat dibuka/lipat (default tertutup agar dashboard tidak terlalu padat).
 * Tabel horisontal: baris = komponen P&L, kolom = bulan aktif + Total/Rata-rata.
 * Kolom pertama sticky agar label tetap terlihat saat scroll horisontal.
 */

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useFinBoardStore } from "@/store/finBoardStore";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { MonthlyPoint } from "@/lib/chartAggregator";

interface MonthlyPnLTableProps {
  monthly: MonthlyPoint[];
  hasBudget: boolean;
}

export default function MonthlyPnLTable({ monthly, hasBudget }: MonthlyPnLTableProps) {
  const [expanded, setExpanded] = useState(false);
  const currency = useFinBoardStore((s) => s.currency);
  const exchangeRate = useFinBoardStore((s) => s.exchangeRate);

  const fmt = (v: number) => formatCurrency(v, currency, true, exchangeRate);

  const totals = monthly.reduce(
    (acc, m) => {
      acc.revenue += m.revenue;
      acc.expenses += m.expenses;
      acc.profit += m.profit;
      acc.budget += m.budget ?? 0;
      return acc;
    },
    { revenue: 0, expenses: 0, profit: 0, budget: 0 },
  );

  const momGrowth = (i: number): number | null => {
    if (i === 0) return null;
    const prev = monthly[i - 1].profit;
    if (prev === 0) return null;
    return ((monthly[i].profit - prev) / Math.abs(prev)) * 100;
  };

  const profitColor = (v: number) =>
    v >= 0 ? "text-success" : "text-danger font-medium";

  const stickyTh = "sticky left-0 z-10 bg-slate-50 text-left";
  const stickyTd = "sticky left-0 z-10 bg-white";

  return (
    <section className="rounded-xl border border-surface-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Laporan Laba Rugi Bulanan
          </h2>
          <p className="text-xs text-slate-500">
            Ringkasan P&L per bulan dengan margin, pertumbuhan MoM
            {hasBudget ? ", dan pencapaian anggaran" : ""}.
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
        )}
      </button>

      {expanded && monthly.length > 0 && (
        <div className="overflow-x-auto border-t border-surface-border">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-slate-50">
                <th className={`${stickyTh} px-4 py-2 font-semibold text-slate-700`}>
                  Komponen Laba Rugi
                </th>
                {monthly.map((m) => (
                  <th
                    key={m.monthKey}
                    className="px-4 py-2 text-right font-semibold text-slate-700"
                  >
                    {m.label}
                  </th>
                ))}
                <th className="px-4 py-2 text-right font-semibold text-slate-700">
                  Total / Rata-rata
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Revenue */}
              <tr className="border-b border-surface-border">
                <td className={`${stickyTd} px-4 py-2 font-medium text-slate-700`}>
                  Pendapatan (Revenue)
                </td>
                {monthly.map((m) => (
                  <td key={m.monthKey} className="px-4 py-2 text-right tabular-nums">
                    {fmt(m.revenue)}
                  </td>
                ))}
                <td className="px-4 py-2 text-right font-semibold tabular-nums">
                  {fmt(totals.revenue)}
                </td>
              </tr>

              {/* Expenses */}
              <tr className="border-b border-surface-border">
                <td className={`${stickyTd} px-4 py-2 font-medium text-slate-700`}>
                  (-) Pengeluaran (Expenses)
                </td>
                {monthly.map((m) => (
                  <td key={m.monthKey} className="px-4 py-2 text-right tabular-nums">
                    {fmt(m.expenses)}
                  </td>
                ))}
                <td className="px-4 py-2 text-right font-semibold tabular-nums">
                  {fmt(totals.expenses)}
                </td>
              </tr>

              {/* Net Profit */}
              <tr className="border-b border-surface-border">
                <td className={`${stickyTd} px-4 py-2 font-medium text-slate-700`}>
                  (=) Laba Bersih (Net Profit)
                </td>
                {monthly.map((m) => (
                  <td
                    key={m.monthKey}
                    className={`px-4 py-2 text-right tabular-nums ${profitColor(m.profit)}`}
                  >
                    {fmt(m.profit)}
                  </td>
                ))}
                <td
                  className={`px-4 py-2 text-right font-semibold tabular-nums ${profitColor(totals.profit)}`}
                >
                  {fmt(totals.profit)}
                </td>
              </tr>

              {/* Profit Margin */}
              <tr className="border-b border-surface-border">
                <td className={`${stickyTd} px-4 py-2 font-medium text-slate-700`}>
                  Profit Margin (%)
                </td>
                {monthly.map((m) => (
                  <td key={m.monthKey} className="px-4 py-2 text-right tabular-nums">
                    {m.revenue !== 0
                      ? formatPercent((m.profit / m.revenue) * 100)
                      : "—"}
                  </td>
                ))}
                <td className="px-4 py-2 text-right font-semibold tabular-nums">
                  {totals.revenue !== 0
                    ? formatPercent((totals.profit / totals.revenue) * 100)
                    : "—"}
                </td>
              </tr>

              {/* MoM Growth */}
              <tr className="border-b border-surface-border">
                <td className={`${stickyTd} px-4 py-2 font-medium text-slate-700`}>
                  Pertumbuhan Laba MoM (%)
                </td>
                {monthly.map((m, i) => {
                  const g = momGrowth(i);
                  return (
                    <td key={m.monthKey} className="px-4 py-2 text-right tabular-nums">
                      {g === null ? "—" : formatPercent(g)}
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-500">
                  —
                </td>
              </tr>

              {/* Budget rows (hanya jika tersedia) */}
              {hasBudget && (
                <>
                  <tr className="border-b border-surface-border">
                    <td className={`${stickyTd} px-4 py-2 font-medium text-slate-700`}>
                      Target Anggaran (Budget)
                    </td>
                    {monthly.map((m) => (
                      <td key={m.monthKey} className="px-4 py-2 text-right tabular-nums">
                        {m.budget === null ? "—" : fmt(m.budget)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {fmt(totals.budget)}
                    </td>
                  </tr>
                  <tr className="border-b border-surface-border">
                    <td className={`${stickyTd} px-4 py-2 font-medium text-slate-700`}>
                      Pencapaian Budget (%)
                    </td>
                    {monthly.map((m) => (
                      <td key={m.monthKey} className="px-4 py-2 text-right tabular-nums">
                        {m.budget && m.budget > 0
                          ? formatPercent((m.revenue / m.budget) * 100)
                          : "—"}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {totals.budget > 0
                        ? formatPercent((totals.revenue / totals.budget) * 100)
                        : "—"}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
