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
 * Hitung delta periode-atas-periode (apple-to-apple berbasis JUMLAH HARI).
 *
 * Selalu bandingkan rentang hari aktif [from, to] (inklusif) terhadap rentang
 * berdurasi hari SAMA persis di periode sebelumnya, berapa pun bulan kalender
 * yang tercakup. Ini menutup edge case: filter tanggal yang memotong sebagian
 * bulan (mis. mulai tanggal 7) tak lagi dibandingkan melawan 1 bulan penuh,
 * melainkan melawan durasi hari yang setara (PRD FR-KPI-01, FR-FLT-02).
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

  // Rentang hari aktif yang benar-benar berisi data (inklusif).
  const from = bounds.min;
  const to = bounds.max;

  // Periode sebelumnya diambil dari fullDataset, TAPI tetap harus menghormati filter
  // dimensi aktif (kategori/departemen/kanal) — hanya sumbu TANGGAL yang digeser ke
  // periode sebelumnya (PRD FR-KPI-01: apples-to-apples pada segmen yang sama).
  const dimFiltered = fullDataset.filter(
    (t) =>
      (filter.categories.length === 0 || filter.categories.includes(t.category)) &&
      (filter.departments.length === 0 || filter.departments.includes(t.department)) &&
      (filter.channels.length === 0 || filter.channels.includes(t.channel)),
  );

  // Durasi hari inklusif rentang aktif, lalu geser mundur sebesar durasi yang sama.
  const days =
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1;
  if (days <= 0) return empty;

  const prevTo = addDaysIso(from, -1);
  const prevFrom = addDaysIso(from, -days);

  const currentTxs = filtered;
  const previousTxs = dimFiltered.filter((t) => t.date >= prevFrom && t.date <= prevTo);
  if (previousTxs.length === 0) return empty;

  const cur = computeKpi(currentTxs);
  const prev = computeKpi(previousTxs);

  return {
    revenue: pctChange(cur.totalRevenue, prev.totalRevenue),
    expenses: pctChange(cur.totalExpenses, prev.totalExpenses),
    profit: pctChange(cur.totalProfit, prev.totalProfit),
    margin: cur.profitMargin - prev.profitMargin, // poin persentase
  };
}
