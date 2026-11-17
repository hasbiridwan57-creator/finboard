/**
 * Selector memoized: filter baris + agregasi chart (PRD FR-FLT-01, FR-CHR).
 */
import { useMemo } from "react";
import type { GlobalFilterState, NormalizedTransaction } from "@/lib/types";

/** Terapkan GlobalFilterState ke dataset penuh. */
export function applyFilter(
  txs: NormalizedTransaction[],
  filter: GlobalFilterState,
): NormalizedTransaction[] {
  const { dateRange, categories, departments, channels } = filter;
  return txs.filter((t) => {
    if (dateRange.from && t.date < dateRange.from) return false;
    if (dateRange.to && t.date > dateRange.to) return false;
    if (categories.length > 0 && !categories.includes(t.category)) return false;
    if (departments.length > 0 && !departments.includes(t.department)) return false;
    if (channels.length > 0 && !channels.includes(t.channel)) return false;
    return true;
  });
}

export function useFiltered(txs: NormalizedTransaction[], filter: GlobalFilterState) {
  return useMemo(() => applyFilter(txs, filter), [txs, filter]);
}

export interface MonthlyPoint {
  monthKey: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
  budget: number | null;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Seri bulanan (Revenue vs Expenses vs Budget). */
export function aggregateMonthly(txs: NormalizedTransaction[]): MonthlyPoint[] {
  const map = new Map<string, MonthlyPoint>();
  let anyBudget = false;
  for (const t of txs) {
    let p = map.get(t.monthKey);
    if (!p) {
      p = {
        monthKey: t.monthKey,
        label: monthLabel(t.monthKey),
        revenue: 0,
        expenses: 0,
        profit: 0,
        budget: 0,
      };
      map.set(t.monthKey, p);
    }
    p.revenue += t.revenue;
    p.expenses += t.expenses;
    p.profit += t.profit;
    if (t.budget !== null && t.budget > 0) {
      p.budget = (p.budget ?? 0) + t.budget;
      anyBudget = true;
    }
  }
  const arr = Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  // Jika tidak ada satu pun budget valid, set semua null (chart budget disembunyikan)
  if (!anyBudget) {
    for (const p of arr) p.budget = null;
  }
  return arr;
}

export interface DimensionPoint {
  name: string;
  value: number;
}

/** Agregasi profit per dimensi, diurutkan menurun, dengan Top-N + Lainnya (PRD §13). */
export function aggregateByDimension(
  txs: NormalizedTransaction[],
  key: "category" | "department" | "channel",
  topN = 7,
): DimensionPoint[] {
  const map = new Map<string, number>();
  for (const t of txs) {
    map.set(t[key], (map.get(t[key]) ?? 0) + t.profit);
  }
  const arr = Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  if (arr.length <= topN) return arr;

  const top = arr.slice(0, topN);
  const others = arr.slice(topN).reduce((s, d) => s + d.value, 0);
  top.push({ name: "Lainnya", value: others });
  return top;
}

/** Nilai unik untuk opsi filter (dari dataset penuh). */
export function uniqueValues(
  txs: NormalizedTransaction[],
  key: "category" | "department" | "channel",
): string[] {
  const set = new Set<string>();
  for (const t of txs) set.add(t[key]);
  return Array.from(set).sort();
}

/** Apakah kolom budget tersedia & valid (>0) untuk menampilkan chart budget (PRD US-05). */
export function hasBudget(txs: NormalizedTransaction[]): boolean {
  return txs.some((t) => t.budget !== null && t.budget > 0);
}
