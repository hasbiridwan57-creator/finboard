/**
 * Mesin insight otomatis berbasis aturan (PRD FR-INS).
 * 3–5 poin, sinkron dengan data terfilter.
 */
import type { NormalizedTransaction } from "@/lib/types";
import { aggregateMonthly } from "./chartAggregator";
import { computeKpi } from "./kpiCalculator";
import { formatRupiah, formatPercent } from "./format";

export interface Insight {
  text: string;
  /** "info" | "positive" | "warning" — untuk pewarnaan opsional */
  tone: "info" | "positive" | "warning";
}

export function generateInsights(txs: NormalizedTransaction[]): Insight[] {
  if (txs.length === 0) return [];
  const insights: Insight[] = [];

  const kpi = computeKpi(txs);
  const months = aggregateMonthly(txs);

  // 1. Dominasi kontributor revenue (per kategori)
  const byCategoryRev = new Map<string, number>();
  for (const t of txs) byCategoryRev.set(t.category, (byCategoryRev.get(t.category) ?? 0) + t.revenue);
  const topCat = Array.from(byCategoryRev.entries()).sort((a, b) => b[1] - a[1])[0];
  if (topCat && kpi.totalRevenue > 0) {
    const pct = (topCat[1] / kpi.totalRevenue) * 100;
    insights.push({
      tone: "info",
      text: `Kategori **${topCat[0]}** menjadi penyumbang pendapatan terbesar sebesar **${formatPercent(pct)}** (**${formatRupiah(topCat[1])}**) dari total revenue.`,
    });
  }

  // 2. Tren profit margin bulan terakhir vs sebelumnya
  if (months.length >= 2) {
    const last = months[months.length - 1];
    const prev = months[months.length - 2];
    const lastMargin = last.revenue > 0 ? (last.profit / last.revenue) * 100 : 0;
    const prevMargin = prev.revenue > 0 ? (prev.profit / prev.revenue) * 100 : 0;
    const diff = lastMargin - prevMargin;
    const arah = diff >= 0 ? "naik" : "turun";
    insights.push({
      tone: diff >= 0 ? "positive" : "warning",
      text: `Profit margin **${arah}** sebesar **${formatPercent(Math.abs(diff))}** dibanding bulan sebelumnya menjadi **${formatPercent(lastMargin)}**.`,
    });
  }

  // 3. Departemen paling menguntungkan
  const byDeptProfit = new Map<string, { profit: number; revenue: number }>();
  for (const t of txs) {
    const cur = byDeptProfit.get(t.department) ?? { profit: 0, revenue: 0 };
    cur.profit += t.profit;
    cur.revenue += t.revenue;
    byDeptProfit.set(t.department, cur);
  }
  const topDept = Array.from(byDeptProfit.entries()).sort((a, b) => b[1].profit - a[1].profit)[0];
  if (topDept && topDept[1].profit > 0) {
    const margin = topDept[1].revenue > 0 ? (topDept[1].profit / topDept[1].revenue) * 100 : 0;
    insights.push({
      tone: "positive",
      text: `Departemen **${topDept[0]}** mencatatkan laba tertinggi sebesar **${formatRupiah(topDept[1].profit)}** dengan margin efisiensi **${formatPercent(margin)}**.`,
    });
  }

  // 4. Anomali rugi (profit negatif) — periksa level Departemen DAN Kategori (PRD FR-INS).
  // Menggabungkan kedua dimensi agar defisit di segmen mana pun terdeteksi.
  const profitBy = (key: "category" | "department") => {
    const m = new Map<string, number>();
    for (const t of txs) m.set(t[key], (m.get(t[key]) ?? 0) + t.profit);
    return m;
  };
  const lossSegments = [
    ...Array.from(profitBy("category").entries()).map(([name, profit]) => ({ name, profit, dim: "Kategori" })),
    ...Array.from(profitBy("department").entries()).map(([name, profit]) => ({ name, profit, dim: "Departemen" })),
  ]
    .filter((s) => s.profit < 0)
    .sort((a, b) => a.profit - b.profit);
  if (lossSegments.length > 0) {
    const worst = lossSegments[0];
    insights.push({
      tone: "warning",
      text: `Perhatian: ${worst.dim} **${worst.name}** mengalami defisit laba sebesar **${formatRupiah(worst.profit)}** pada periode terpilih.`,
    });
  }

  // 5. Pencapaian anggaran (jika budget ada)
  if (kpi.totalRevenue > 0) {
    const totalBudget = txs.reduce((s, t) => s + (t.budget ?? 0), 0);
    if (totalBudget > 0) {
      const pct = (kpi.totalRevenue / totalBudget) * 100;
      insights.push({
        tone: pct >= 100 ? "positive" : "info",
        text: `Realisasi pendapatan mencapai **${formatPercent(pct)}** dari total anggaran (**${formatRupiah(kpi.totalRevenue)}** vs target **${formatRupiah(totalBudget)}**).`,
      });
    }
  }

  return insights.slice(0, 5);
}
