"use client";

/**
 * Halaman Upload / Empty State (PRD US-01, US-02, §8.3).
 * Skeleton muncul saat parsing file besar (>150ms) sesuai PRD §8.3 butir 2.
 *
 * Dashboard di-lazy-load otomatis via route-level split Next.js App Router
 * (masing-masing halaman = chunk terpisah), sehingga landing page tidak
 * mentrucking bundle Recharts — menekan TBT demi skor Lighthouse §12.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Sparkles } from "lucide-react";
import CsvDropzone from "@/components/CsvDropzone";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { Button } from "@/components/ui/button";
import { useFinBoardStore } from "@/store/finBoardStore";
import { setRawCsv } from "@/lib/sessionCsv";
import { generateDemoCsv } from "@/lib/demoDataset";
import { parseCsv } from "@/lib/csvParser";

const SKELETON_MIN_MS = 150;

export default function UploadView() {
  const router = useRouter();
  const { setDataset } = useFinBoardStore();
  const [showSkeleton, setShowSkeleton] = useState(false);

  const loadDemo = async () => {
    const start = Date.now();
    setShowSkeleton(true);

    const csv = generateDemoCsv();
    const ds = parseCsv(csv, "Dataset Demo — PT Nusantara Digital.csv");

    // Minimum delay agar skeleton terlihat (PRD §8.3: proses >150ms)
    const elapsed = Date.now() - start;
    if (elapsed < SKELETON_MIN_MS) {
      await new Promise((resolve) => setTimeout(resolve, SKELETON_MIN_MS - elapsed));
    }

    setRawCsv(csv, ds.fileName);
    setDataset(ds);
    router.push("/dashboard");
  };

  const handleParsingStart = () => {
    // Tampilkan skeleton selama parsing file CSV berlangsung (PRD §8.3 butir 2).
    setShowSkeleton(true);
  };

  const handleParsingError = () => {
    // Parsing gagal → kembalikan ke layar upload (PRD §8.3 error state).
    setShowSkeleton(false);
  };

  // Tampilkan skeleton saat parsing berlangsung
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

        <CsvDropzone onParsed={() => router.push("/dashboard")} onParsingStart={handleParsingStart} onParsingError={handleParsingError} />

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-surface-border" />
          <span className="text-xs text-muted-foreground">atau</span>
          <div className="h-px flex-1 bg-surface-border" />
        </div>

        <Button
          variant="outline"
          onClick={loadDemo}
          className="w-full gap-2 border-primary/30 bg-blue-50/60 text-primary shadow-card hover:border-primary/60 hover:bg-blue-50"
        >
          <Sparkles className="h-4 w-4" />
          Coba dengan Dataset Demo (360 transaksi)
        </Button>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Data Anda tidak pernah dikirim ke server mana pun — seluruh pemrosesan terjadi di browser.
        </p>
      </div>
    </div>
  );
}
