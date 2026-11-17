"use client";

/** Header dashboard (PRD FR-UPL-04) + badge kualitas data, toggle mata uang (B4), ekspor laporan (B2). */
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BarChart3,
  ClipboardCopy,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Settings2,
  Table2,
  TriangleAlert,
} from "lucide-react";
import { useFinBoardStore } from "@/store/finBoardStore";
import { Button } from "@/components/ui/button";
import { computeKpi } from "@/lib/kpiCalculator";
import { applyFilter } from "@/lib/chartAggregator";
import { formatCurrency, formatPercent } from "@/lib/format";
import { generateInsights } from "@/lib/insightGenerator";
import type { NormalizedTransaction } from "@/lib/types";

/** Salin ringkasan KPI + poin insight ke clipboard (B2). */
async function copySummary(
  txs: NormalizedTransaction[],
  fileName: string,
  currency: "IDR" | "USD",
): Promise<void> {
  const kpi = computeKpi(txs);
  const insights = generateInsights(txs);
  const lines = [
    `Ringkasan FinBoard — ${fileName}`,
    "",
    `Total Revenue  : ${formatCurrency(kpi.totalRevenue, currency, false)}`,
    `Total Expenses : ${formatCurrency(kpi.totalExpenses, currency, false)}`,
    `Total Profit   : ${formatCurrency(kpi.totalProfit, currency, false)}`,
    `Profit Margin  : ${formatPercent(kpi.profitMargin)}`,
    "",
    "Insight Bisnis:",
    ...insights.map((i, idx) => `${idx + 1}. ${i.text.replace(/\*\*/g, "")}`),
  ];
  await navigator.clipboard.writeText(lines.join("\n"));
}

/** Unduh transaksi terfilter sebagai CSV (B2). */
function downloadFilteredCsv(txs: NormalizedTransaction[], fileName: string): void {
  const header = "Tanggal,Revenue,Expenses,Profit,Kategori,Departemen,Channel,Budget";
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = txs.map((t) =>
    [
      t.date,
      t.revenue,
      t.expenses,
      t.profit,
      t.category,
      t.department,
      t.channel,
      t.budget ?? "",
    ].map(escape).join(","),
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DashboardHeader({ onOpenMapping }: { onOpenMapping: () => void }) {
  const router = useRouter();
  const { dataset, filter, clearSession, currency, setCurrency } = useFinBoardStore();
  if (!dataset) return null;

  const cleanedRows = dataset.invalidDateRows + dataset.cleanedNumericCells;
  const filteredTxs = applyFilter(dataset.transactions, filter);

  const handleCopy = async () => {
    try {
      await copySummary(filteredTxs, dataset.fileName, currency);
      toast.success("Ringkasan disalin ke clipboard", {
        description: "Angka KPI + poin insight siap ditempel ke laporan.",
      });
    } catch {
      toast.error("Gagal menyalin ringkasan", {
        description: "Browser mungkin memblokir akses clipboard.",
      });
    }
  };

  const handleExport = () => {
    if (filteredTxs.length === 0) {
      toast.info("Tidak ada transaksi terfilter untuk diekspor.");
      return;
    }
    downloadFilteredCsv(filteredTxs, `finboard-terfilter-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success("CSV terfilter diunduh", {
      description: `${filteredTxs.length} transaksi diekspor.`,
    });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-surface-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <BarChart3 className="h-4 w-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">FinBoard</span>
        </div>

        <div className="flex min-w-0 items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
          <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="truncate text-sm text-muted-foreground" title={dataset.fileName}>
            {dataset.fileName}
          </span>
          <span className="flex-shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-foreground">
            <Table2 className="mr-1 inline h-3 w-3" />
            {dataset.transactions.length} baris
          </span>
        </div>

        {cleanedRows > 0 && (
          <span
            title={`${dataset.invalidDateRows} baris tanggal tidak valid & ${dataset.cleanedNumericCells} sel angka tidak valid dinormalisasi ke 0.`}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
          >
            <TriangleAlert className="h-3.5 w-3.5" />
            <span className="tabular-nums">{cleanedRows} sel dibersihkan</span>
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Toggle mata uang tampilan (B4): hanya mengubah format, bukan konversi kurs. */}
          <div className="inline-flex rounded-lg border border-surface-border bg-background p-0.5">
            {(["IDR", "USD"] as const).map((m) => (
              <Button
                key={m}
                variant={currency === m ? "default" : "ghost"}
                size="sm"
                onClick={() => setCurrency(m)}
                className="h-7 px-2.5 text-xs tabular-nums"
                aria-pressed={currency === m}
              >
                {m === "IDR" ? "Rp" : "$"}
              </Button>
            ))}
          </div>
          {/* Ekspor laporan cepat (B2). */}
          <Button variant="outline" onClick={handleCopy} className="flex items-center gap-1.5">
            <ClipboardCopy className="h-4 w-4" />
            <span className="hidden sm:inline">Salin Ringkasan</span>
          </Button>
          <Button variant="outline" onClick={handleExport} className="flex items-center gap-1.5">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Ekspor CSV</span>
          </Button>
          <Button variant="outline" onClick={onOpenMapping} className="flex items-center gap-1.5">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Atur Kolom</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              clearSession();
              router.push("/");
            }}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Ganti CSV</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
