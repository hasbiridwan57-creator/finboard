"use client";

/**
 * DashboardSkeleton — skeleton loader sesuai PRD §8.3 butir 2.
 * Muncul saat parsing CSV besar (>150ms) sebelum dashboard tampil penuh.
 */
export function KpiCardSkeleton() {
  return (
    <div className="rounded-xl border border-surface-border bg-white p-5 shadow-card animate-pulse">
      <div className="h-3 w-24 bg-surface-border rounded animate-pulse" />
      <div className="mt-4 h-7 w-32 bg-surface-border rounded animate-pulse" />
      <div className="mt-3 h-3 w-20 bg-surface-border rounded animate-pulse" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-surface-border bg-white p-5 shadow-card">
      <div className="mb-4 h-3 w-40 bg-surface-border rounded animate-pulse" />
      <div className="h-[280px] flex items-end gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-surface-border rounded-t animate-pulse"
            style={{ height: `${30 + Math.sin(i * 0.5) * 40 + Math.random() * 20}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>

      {/* Chart Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* Chart Row 2 */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ChartSkeleton />
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}
