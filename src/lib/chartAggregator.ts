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

/** Granularitas tren (audit UI Bagian 5). */
export type Granularity = "daily" | "weekly" | "monthly";

/** Seri harian: satu titik per tanggal ISO. */
export function aggregateDaily(txs: NormalizedTransaction[]): MonthlyPoint[] {
  const map = new Map<string, MonthlyPoint>();
  let anyBudget = false;
  for (const t of txs) {
    let p = map.get(t.date);
    if (!p) {
      p = { monthKey: t.date, label: shortDate(t.date), revenue: 0, expenses: 0, profit: 0, budget: 0 };
      map.set(t.date, p);
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
  if (!anyBudget) for (const p of arr) p.budget = null;
  return arr;
}

/** Seri mingguan: dikelompokkan per minggu ISO (Senin sebagai awal minggu). */
export function aggregateWeekly(txs: NormalizedTransaction[]): MonthlyPoint[] {
  const map = new Map<string, MonthlyPoint>();
  let anyBudget = false;
  for (const t of txs) {
    const wk = weekKey(t.date);
    let p = map.get(wk);
    if (!p) {
      p = { monthKey: wk, label: weekLabel(wk), revenue: 0, expenses: 0, profit: 0, budget: 0 };
      map.set(wk, p);
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
  if (!anyBudget) for (const p of arr) p.budget = null;
  return arr;
}

/** "2026-01-05" → "5 Jan". */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1]}`;
}

/** Kunci minggu ISO "YYYY-Www". */
function weekKey(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // Senin=0
  d.setUTCDate(d.getUTCDate() - day); // mundur ke Senin
  const thu = new Date(d);
  thu.setUTCDate(thu.getUTCDate() + 3); // Kamis penentu tahun ISO
  const year = thu.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((thu.getTime() - jan1.getTime()) / 86400000 + jan1.getUTCDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Label singkat minggu dari kunci "YYYY-Www": "Minggu ww/YY". */
function weekLabel(wk: string): string {
  const [y, w] = wk.split("-W");
  return `Mg ${Number(w)}/${y.slice(2)}`;
}

export interface DimensionPoint {
  name: string;
  value: number;
}

/** Titik dimensi dengan 2 metrik (Profit & Revenue) untuk switcher metrik (UI Bagian 5). */
export interface DimensionMetricPoint {
  name: string;
  profit: number;
  revenue: number;
}

/** Agregasi profit & revenue per dimensi + Top-N + Lainnya. */
export function aggregateByDimension2(
  txs: NormalizedTransaction[],
  key: "category" | "department" | "channel",
  topN = 7,
): DimensionMetricPoint[] {
  const map = new Map<string, { profit: number; revenue: number }>();
  for (const t of txs) {
    const cur = map.get(t[key]) ?? { profit: 0, revenue: 0 };
    cur.profit += t.profit;
    cur.revenue += t.revenue;
    map.set(t[key], cur);
  }
  const arr = Array.from(map.entries()).map(([name, v]) => ({ name, ...v }));
  arr.sort((a, b) => b.profit - a.profit);
  if (arr.length <= topN) return arr;
  const top = arr.slice(0, topN);
  const rest = arr.slice(topN);
  top.push({
    name: "Lainnya",
    profit: rest.reduce((s, d) => s + d.profit, 0),
    revenue: rest.reduce((s, d) => s + d.revenue, 0),
  });
  return top;
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
