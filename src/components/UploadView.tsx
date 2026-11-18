"use client";

/**
 * Halaman Upload / Empty State (PRD US-01, US-02, §8.3).
 * Skeleton muncul saat parsing file besar (>150ms) sesuai PRD §8.3 butir 2.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BarChart3, Sparkles, Download, ShieldCheck, Zap, PieChart, ClipboardPaste, UploadCloud, Sparkle } from "lucide-react";
import CsvDropzone from "@/components/CsvDropzone";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { Button } from "@/components/ui/button";
import { useFinBoardStore } from "@/store/finBoardStore";
import { setRawCsv } from "@/lib/sessionCsv";
import { generateDemoCsv, DEMO_SCENARIOS, type DemoScenarioId } from "@/lib/demoDataset";
import { parseCsv } from "@/lib/csvParser";
import { isMappingSufficient } from "@/lib/columnMapper";
import type { ParsedDataset } from "@/lib/types";

const SKELETON_MIN_MS = 150;

const HIGHLIGHTS = [
  {
    icon: Zap,
    title: "Instan & Private",
    text: "Seluruh pemrosesan terjadi di browser — data keuanganmu tidak pernah dikirim ke server mana pun.",
  },
  {
    icon: PieChart,
    title: "5 Grafik Interaktif",
    text: "Tren bulanan, realisasi vs anggaran, profit per kategori/departemen/kanal, lengkap dengan tooltip.",
  },
  {
    icon: ShieldCheck,
    title: "Insight Otomatis",
    text: "Temukan kontributor revenue terbesar, segmen defisit, dan anomali tanpa perlu rumus Excel.",
  },
];

export default function UploadView() {
  const router = useRouter();
  const { setDataset, setNeedsManualMapping } = useFinBoardStore();
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<DemoScenarioId>("saas");
  const [inputMode, setInputMode] = useState<"upload" | "paste">("upload");
  const [pasteText, setPasteText] = useState("");

  const scenario = DEMO_SCENARIOS.find((s) => s.id === selectedScenario) ?? DEMO_SCENARIOS[0];

  const loadDemo = async () => {
    const start = Date.now();
    setShowSkeleton(true);

    const csv = generateDemoCsv(scenario.id);
    const ds = parseCsv(csv, scenario.fileName);

    // Minimum delay agar skeleton terlihat (PRD §8.3: proses >150ms)
    const elapsed = Date.now() - start;
    if (elapsed < SKELETON_MIN_MS) {
      await new Promise((resolve) => setTimeout(resolve, SKELETON_MIN_MS - elapsed));
    }

    setRawCsv(csv, ds.fileName);
    setDataset(ds);
    router.push("/dashboard");
  };

  const handleAnalyzePaste = async () => {
    const text = pasteText.trim();
    if (!text) {
      toast.error("Data kosong");
      return;
    }

    const start = Date.now();
    setShowSkeleton(true);

    try {
      setRawCsv(text, "Tempelan Excel.csv");
      // Papa.parse auto-detect delimiter (\t / ';' / ','), jadi teks dari Excel/Sheets
      // yang dicopy langsung (biasanya tab-delimited) terbaca tanpa preprocessing.
      let ds: ParsedDataset;
      let needsMapping = false;
      try {
        ds = parseCsv(text, "Tempelan Excel.csv");
        needsMapping = !isMappingSufficient(ds.mapping);
      } catch {
        ds = parseCsv(text, "Tempelan Excel.csv", { allowPartial: true });
        needsMapping = true;
      }

      const elapsed = Date.now() - start;
      if (elapsed < SKELETON_MIN_MS) {
        await new Promise((resolve) => setTimeout(resolve, SKELETON_MIN_MS - elapsed));
      }

      setDataset(ds);
      if (needsMapping) {
        setNeedsManualMapping(true);
        toast.info("Beberapa kolom perlu dipetakan manual", {
          description: "Silakan sesuaikan pemetaan kolom di dashboard.",
        });
      } else {
        toast.success("Data berhasil diproses", {
          description: `${ds.transactions.length} baris transaksi siap dianalisis.`,
        });
      }
      router.push("/dashboard");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal memproses data tempelan.";
      toast.error("Gagal memproses data", { description: msg });
      setShowSkeleton(false);
    }
  };

  const downloadSampleCsv = () => {
    // Unduh CSV contoh kecil (10 baris, 8 kolom) agar pengunjung bisa mengetes fitur upload.
    // BOM + directive `sep=;` + delimiter ';' agar Excel membuka file tanpa wizard import.
    const header = "Tanggal;Revenue;Expenses;Profit;Kategori;Departemen;Channel;Budget\n";
    const rows = [
      "2026-01-05;25000000;18000000;7000000;Langganan SaaS;Sales & Marketing;B2B Direct;25000000",
      "2026-01-12;40000000;26000000;14000000;Technology;Engineering & Product;B2B Direct;40000000",
      "2026-01-18;12000000;9000000;3000000;Layanan Konsultasi;Operations;Marketplace;13000000",
      "2026-02-03;30000000;21000000;9000000;Produk Fisik;Operations;Kemitraan;28000000",
      "2026-02-11;15000000;11000000;4000000;Langganan SaaS;Customer Success;Marketplace;15000000",
      "2026-02-20;55000000;35000000;20000000;Technology;Engineering & Product;B2B Direct;52000000",
      "2026-03-02;20000000;15500000;4500000;Layanan Konsultasi;Sales & Marketing;Kemitraan;20000000",
      "2026-03-09;35000000;24000000;11000000;Produk Fisik;Operations;Marketplace;35000000",
      "2026-03-15;8000000;8500000;-500000;Langganan SaaS;Customer Success;B2B Direct;9000000",
      "2026-03-22;45000000;30000000;15000000;Technology;Engineering & Product;B2B Direct;44000000",
    ].join("\n");
    const blob = new Blob(["\uFEFF" + "sep=;\n" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contoh-transaksi.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleParsingStart = () => {
    setShowSkeleton(true);
  };

  const handleParsingError = () => {
    setShowSkeleton(false);
  };

  if (showSkeleton) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-white shadow-card">
            <BarChart3 className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Dashboard Keuangan dari CSV
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Ubah file transaksi mentah menjadi dashboard eksekutif lengkap — KPI, grafik, insight,
            dan tabel — dalam hitungan detik. Tanpa server, tanpa rumus Excel.
          </p>
        </div>

        {/* Tab switcher: Upload File / Tempel dari Excel */}
        <div className="mb-4 flex w-full rounded-xl border border-surface-border bg-surface p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setInputMode("upload")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
              inputMode === "upload"
                ? "bg-white text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UploadCloud className="h-4 w-4" />
            Upload File CSV
          </button>
          <button
            type="button"
            onClick={() => setInputMode("paste")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
              inputMode === "paste"
                ? "bg-white text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ClipboardPaste className="h-4 w-4" />
            Tempel dari Excel / CSV
          </button>
        </div>

        {inputMode === "upload" ? (
          <CsvDropzone onParsed={() => router.push("/dashboard")} onParsingStart={handleParsingStart} onParsingError={handleParsingError} />
        ) : (
          <div className="rounded-xl border border-surface-border bg-white p-4 shadow-card">
            <div className="mb-2 flex items-center gap-2">
              <ClipboardPaste className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Tempel tabel dari Excel / Google Sheets</p>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Salin sel di Excel/Sheets (Ctrl/⌘+C) lalu tempel di bawah (Ctrl/⌘+V). Pemisah tab, titik-koma, dan koma didukung.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"Tanggal\tRevenue\tExpenses\tProfit\tKategori\tDepartemen\tChannel\tBudget\n2026-01-05\t25000000\t18000000\t7000000\tLangganan SaaS\tSales & Marketing\tB2B Direct\t25000000\n..."}
              className="w-full min-h-[200px] rounded-lg border border-surface-border bg-surface/40 p-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {pasteText.trim() ? `${pasteText.trim().split(/\r?\n/).length} baris terdeteksi` : "Belum ada data"}
              </p>
              <Button onClick={handleAnalyzePaste} disabled={!pasteText.trim()} className="gap-2">
                <Sparkle className="h-4 w-4" />
                Analisis Data
              </Button>
            </div>
          </div>
        )}

        {/* Badge kolom yang dikenali otomatis (UI Bagian 6) */}
        <div className="mt-4">
          <p className="mb-2 text-center text-xs text-muted-foreground">
            Kolom yang dikenali otomatis:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {["Tanggal", "Revenue", "Expenses", "Profit", "Kategori", "Departemen", "Channel", "Budget"].map(
              (c) => (
                <span
                  key={c}
                  className="rounded-full border border-surface-border bg-white px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                >
                  {c}
                </span>
              ),
            )}
          </div>
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-surface-border" />
          <span className="text-xs text-muted-foreground">atau</span>
          <div className="h-px flex-1 bg-surface-border" />
        </div>

        {/* Pilihan skenario demo */}
        <div className="mb-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Pilih skenario demo:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {DEMO_SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedScenario(s.id)}
                title={s.description}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                  selectedScenario === s.id
                    ? "border-primary bg-blue-50/60 text-foreground"
                    : "border-surface-border bg-white text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <span className="block font-medium">{s.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-1">
                  {s.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="outline"
          onClick={loadDemo}
          className="w-full gap-2 border-primary/30 bg-blue-50/60 text-primary shadow-card hover:border-primary/60 hover:bg-blue-50"
        >
          <Sparkles className="h-4 w-4" />
          Coba dengan Dataset Demo (360 transaksi)
        </Button>

        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={downloadSampleCsv}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Unduh Contoh CSV
          </button>
        </div>

        {/* 3 Highlight fitur (B5) */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {HIGHLIGHTS.map((h) => {
            const Icon = h.icon;
            return (
              <div
                key={h.title}
                className="rounded-xl border border-surface-border bg-white p-4 shadow-card"
              >
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-foreground">{h.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{h.text}</p>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Data Anda tidak pernah dikirim ke server mana pun — seluruh pemrosesan terjadi di browser.
        </p>
      </div>
    </div>
  );
}
