"use client";

/**
 * Halaman Dashboard — merangkai seluruh modul (F2–F5).
 * Single source of truth: useFinBoardStore. Filter global → semua ikut berubah.
 */
import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Inbox, FilterX } from "lucide-react";
import { useFinBoardStore } from "@/store/finBoardStore";
import { parseCsv } from "@/lib/csvParser";
import { getRawCsv } from "@/lib/sessionCsv";
import { Button } from "@/components/ui/button";
import {
  useFiltered,
  aggregateMonthly,
  aggregateDaily,
  aggregateWeekly,
  aggregateByDimension2,
  hasBudget,
} from "@/lib/chartAggregator";
import { computeKpi, computeDeltas } from "@/lib/kpiCalculator";
import { generateInsights } from "@/lib/insightGenerator";
import { formatCurrency, formatPercent } from "@/lib/format";
import DashboardHeader from "@/components/DashboardHeader";
import GlobalFilterBar from "@/components/GlobalFilterBar";
import KpiCard from "@/components/KpiCard";
import {
  RevenueExpenseChart,
  RevenueBudgetChart,
  CategoryProfitChart,
  DepartmentProfitChart,
  ChannelProfitChart,
} from "@/components/charts";
import InsightsPanel from "@/components/InsightsPanel";
import TransactionTable from "@/components/TransactionTable";
import ManualMappingModal from "@/components/ManualMappingModal";

export default function DashboardPage() {
  const router = useRouter();
  const { dataset, setDataset } = useFinBoardStore();

  // Auto-restore dari sessionStorage (Gemini M1.3): sekali percobaan per-mount,
  // di dalam useEffect (bukan saat render) agar tidak memutasi store saat render.
  const hasTriedRestore = useRef(false);
  useEffect(() => {
    if (hasTriedRestore.current) return;
    hasTriedRestore.current = true;
    try {
      const raw = getRawCsv();
      if (raw) {
        const restored = parseCsv(raw.text, raw.fileName);
        setDataset(restored);
      }
    } catch {
      /* data korup / parsing gagal → biarkan UploadView tampil */
    }
  }, [setDataset]);

  // Belum ada data → kembali ke upload
  if (!dataset) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 px-4">
        <Inbox className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium text-foreground">Belum ada dataset dimuat</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover cursor-pointer"
        >
          Unggah CSV
        </button>
      </div>
    );
  }

  return <DashboardContent />;
}

