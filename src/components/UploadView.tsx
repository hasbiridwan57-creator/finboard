"use client";

/**
 * Halaman Upload / Empty State (PRD US-01, US-02, §8.3).
 * Skeleton muncul saat parsing file besar (>150ms) sesuai PRD §8.3 butir 2.
 *
 * Dashboard & modal di-lazy-load (dynamic import) agar landing page tidak
 * mentrucking bundle Recharts — menekan TBT demi skor Lighthouse §12.
 */
import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart3, Sparkles } from "lucide-react";
import CsvDropzone from "@/components/CsvDropzone";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { useFinBoardStore } from "@/store/finBoardStore";
import { setRawCsv } from "@/lib/sessionCsv";
import { generateDemoCsv } from "@/lib/demoDataset";
import { parseCsv } from "@/lib/csvParser";

// Lazy-load komponen berat: hanya dimuat saat benar-benar dibutuhkan.
const ManualMappingModal = dynamic(
  () => import("@/components/ManualMappingModal").then((m) => m.default),
  { ssr: false }
);

const SKELETON_MIN_MS = 150;

export default function UploadView() {
  const router = useRouter();
  const { dataset, needsManualMapping, setDataset } = useFinBoardStore();
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

        <button
          onClick={loadDemo}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-surface-border bg-white px-4 py-3 text-sm font-semibold text-foreground shadow-card transition-colors hover:border-primary/50 hover:text-primary cursor-pointer"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          Coba dengan Dataset Demo (360 transaksi)
        </button>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Data Anda tidak pernah dikirim ke server mana pun.{" "}
          <Link href="/dashboard" className="text-primary underline underline-offset-2 hover:text-primary-hover">
            Pelajari cara kerjanya
          </Link>
        </p>
      </div>

      {needsManualMapping && dataset && (
        <ManualMappingModal
          open
          headers={dataset.headers}
          initialMapping={dataset.mapping}
          onClose={() => useFinBoardStore.getState().setNeedsManualMapping(false)}
        />
      )}
    </div>
  );
}
