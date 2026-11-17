"use client";

/**
 * Halaman Dashboard — merangkai seluruh modul (F2–F5).
 * Single source of truth: useFinBoardStore. Filter global → semua ikut berubah.
 */
import { useState } from "react";
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
  const { dataset, filter, needsManualMapping, setNeedsManualMapping } = useFinBoardStore();
  const [mappingOpen, setMappingOpen] = useState(false);

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
  const kpi = computeKpi(filtered);
  const deltas = computeDeltas(filtered, filter, allTxs);
  const monthly = aggregateMonthly(filtered);
  const budgetAvailable = hasBudget(filtered);
  const categoryData = aggregateByDimension(filtered, "category");
  const deptData = aggregateByDimension(filtered, "department");
  const channelData = aggregateByDimension(filtered, "channel");
  const insights = generateInsights(filtered);

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
          />
          <KpiCard
            label="Total Expenses"
            value={formatRupiah(kpi.totalExpenses)}
            delta={deltas.expenses}
            goodWhenUp={false}
            tooltip={formatRupiah(kpi.totalExpenses, false)}
          />
          <KpiCard
            label="Total Profit"
            value={formatRupiah(kpi.totalProfit)}
            delta={deltas.profit}
            goodWhenUp
            tooltip={formatRupiah(kpi.totalProfit, false)}
          />
          <KpiCard
            label="Profit Margin"
            value={formatPercent(kpi.profitMargin)}
            delta={deltas.margin}
            goodWhenUp
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RevenueExpenseChart data={monthly} />
          {budgetAvailable ? (
            <RevenueBudgetChart data={monthly} />
          ) : (
            <CategoryProfitChart data={categoryData} />
          )}
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-6 lg:grid-cols-3">
          {budgetAvailable && <CategoryProfitChart data={categoryData} />}
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
