"use client";

/** Header dashboard (PRD FR-UPL-04) + badge kualitas data, toggle mata uang (B4), ekspor laporan (B2). */
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
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
} from "lucide-react";
import { useFinBoardStore } from "@/store/finBoardStore";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { computeKpi } from "@/lib/kpiCalculator";
import { applyFilter } from "@/lib/chartAggregator";
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
  const { dataset, filter, clearSession, currency, setCurrency, exchangeRate } = useFinBoardStore();
  if (!dataset) return null;

  const filteredTxs = applyFilter(dataset.transactions, filter);

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
          {/* Menu Ekspor: gabungkan Salin Ringkasan + Ekspor CSV + Cetak PDF (UI Bagian 2)
              agar header tetap ringkas 1 baris di tablet & mobile. */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex items-center gap-1.5">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Ekspor</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1.5">
              <button
                onClick={handleCopy}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <ClipboardCopy className="h-4 w-4 text-muted-foreground" />
                Salin Ringkasan
              </button>
              <button
                onClick={handleExport}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                Ekspor CSV
              </button>
              <button
                onClick={() => window.print()}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <Printer className="h-4 w-4 text-muted-foreground" />
                Cetak / Simpan PDF
              </button>
            </PopoverContent>
          </Popover>
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
