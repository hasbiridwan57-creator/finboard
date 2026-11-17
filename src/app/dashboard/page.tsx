"use client";

/**
 * Halaman Dashboard — merangkai seluruh modul (F2–F5).
 * Single source of truth: useFinBoardStore. Filter global → semua ikut berubah.
 */
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import { useFinBoardStore } from "@/store/finBoardStore";
import { useFiltered, aggregateMonthly, aggregateByDimension, hasBudget } from "@/lib/chartAggregator";
import { computeKpi, computeDeltas } from "@/lib/kpiCalculator";
import { generateInsights } from "@/lib/insightGenerator";
import { formatRupiah, formatPercent } from "@/lib/format";
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
  const { dataset } = useFinBoardStore();

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
  const { dataset, filter, needsManualMapping, setNeedsManualMapping } = useFinBoardStore();
  const [mappingOpen, setMappingOpen] = useState(false);
  const ds = dataset!;
  const allTxs = ds.transactions;

  const filtered = useFiltered(allTxs, filter);

  // Semua derivasi berat dibungkus useMemo agar hanya dihitung ulang saat
  // data/filter benar-benar berubah (PRD §9 performa re-render <250ms).
  const kpi = useMemo(() => computeKpi(filtered), [filtered]);
  const deltas = useMemo(() => computeDeltas(filtered, filter, allTxs), [filtered, filter, allTxs]);
  const monthly = useMemo(() => aggregateMonthly(filtered), [filtered]);
  const budgetAvailable = useMemo(() => hasBudget(filtered), [filtered]);
  const categoryData = useMemo(() => aggregateByDimension(filtered, "category"), [filtered]);
  const deptData = useMemo(() => aggregateByDimension(filtered, "department"), [filtered]);
  const channelData = useMemo(() => aggregateByDimension(filtered, "channel"), [filtered]);
  const insights = useMemo(() => generateInsights(filtered), [filtered]);

  return (
    <>
      <DashboardHeader onOpenMapping={() => setMappingOpen(true)} />
      <GlobalFilterBar />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* KPI Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Revenue"
            value={formatRupiah(kpi.totalRevenue)}
            delta={deltas.revenue}
            goodWhenUp
            tooltip={formatRupiah(kpi.totalRevenue, false)}
            index={0}
          />
          <KpiCard
            label="Total Expenses"
            value={formatRupiah(kpi.totalExpenses)}
            delta={deltas.expenses}
            goodWhenUp={false}
            tooltip={formatRupiah(kpi.totalExpenses, false)}
            index={1}
          />
          <KpiCard
            label="Total Profit"
            value={formatRupiah(kpi.totalProfit)}
            delta={deltas.profit}
            goodWhenUp
            tooltip={formatRupiah(kpi.totalProfit, false)}
            index={2}
          />
          <KpiCard
            label="Profit Margin"
            value={formatPercent(kpi.profitMargin)}
            delta={deltas.margin}
            goodWhenUp
            index={3}
          />
        </div>

        {/* Charts Row 1: Tren bulanan + Budget kondisional (PRD §8.2).
            Grid dinamis: jika kolom Budget tak tersedia, chart tren memenuhi
            lebar penuh (tanpa ruang kosong). */}
        <div className={`grid gap-6 ${budgetAvailable ? "lg:grid-cols-2" : "grid-cols-1"}`}>
          <RevenueExpenseChart data={monthly} />
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
