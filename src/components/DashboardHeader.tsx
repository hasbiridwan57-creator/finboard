"use client";

/** Header dashboard (PRD FR-UPL-04) + badge kualitas data, toggle mata uang (B4), ekspor laporan (B2, M6.1), pintasan keyboard + panduan (M6.3). */
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  BarChart3,
  ClipboardCopy,
  Download,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Settings2,
  Table2,
  ChevronDown,
  ShieldCheck,
  HelpCircle,
  FileText,
  Keyboard,
} from "lucide-react";
import { useFinBoardStore } from "@/store/finBoardStore";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { computeKpi } from "@/lib/kpiCalculator";
import { applyFilter, aggregateMonthly } from "@/lib/chartAggregator";
import { exportExcel } from "@/lib/excelExporter";
import { formatCurrency, formatPercent } from "@/lib/format";
import { generateInsights } from "@/lib/insightGenerator";
import type { CanonicalField, NormalizedTransaction } from "@/lib/types";

/** Label Indonesia untuk setiap field kanonik (dipakai popover kesehatan data). */
const FIELD_LABELS_ID: Record<CanonicalField, string> = {
  date: "Tanggal",
  revenue: "Revenue",
  expenses: "Expenses",
  profit: "Profit",
  category: "Kategori",
  department: "Departemen",
  channel: "Kanal",
  budget: "Budget",
};

const FIELD_ORDER: CanonicalField[] = [
  "date", "revenue", "expenses", "profit",
  "category", "department", "channel", "budget",
];

