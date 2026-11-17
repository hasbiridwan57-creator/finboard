/**
 * Kalkulator KPI + delta periode (PRD FR-KPI-01).
 */
import type { NormalizedTransaction, GlobalFilterState } from "@/lib/types";

export interface KpiValue {
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  profitMargin: number; // persen (0–100)
}

export interface KpiDelta {
  /** null = tidak bisa dibandingkan (periode tunggal) */
  revenue: number | null;
  expenses: number | null;
  profit: number | null;
  /** delta margin dalam poin persentase */
  margin: number | null;
}

export function computeKpi(txs: NormalizedTransaction[]): KpiValue {
  let revenue = 0;
  let expenses = 0;
  let profit = 0;
  for (const t of txs) {
    revenue += t.revenue;
    expenses += t.expenses;
    profit += t.profit;
  }
  return {
    totalRevenue: revenue,
    totalExpenses: expenses,
    totalProfit: profit,
    profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0,
  };
}

/** Rentang tanggal [from, to] dari transaksi terfilter (inclusive, ISO string). */
function dateBounds(txs: NormalizedTransaction[]): { min: string; max: string } | null {
  if (txs.length === 0) return null;
  let min = txs[0].date;
  let max = txs[0].date;
  for (const t of txs) {
    if (t.date < min) min = t.date;
    if (t.date > max) max = t.date;
  }
  return { min, max };
}

/** Kumpulan bulan kalender unik (YYYY-MM) dari transaksi. */
function uniqueMonths(txs: NormalizedTransaction[]): string[] {
  const set = new Set<string>();
  for (const t of txs) set.add(t.monthKey);
  return Array.from(set).sort();
}

function monthAdd(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Tambah hari ke tanggal ISO. */
function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Hitung delta periode-atas-periode.
 * - Jika rentang mencakup ≥ 2 bulan kalender: bandingkan bulan penuh terakhir vs bulan sebelumnya (MoM).
 * - Jika rentang kustom < 1 bulan: bandingkan rentang aktif vs rentang berdurasi sama sebelumnya (jika ada data).
 * - Jika hanya 1 periode: kembalikan null (PRD US-04).
 */
export function computeDeltas(
  filtered: NormalizedTransaction[],
  filter: GlobalFilterState,
  fullDataset: NormalizedTransaction[],
): KpiDelta {
  const empty: KpiDelta = { revenue: null, expenses: null, profit: null, margin: null };
  if (filtered.length === 0) return empty;

  const bounds = dateBounds(filtered);
  if (!bounds) return empty;

  const months = uniqueMonths(filtered);
  let currentTxs: NormalizedTransaction[];
  let previousTxs: NormalizedTransaction[];

  if (months.length >= 2) {
    // MoM: bulan penuh terakhir vs bulan sebelumnya
    const lastMonth = months[months.length - 1];
    const prevMonth = monthAdd(lastMonth, -1);
    currentTxs = filtered.filter((t) => t.monthKey === lastMonth);
    // prevMonth mungkin tidak lolos filter user — ambil dari fullDataset
    previousTxs = fullDataset.filter((t) => t.monthKey === prevMonth);
    if (previousTxs.length === 0) return empty;
  } else {
    // Rentang tunggal/kustom: bandingkan durasi sama sebelumnya
    const from = filter.dateRange.from ?? bounds.min;
    const to = filter.dateRange.to ?? bounds.max;
    // durasi = jumlah hari inklusif
    const days =
      Math.round(
        (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000,
      ) + 1;
    const prevFrom = addDaysIso(from, -days);
    const prevTo = addDaysIso(from, -1);
    previousTxs = fullDataset.filter((t) => t.date >= prevFrom && t.date <= prevTo);
    if (previousTxs.length === 0) return empty;
    currentTxs = filtered;
  }

  const cur = computeKpi(currentTxs);
  const prev = computeKpi(previousTxs);

  return {
    revenue: pctChange(cur.totalRevenue, prev.totalRevenue),
    expenses: pctChange(cur.totalExpenses, prev.totalExpenses),
    profit: pctChange(cur.totalProfit, prev.totalProfit),
    margin: cur.profitMargin - prev.profitMargin, // poin persentase
  };
}
