"use client";

/**
 * Halaman Dashboard — merangkai seluruh modul (F2–F5).
 * Single source of truth: useFinBoardStore. Filter global → semua ikut berubah.
 */
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Inbox, FilterX } from "lucide-react";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
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
import { generateInsights, detectAnomalies } from "@/lib/insightGenerator";
import type { NormalizedTransaction } from "@/lib/types";
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
import MonthlyPnLTable from "@/components/MonthlyPnLTable";
import WhatIfSimulator from "@/components/WhatIfSimulator";
import { SegmentParetoCard } from "@/components/SegmentParetoCard";
import AnomalyHighlights from "@/components/AnomalyHighlights";
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
  const [tableSearch, setTableSearch] = useState("");
  const ds = dataset!;
  const allTxs = ds.transactions;

  const filtered = useFiltered(allTxs, filter);

  // Semua derivasi berat dibungkus useMemo agar hanya dihitung ulang saat
  // data/filter benar-benar berubah (PRD §9 performa re-render <250ms).
  const kpi = useMemo(() => computeKpi(filtered), [filtered]);
  const anomalies = useMemo(() => detectAnomalies(filtered), [filtered]);

  // Drill-down anomali (Gemini M5.2.d): isi pencarian tabel + smooth scroll.
  const handleInspectAnomaly = useCallback((tx: NormalizedTransaction) => {
    setTableSearch(tx.id);
    // debounce tabel 200ms; tunggu sedikit lalu scroll agar baris sudah tersaring.
    setTimeout(() => {
      document
        .getElementById("transaction-table")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
  }, []);
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

  // Data sparkline mini-tren bulanan untuk tiap KPI card (Gemini M3.1).
  const sparkRevenue = useMemo(() => monthly.map((m) => m.revenue), [monthly]);
  const sparkExpenses = useMemo(() => monthly.map((m) => m.expenses), [monthly]);
  const sparkProfit = useMemo(() => monthly.map((m) => m.profit), [monthly]);
  const sparkMargin = useMemo(
    () => monthly.map((m) => (m.revenue > 0 ? (m.profit / m.revenue) * 100 : 0)),
    [monthly],
  );
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
      {/* Header laporan khusus cetak PDF (Gemini M6.2) — hanya muncul saat Cetak/Simpan PDF */}
      <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-4">
        <h1 className="text-xl font-bold text-slate-900">
          LAPORAN ANALITIK KEUANGAN — FINBOARD
        </h1>
        <div className="mt-2 grid gap-1 text-xs text-slate-700">
          <div>
            <span className="font-medium">Sumber Data:</span> {ds.fileName}
          </div>
          <div>
            <span className="font-medium">Tanggal Cetak:</span>{" "}
            {format(new Date(), "dd MMM yyyy", { locale: id })}
          </div>
          <div>
            <span className="font-medium">Mata Uang:</span>{" "}
            {currency === "USD"
              ? `USD (kurs 1 USD = ${formatCurrency(exchangeRate, "IDR", false)})`
              : "IDR"}
          </div>
          <div>
            <span className="font-medium">Filter Aktif:</span>{" "}
            {filter.dateRange.from || filter.dateRange.to
              ? `${filter.dateRange.from ? format(parseISO(filter.dateRange.from), "dd MMM yyyy", { locale: id }) : "…"} s.d. ${filter.dateRange.to ? format(parseISO(filter.dateRange.to), "dd MMM yyyy", { locale: id }) : "…"}`
              : "Semua tanggal"}
            {filter.categories.length > 0 && ` | Kategori: ${filter.categories.join(", ")}`}
            {filter.departments.length > 0 && ` | Departemen: ${filter.departments.join(", ")}`}
            {filter.channels.length > 0 && ` | Kanal: ${filter.channels.join(", ")}`}
          </div>
        </div>
      </div>

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
            sparkline={sparkRevenue}
            index={0}
          />
          <KpiCard
            label="Total Expenses"
            value={formatCurrency(kpi.totalExpenses, currency)}
            delta={deltas.expenses}
            goodWhenUp={false}
            tooltip={formatCurrency(kpi.totalExpenses, currency, false)}
            subtitle={`Rasio biaya: ${formatPercent(expenseRatio)} dari revenue`}
            sparkline={sparkExpenses}
            index={1}
          />
          <KpiCard
            label="Total Profit"
            value={formatCurrency(kpi.totalProfit, currency)}
            delta={deltas.profit}
            goodWhenUp
            tooltip={formatCurrency(kpi.totalProfit, currency, false)}
            subtitle={`Rata-rata ${formatCurrency(avgProfitPerPeriod, currency)} / periode`}
            sparkline={sparkProfit}
            index={2}
          />
          <KpiCard
            label="Profit Margin"
            value={formatPercent(kpi.profitMargin)}
            delta={deltas.margin}
            goodWhenUp
            sparkline={sparkMargin}
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

        {/* Monthly P&L Statement (FP&A style, collapsible) */}
        <MonthlyPnLTable monthly={monthly} hasBudget={budgetAvailable} />

        {/* Modul FP&A: What-If Simulator + Analisis Pareto 80/20 (Gemini M4) */}
        <div className="grid gap-6 lg:grid-cols-2">
          <WhatIfSimulator kpi={kpi} />
          <SegmentParetoCard txs={filtered} />
        </div>

        {/* Insights + Deteksi Anomali (Gemini M5.2): berdampingan */}
        <div className="grid gap-6 lg:grid-cols-2">
          <InsightsPanel insights={insights} />
          <AnomalyHighlights anomalies={anomalies} onInspect={handleInspectAnomaly} />
        </div>

        {/* Table */}
        <TransactionTable
          data={filtered}
          hasBudget={budgetAvailable}
          externalSearch={tableSearch}
        />
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