function DashboardContent() {
  const { dataset, filter, needsManualMapping, setNeedsManualMapping, currency, exchangeRate, resetFilter } =
    useFinBoardStore();
  const [mappingOpen, setMappingOpen] = useState(false);
  const ds = dataset!;
  const allTxs = ds.transactions;

  const filtered = useFiltered(allTxs, filter);

  // Semua derivasi berat dibungkus useMemo agar hanya dihitung ulang saat
  // data/filter benar-benar berubah (PRD §9 performa re-render <250ms).
  const kpi = useMemo(() => computeKpi(filtered), [filtered]);
  const deltas = useMemo(() => computeDeltas(filtered, filter, allTxs), [filtered, filter, allTxs]);
  const monthly = useMemo(() => aggregateMonthly(filtered), [filtered]);
  const daily = useMemo(() => aggregateDaily(filtered), [filtered]);
  const weekly = useMemo(() => aggregateWeekly(filtered), [filtered]);
  const budgetAvailable = useMemo(() => hasBudget(filtered), [filtered]);
  const categoryData = useMemo(() => aggregateByDimension2(filtered, "category"), [filtered]);
  const deptData = useMemo(() => aggregateByDimension2(filtered, "department"), [filtered]);
  const channelData = useMemo(() => aggregateByDimension2(filtered, "channel"), [filtered]);
  const insights = useMemo(() => generateInsights(filtered, currency, exchangeRate), [filtered, currency, exchangeRate]);

  // Sub-metrik kontekstual untuk tiap KPI (audit UI Bagian 4).
  const avgPerTx = filtered.length > 0 ? kpi.totalRevenue / filtered.length : 0;
  const expenseRatio = kpi.totalRevenue > 0 ? (kpi.totalExpenses / kpi.totalRevenue) * 100 : 0;
  const monthCount = monthly.length;
  const avgProfitPerPeriod = monthCount > 0 ? kpi.totalProfit / monthCount : 0;
  // Rentang hari aktif (untuk default granularitas tren: ≤45 hari → Harian).
  const activeDays = useMemo(() => {
    if (filtered.length === 0) return 0;
    const dates = filtered.map((t) => t.date).sort();
    const from = filter.dateRange.from ?? dates[0];
    const to = filter.dateRange.to ?? dates[dates.length - 1];
    return Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  }, [filtered, filter.dateRange.from, filter.dateRange.to]);

  return (
    <>
      <DashboardHeader onOpenMapping={() => setMappingOpen(true)} />
      <GlobalFilterBar />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Zero-match state (UI Bagian 3): jika filter tak menghasilkan transaksi */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-surface-border bg-white px-6 py-16 text-center shadow-card">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-muted-foreground">
              <FilterX className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                Tidak ada transaksi yang cocok
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Kombinasi filter saat ini tidak menghasilkan data. Coba longgarkan rentang tanggal
                atau hapus beberapa filter.
              </p>
            </div>
            <Button onClick={resetFilter} className="gap-2">
              <FilterX className="h-4 w-4" />
              Reset Semua Filter
            </Button>
          </div>
        ) : (
          <>
            {/* KPI Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Revenue"
            value={formatCurrency(kpi.totalRevenue, currency)}
            delta={deltas.revenue}
            goodWhenUp
            tooltip={formatCurrency(kpi.totalRevenue, currency, false)}
            subtitle={`Rata-rata ${formatCurrency(avgPerTx, currency)} / transaksi`}
            index={0}
          />
          <KpiCard
            label="Total Expenses"
            value={formatCurrency(kpi.totalExpenses, currency)}
            delta={deltas.expenses}
            goodWhenUp={false}
            tooltip={formatCurrency(kpi.totalExpenses, currency, false)}
            subtitle={`Rasio biaya: ${formatPercent(expenseRatio)} dari revenue`}
            index={1}
          />
          <KpiCard
            label="Total Profit"
            value={formatCurrency(kpi.totalProfit, currency)}
            delta={deltas.profit}
            goodWhenUp
            tooltip={formatCurrency(kpi.totalProfit, currency, false)}
            subtitle={`Rata-rata ${formatCurrency(avgProfitPerPeriod, currency)} / periode`}
            index={2}
          />
          <KpiCard
            label="Profit Margin"
            value={formatPercent(kpi.profitMargin)}
            delta={deltas.margin}
            goodWhenUp
            subtitle={
              kpi.profitMargin >= 20
                ? "Margin sehat"
                : kpi.profitMargin >= 0
                  ? "Margin moderat"
                  : "Defisit"
            }
            index={3}
          />
        </div>

        {/* Charts Row 1: Tren multi-granularitas + Budget kondisional (PRD §8.2 + UI Bagian 5).
            Default granularitas: Harian jika rentang ≤45 hari, selain itu Bulanan. */}
        <div className={`grid gap-6 ${budgetAvailable ? "lg:grid-cols-2" : "grid-cols-1"}`}>
          <RevenueExpenseChart
            daily={daily}
            weekly={weekly}
            monthly={monthly}
            defaultGranularity={activeDays <= 45 ? "daily" : "monthly"}
          />
          {budgetAvailable && <RevenueBudgetChart data={monthly} />}
        </div>

        {/* Charts Row 2: Dimensi (Category/Dept/Channel) sesuai PRD §8.2 wireframe */}
        <div className="grid gap-6 lg:grid-cols-3">
          <CategoryProfitChart data={categoryData} />
          <DepartmentProfitChart data={deptData} />
          <ChannelProfitChart data={channelData} />
        </div>

        {/* Insights */}
        <InsightsPanel insights={insights} />

        {/* Table */}
        <TransactionTable data={filtered} hasBudget={budgetAvailable} />
          </>
        )}
      </main>

      {(needsManualMapping || mappingOpen) && (
        <ManualMappingModal
          open
          headers={ds.headers}
          initialMapping={ds.mapping}
          onClose={() => {
            setMappingOpen(false);
            setNeedsManualMapping(false);
          }}
        />
      )}
    </>
  );
}