/** Salin ringkasan KPI + poin insight ke clipboard (B2). */
async function copySummary(
  txs: NormalizedTransaction[],
  fileName: string,
  currency: "IDR" | "USD",
  exchangeRate: number,
): Promise<void> {
  const kpi = computeKpi(txs);
  const insights = generateInsights(txs, currency, exchangeRate);
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

/** Helper CSV: escape sel sesuai RFC4180 (kutip bila ada ; " atau newline). */
function csvEscape(value: string | number): string {
  const s = String(value);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Unduh teks sebagai file via Blob + anchor sementara. */
function downloadTextFile(content: string, fileName: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Ringkas status filter aktif jadi satu baris untuk header laporan CSV. */
function describeFilter(
  filter: { dateRange: { from: string | null; to: string | null }; categories: string[]; departments: string[]; channels: string[] },
): string {
  const parts: string[] = [];
  if (filter.dateRange.from || filter.dateRange.to) {
    const from = filter.dateRange.from ? filter.dateRange.from : "awal";
    const to = filter.dateRange.to ? filter.dateRange.to : "akhir";
    parts.push(`rentang tanggal: ${from} s.d. ${to}`);
  }
  if (filter.categories.length > 0) parts.push(`kategori: ${filter.categories.join(", ")}`);
  if (filter.departments.length > 0) parts.push(`departemen: ${filter.departments.join(", ")}`);
  if (filter.channels.length > 0) parts.push(`kanal: ${filter.channels.join(", ")}`);
  return parts.length > 0 ? parts.join(" | ") : "Semua";
}

/** Ekspor CSV data mentah (M6.1): datar, nilai IDR asli agar aman diunggah ulang ke FinBoard. */
function exportRawCsv(txs: NormalizedTransaction[]): void {
  const today = new Date();
  const sep = ";";
  const eol = "\r\n";
  const lines: string[] = [];
  lines.push("sep=;");
  lines.push(["Tanggal", "Kategori", "Departemen", "Kanal Penjualan", "Revenue", "Expenses", "Profit", "Budget"].join(sep));
  txs.forEach((t) => {
    lines.push(
      [
        t.date,
        t.category,
        t.department,
        t.channel,
        Math.round(t.revenue),
        Math.round(t.expenses),
        Math.round(t.profit),
        t.budget === null ? "" : Math.round(t.budget),
      ]
        .map(csvEscape)
        .join(sep),
    );
  });
  const content = "\uFEFF" + lines.join(eol);
  downloadTextFile(content, `finboard-data-${format(today, "yyyy-MM-dd")}.csv`, "text/csv;charset=utf-8;");
}

/** Input kurs IDR→USD (opsi 1). USD = IDR / kurs; tersimpan di localStorage via store. */
function ExchangeRateInput() {
  const { exchangeRate, setExchangeRate } = useFinBoardStore();
  const [draft, setDraft] = useState(String(exchangeRate));

  // Sinkronkan draft bila kurs diubah dari tempat lain (mis. reset).
  useEffect(() => {
    setDraft(String(exchangeRate));
  }, [exchangeRate]);

  const commit = () => {
    const n = parseFloat(draft.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n > 0) {
      setExchangeRate(n);
    } else {
      setDraft(String(exchangeRate)); // kembalikan ke nilai valid
    }
  };

  return (
    <label
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
      title="Kurs IDR→USD. Nominal USD dihitung = IDR ÷ kurs."
    >
      <span className="whitespace-nowrap">Kurs 1$ =</span>
      <span className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-muted-foreground">Rp</span>
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label="Kurs IDR ke USD"
          className="h-7 w-24 rounded-md border border-surface-border bg-background pl-7 pr-2 text-right text-xs tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </span>
    </label>
  );
}

export default function DashboardHeader({ onOpenMapping }: { onOpenMapping: () => void }) {
  const router = useRouter();
  const { dataset, filter, clearSession, currency, setCurrency, exchangeRate, resetFilter } =
    useFinBoardStore();
  const [helpOpen, setHelpOpen] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const filteredTxs = useMemo(() => {
    if (!dataset) return [];
    return applyFilter(dataset.transactions, filter);
  }, [dataset, filter]);

  // Data agregat untuk ekspor Excel (Gemini: upgrade ekspor .xlsx)
  const monthly = useMemo(() => aggregateMonthly(filteredTxs), [filteredTxs]);
  const hasBudget = useMemo(
    () => filteredTxs.some((t) => t.budget !== null),
    [filteredTxs],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Abaikan jika ada modifier — jangan ganggu shortcut OS/browser (Cmd+R, Ctrl+R, dll).
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if (event.key === "/") {
        event.preventDefault();
        const el = document.getElementById("transaction-search");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          (el as HTMLInputElement).focus();
        }
        return;
      }
      if (event.key === "r" || event.key === "R") {
        const hasActiveFilter =
          filter.categories.length > 0 ||
          filter.departments.length > 0 ||
          filter.channels.length > 0 ||
          filter.dateRange.from !== null ||
          filter.dateRange.to !== null;
        if (hasActiveFilter) {
          resetFilter();
          toast.success("Filter direset");
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filter, resetFilter]);

  if (!dataset) return null;

  const filterDesc = describeFilter(filter);

  const handleCopy = async () => {
    try {
      await copySummary(filteredTxs, dataset.fileName, currency, exchangeRate);
      toast.success("Ringkasan disalin ke clipboard", {
        description: "Angka KPI + poin insight siap ditempel ke laporan.",
      });
    } catch {
      toast.error("Gagal menyalin ringkasan", {
        description: "Browser mungkin memblokir akses clipboard.",
      });
    }
  };

  const handleExportExcel = async () => {
    if (filteredTxs.length === 0) {
      toast.info("Tidak ada transaksi terfilter untuk diekspor.");
      return;
    }
    setExportingExcel(true);
    try {
      await exportExcel({
        txs: filteredTxs,
        monthly,
        fileName: dataset.fileName,
        currency,
        exchangeRate,
        filterDesc,
        hasBudget,
      });
      toast.success("Laporan Excel (.xlsx) diunduh", {
        description: `${filteredTxs.length} transaksi · ${monthly.length} bulan (2 worksheet).`,
      });
    } catch (err) {
      console.error("Gagal ekspor Excel:", err);
      toast.error("Gagal membuat file Excel", {
        description: err instanceof Error ? err.message : "Terjadi kesalahan tak terduga.",
      });
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportRaw = () => {
    if (filteredTxs.length === 0) {
      toast.info("Tidak ada transaksi terfilter untuk diekspor.");
      return;
    }
    exportRawCsv(filteredTxs);
    toast.success("Data mentah CSV diunduh", {
      description: `${filteredTxs.length} transaksi siap diunggah ulang.`,
    });
  };

  return (
    <header className="border-b border-surface-border bg-white/95 backdrop-blur">
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

        {/* Popover Kesehatan Data & Pemetaan (M2.4): ringkasan kualitas + pemetaan aktif. */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Lihat ringkasan kesehatan data & pemetaan kolom aktif."
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-surface-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-slate-50"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              <span className="hidden sm:inline">Kesehatan Data</span>
              {(dataset.invalidDateRows > 0 || dataset.cleanedNumericCells > 0) && (
                <span
                  className="flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-700"
                  aria-label={`${dataset.invalidDateRows} baris tanggal tidak valid, ${dataset.cleanedNumericCells} sel angka dinormalisasi`}
                >
                  {dataset.invalidDateRows > 0 && (
                    <span>{dataset.invalidDateRows} tgl</span>
                  )}
                  {dataset.cleanedNumericCells > 0 && (
                    <span>{dataset.cleanedNumericCells} sel</span>
                  )}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            <p className="mb-2 text-sm font-semibold text-foreground">Kesehatan Data &amp; Pemetaan</p>
            <dl className="mb-3 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Total baris valid</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  {dataset.transactions.length}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Baris tanggal tak valid (dilewati)</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  {dataset.invalidDateRows}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Sel angka kosong → 0</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  {dataset.cleanedNumericCells}
                </dd>
              </div>
            </dl>
            <p className="mb-1.5 border-t border-surface-border pt-2 text-xs font-semibold text-foreground">
              Pemetaan Kolom Aktif
            </p>
            <ul className="space-y-1 text-xs">
              {FIELD_ORDER.map((f) => (
                <li key={f} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{FIELD_LABELS_ID[f]}</span>
                  <span className="truncate font-medium text-foreground" title={dataset.mapping[f] ?? undefined}>
                    → {dataset.mapping[f] ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex items-center gap-2">
          {/* Toggle mata uang + input kurs (B4). USD = konversi IDR via kurs manual. */}
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
          {/* Input kurs IDR→USD (opsi 1): hanya muncul saat mode USD aktif.
              Nominal USD = IDR / kurs; tanpa API, client-side penuh. */}
          {currency === "USD" && <ExchangeRateInput />}
          {/* Menu Ekspor: Salin Ringkasan + Cetak PDF + Ekspor Excel (.xlsx) + Data Mentah CSV. */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex items-center gap-1.5">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Ekspor</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-1.5">
              <button
                onClick={handleCopy}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <ClipboardCopy className="h-4 w-4 text-muted-foreground" />
                Salin Ringkasan
              </button>
              <button
                onClick={() => window.print()}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <Printer className="h-4 w-4 text-muted-foreground" />
                Cetak PDF
              </button>
              <button
                onClick={handleExportExcel}
                disabled={exportingExcel}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                {exportingExcel ? "Menyiapkan Excel..." : "Ekspor Excel (.xlsx) - Laporan Rapi"}
              </button>
              <button
                onClick={handleExportRaw}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                Ekspor CSV (Data Mentah)
              </button>
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={onOpenMapping} className="flex items-center gap-1.5">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Atur Kolom</span>
          </Button>
          {/* Panduan & Pintasan (M6.3). */}
          <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Panduan singkat & pintasan keyboard"
                title="Panduan singkat & pintasan keyboard"
                className="h-9 w-9 p-0"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  Panduan Singkat &amp; Pintasan
                </DialogTitle>
                <DialogDescription>
                  Ringkasan fitur utama FinBoard dan pintasan keyboard yang tersedia.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Fitur Utama
                  </p>
                  <ul className="space-y-1.5 text-sm text-foreground">
                    <li className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>Klik batang/donat chart untuk memfilter data sesuai kategori terpilih.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>Tempel data langsung dari Excel/Sheets ke kolom input (copy-paste massal).</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>Simulator What-If: ubah asumsi (margin, biaya, dsb.) dan lihat dampaknya langsung.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>Matriks P&amp;L: bandingkan performa Revenue, Expenses &amp; Profit antar bulan.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>Drill-down anomali: klik kartu di panel Deteksi Anomali untuk melihat transaksinya di tabel.</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Keyboard className="h-3.5 w-3.5" />
                    Pintasan Keyboard
                  </p>
                  <ul className="space-y-1.5 text-sm text-foreground">
                    <li className="flex items-center gap-2">
                      <kbd className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded border border-surface-border bg-slate-50 px-1.5 font-mono text-xs font-semibold text-foreground">
                        /
                      </kbd>
                      <span>Fokus ke pencarian tabel transaksi.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <kbd className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded border border-surface-border bg-slate-50 px-1.5 font-mono text-xs font-semibold text-foreground">
                        R
                      </kbd>
                      <span>Reset semua filter aktif (chart, tanggal, dimensi).</span>
                    </li>
                  </ul>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
