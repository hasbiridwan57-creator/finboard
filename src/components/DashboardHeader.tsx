"use client";

/** Header dashboard (PRD FR-UPL-04). */
import { useRouter } from "next/navigation";
import { BarChart3, FileSpreadsheet, RefreshCw, Settings2, Table2 } from "lucide-react";
import { useFinBoardStore } from "@/store/finBoardStore";

export default function DashboardHeader({ onOpenMapping }: { onOpenMapping: () => void }) {
  const router = useRouter();
  const { dataset, clearSession } = useFinBoardStore();
  if (!dataset) return null;

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

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onOpenMapping}
            className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50 cursor-pointer"
          >
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Atur Kolom</span>
          </button>
          <button
            onClick={() => {
              clearSession();
              router.push("/");
            }}
            className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Ganti CSV</span>
          </button>
        </div>
      </div>
    </header>
  );
}
