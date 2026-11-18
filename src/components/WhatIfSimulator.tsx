/**
 * WhatIfSimulator — Kartu simulator "What-If" interaktif (FP&A style).
 *
 * Kartu dapat dibuka/lipat (default tertutup, gaya MonthlyPnLTable).
 * User mengatur skenario perubahan Revenue & Expenses (%), serta target
 * margin laba, lalu melihat proyeksi berdampingan dengan angka aktual
 * (terfilter). Angka reaktif terhadap currency & exchangeRate dari store.
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFinBoardStore } from "@/store/finBoardStore";
import { formatCurrency, formatPercent } from "@/lib/format";

interface WhatIfKpi {
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  profitMargin: number;
}

interface WhatIfSimulatorProps {
  kpi: WhatIfKpi;
}

const DEFAULT_REV = 0;
const DEFAULT_EXP = 0;
const DEFAULT_TARGET = 20;

export default function WhatIfSimulator({ kpi }: WhatIfSimulatorProps) {
  const [expanded, setExpanded] = useState(false);
  const [revChange, setRevChange] = useState(DEFAULT_REV);
  const [expChange, setExpChange] = useState(DEFAULT_EXP);
  const [targetMargin, setTargetMargin] = useState(DEFAULT_TARGET);

  const currency = useFinBoardStore((s) => s.currency);
  const exchangeRate = useFinBoardStore((s) => s.exchangeRate);

  const fmt = (v: number) => formatCurrency(v, currency, true, exchangeRate);

  const projectedRevenue = kpi.totalRevenue * (1 + revChange / 100);
  const projectedExpenses = kpi.totalExpenses * (1 + expChange / 100);
  const projectedProfit = projectedRevenue - projectedExpenses;
  const projectedMargin =
    projectedRevenue > 0 ? (projectedProfit / projectedRevenue) * 100 : 0;

  const profitDelta = projectedProfit - kpi.totalProfit;
  const targetMet = projectedMargin >= targetMargin;
  const gapPoin = targetMargin - projectedMargin;

  const resetSim = () => {
    setRevChange(DEFAULT_REV);
    setExpChange(DEFAULT_EXP);
    setTargetMargin(DEFAULT_TARGET);
  };

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
            What-If Simulator
          </h2>
          <p className="text-xs text-slate-500">
            Simulasikan perubahan revenue &amp; expenses, lihat dampaknya ke
            laba &amp; margin.
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
        )}
      </button>

      {expanded && (
        <div className="border-t border-surface-border px-4 py-4 space-y-4">
          {/* === Kontrol === */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="wis-rev"
                  className="text-sm font-medium text-slate-700"
                >
                  Perubahan Revenue
                </label>
                <span className="text-sm font-semibold text-primary tabular-nums">
                  {revChange > 0 ? "+" : ""}
                  {revChange}%
                </span>
              </div>
              <input
                id="wis-rev"
                type="range"
                min={-30}
                max={50}
                step={1}
                value={revChange}
                onChange={(e) => setRevChange(Number(e.target.value))}
                className="w-full cursor-pointer accent-primary"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="wis-exp"
                  className="text-sm font-medium text-slate-700"
                >
                  Perubahan Expenses
                </label>
                <span className="text-sm font-semibold text-primary tabular-nums">
                  {expChange > 0 ? "+" : ""}
                  {expChange}%
                </span>
              </div>
              <input
                id="wis-exp"
                type="range"
                min={-30}
                max={30}
                step={1}
                value={expChange}
                onChange={(e) => setExpChange(Number(e.target.value))}
                className="w-full cursor-pointer accent-primary"
              />
            </div>

            <div>
              <label
                htmlFor="wis-target"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Target Profit Margin (%)
              </label>
              <input
                id="wis-target"
                type="number"
                min={0}
                max={100}
                step={1}
                value={targetMargin}
                onChange={(e) => setTargetMargin(Number(e.target.value))}
                className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={resetSim}
                className="w-full md:w-auto"
              >
                <RotateCcw aria-hidden />
                Reset Simulasi
              </Button>
            </div>
          </div>

          {/* === Pemisah === */}
          <div className="border-t border-surface-border" />

          {/* === Tabel Aktual vs Proyeksi === */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-slate-50">
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">
                    Metrik
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">
                    Aktual (Terfilter)
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">
                    Proyeksi Simulasi
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-surface-border/60">
                  <td className="px-3 py-2 text-slate-700">Revenue</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmt(kpi.totalRevenue)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {fmt(projectedRevenue)}
                  </td>
                </tr>
                <tr className="border-b border-surface-border/60">
                  <td className="px-3 py-2 text-slate-700">Expenses</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmt(kpi.totalExpenses)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {fmt(projectedExpenses)}
                  </td>
                </tr>
                <tr className="border-b border-surface-border/60">
                  <td className="px-3 py-2 text-slate-700">Net Profit</td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      kpi.totalProfit >= 0
                        ? "text-success"
                        : "text-danger font-medium"
                    }`}
                  >
                    {fmt(kpi.totalProfit)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums font-medium ${
                      projectedProfit >= 0
                        ? "text-success"
                        : "text-danger font-medium"
                    }`}
                  >
                    {fmt(projectedProfit)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-slate-700">Margin (%)</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatPercent(kpi.profitMargin)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {formatPercent(projectedMargin)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* === Badge dampak & target === */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                profitDelta >= 0
                  ? "bg-success-soft text-success"
                  : "bg-danger-soft text-danger"
              }`}
            >
              {profitDelta >= 0 ? "+" : "-"}
              {formatCurrency(Math.abs(profitDelta), currency, true, exchangeRate)}{" "}
              laba
            </span>

            {targetMet ? (
              <span className="inline-flex items-center rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
                ✓ Target tercapai
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-danger-soft px-3 py-1 text-xs font-semibold text-danger">
                Di bawah target ({formatPercent(gapPoin)} poin lagi)
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
