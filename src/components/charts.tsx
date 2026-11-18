"use client";

/** Kumpulan 5 chart interaktif (PRD FR-CHR) + granularitas & switcher metrik (UI Bagian 5). */
import { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { MonthlyPoint, DimensionMetricPoint, Granularity } from "@/lib/chartAggregator";
import { useFinBoardStore } from "@/store/finBoardStore";
import ChartTooltip from "./ChartTooltip";

const CHART_COLORS = ["#2563eb", "#0ea5e9", "#16a34a", "#f59e0b", "#6366f1"];

/** Buat formatter Y-axis ringkas sesuai mode mata uang (buang prefiks simbol). */
function makeYAxisFormatter(mode: "IDR" | "USD") {
  return (value: number): string =>
    formatCurrency(value, mode).replace(/^(Rp |\$)\s?/, "");
}

/** Hook kecil agar chart ikut mode mata uang global. */
function useCurrency() {
  const { currency } = useFinBoardStore();
  return currency;
}

function EmptyChart({ msg }: { msg: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
      {msg}
    </div>
  );
}

/** Toggle kecil (segmen) dipakai granularitas & switcher metrik (UI Bagian 5). */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-surface-border bg-background p-0.5"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
            value === o.value
              ? "bg-surface text-foreground shadow-card"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Header kartu chart dengan kontrol di kanan judul (UI Bagian 5). */
function ChartCardHeader({
  title,
  badge,
  control,
}: {
  title: string;
  badge?: React.ReactNode;
  control?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {badge}
      </div>
      {control}
    </div>
  );
}

function ChartCard({
  title,
  note,
  control,
  badge,
  children,
}: {
  title: string;
  note?: React.ReactNode;
  control?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-white p-5 shadow-card">
      <ChartCardHeader title={title} badge={badge} control={control} />
      {children}
      {note != null && <div className="mt-3">{note}</div>}
    </div>
  );
}

/** Catatan kecil: klik batang memfilter dimensi terkait (B3). */
function FilterHint({ active }: { active: string[] }) {
  if (active.length === 0) {
    return <p className="text-xs text-muted-foreground">Klik batang untuk memfilter dashboard.</p>;
  }
  return (
    <p className="text-xs text-muted-foreground">
      Filter aktif: {active.join(", ")} — klik lagi untuk melepas.
    </p>
  );
}

/** 1. Tren Revenue vs Expenses vs Profit + granularitas (Area) — PRD FR-CHR-1 + UI Bagian 5 */
export function RevenueExpenseChart({
  daily,
  weekly,
  monthly,
  defaultGranularity = "monthly",
}: {
  daily: MonthlyPoint[];
  weekly: MonthlyPoint[];
  monthly: MonthlyPoint[];
  defaultGranularity?: Granularity;
}) {
  const currency = useCurrency();
  const [gran, setGran] = useState<Granularity>(defaultGranularity);
  useEffect(() => {
    setGran(defaultGranularity);
  }, [defaultGranularity]);
  const data = gran === "daily" ? daily : gran === "weekly" ? weekly : monthly;

  const control = (
    <Segmented<Granularity>
      options={[
        { value: "daily", label: "Harian" },
        { value: "weekly", label: "Mingguan" },
        { value: "monthly", label: "Bulanan" },
      ]}
      value={gran}
      onChange={setGran}
      ariaLabel="Granularitas tren"
    />
  );

  if (data.length === 0)
    return (
      <ChartCard title="Tren Revenue vs Expenses" control={control}>
        <EmptyChart msg="Tidak ada data." />
      </ChartCard>
    );

  return (
    <ChartCard title="Tren Revenue vs Expenses" control={control}>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dc2626" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#dc2626" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={makeYAxisFormatter(currency)} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={85} />
          <Tooltip content={<ChartTooltip valueFormatter={(v) => formatCurrency(v, currency)} />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" strokeWidth={2} fill="url(#revGrad)" />
          <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#dc2626" strokeWidth={2} fill="url(#expGrad)" />
          {/* Garis ketiga hijau: Profit (UI Bagian 5) */}
          <Line type="monotone" dataKey="profit" name="Profit" stroke="#16a34a" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** 2. Revenue vs Budget (kondisional) — PRD FR-CHR-2 */
export function RevenueBudgetChart({ data }: { data: MonthlyPoint[] }) {
  const currency = useCurrency();
  const withBudget = data.filter((d) => d.budget !== null && d.budget > 0);
  if (withBudget.length === 0) return null;

  /** Tooltip khusus: revenue, budget, dan selisih % aktual-vs-anggaran (A4). */
  const VarianceTooltip = (props: {
    active?: boolean;
    payload?: { value?: number; name?: string | number; color?: string; fill?: string }[];
    label?: string | number;
  }) => {
    const { active: on, payload, label } = props;
    if (!on || !payload || payload.length === 0) return null;
    const rev = payload.find((p) => p.name === "Revenue Aktual")?.value ?? 0;
    const bud = payload.find((p) => p.name === "Budget")?.value ?? 0;
    const variance = bud !== 0 ? ((rev - bud) / bud) * 100 : null;
    return (
      <div className="rounded-lg border border-surface-border bg-white px-3 py-2 shadow-lg">
        <p className="mb-1.5 text-xs font-semibold text-foreground">{label}</p>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#2563eb" }} />
            <span className="text-muted-foreground">Revenue Aktual</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground">
              {formatCurrency(rev, currency)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#94a3b8" }} />
            <span className="text-muted-foreground">Budget</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground">
              {formatCurrency(bud, currency)}
            </span>
          </div>
          {variance !== null && (
            <div className="mt-1 flex items-center justify-between border-t border-surface-border pt-1">
              <span className="text-muted-foreground">Variance</span>
              <span className={`font-semibold tabular-nums ${variance >= 0 ? "text-success" : "text-danger"}`}>
                {variance >= 0 ? "+" : ""}
                {formatPercent(variance)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <ChartCard title="Realisasi Revenue vs Budget">
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={withBudget} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={makeYAxisFormatter(currency)} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={85} />
          <Tooltip content={<VarianceTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="revenue" name="Revenue Aktual" fill="#2563eb" radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="budget" name="Budget" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Switcher metrik Profit/Revenue + nilai dari titik (UI Bagian 5). */
function useMetricSwitch() {
  const [metric, setMetric] = useState<"profit" | "revenue">("profit");
  const control = (
    <Segmented<"profit" | "revenue">
      options={[
        { value: "profit", label: "Profit" },
        { value: "revenue", label: "Revenue" },
      ]}
      value={metric}
      onChange={setMetric}
      ariaLabel="Pilih metrik"
    />
  );
  return { metric, control, pick: (d: DimensionMetricPoint) => d[metric], metricName: metric === "profit" ? "Profit" : "Revenue" };
}

/** 3. Kategori (Vertical Bar + Donut jika >6) + switcher metrik — PRD FR-CHR-3 + UI Bagian 5 */
export function CategoryProfitChart({ data }: { data: DimensionMetricPoint[] }) {
  const [chartType, setChartType] = useState<"bar" | "donut">("bar");
  const currency = useCurrency();
  const { filter, setFilter } = useFinBoardStore();
  const active = filter.categories;
  const { control, pick, metricName } = useMetricSwitch();

  const sorted = useMemo(() => [...data].sort((a, b) => pick(b) - pick(a)), [data, pick]);
  const showDonut = data.length > 6;
  // Mode Donut: hanya item value > 0, agar persentase tidak terdistorsi nilai ≤ 0.
  const donutData = sorted.filter((d) => pick(d) > 0);
  const donutTotal = donutData.reduce((s, d) => s + pick(d), 0);
  const hiddenDeficit = sorted.filter((d) => pick(d) <= 0);

  /** Toggle kategori aktif saat batang/kupon diklik (B3). */
  const toggle = (name: string) => {
    const next = active.includes(name)
      ? active.filter((c) => c !== name)
      : [...active, name];
    setFilter({ categories: next });
  };

  // Bentuk data sesuai metrik aktif (sudah terurut menurun).
  const chartData = sorted.map((d) => ({ name: d.name, value: pick(d) }));
  const donutChartData = donutData.map((d) => ({ name: d.name, value: pick(d) }));

  if (data.length === 0) return <ChartCard title="Per Kategori" control={control}><EmptyChart msg="Kolom kategori tidak tersedia." /></ChartCard>;

  const typeControl = showDonut ? (
    <Segmented<"bar" | "donut">
      options={[
        { value: "bar", label: "Bar" },
        { value: "donut", label: "Donut" },
      ]}
      value={chartType}
      onChange={setChartType}
      ariaLabel="Jenis chart kategori"
    />
  ) : undefined;

  const deficitBadge =
    chartType === "donut" && showDonut && hiddenDeficit.length > 0 ? (
      <span
        title={`Kategori ${metricName} ≤ 0 (tak tampil di donut): ${hiddenDeficit.map((d) => d.name).join(", ")}`}
        className="rounded-full border border-danger-border bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger"
      >
        {hiddenDeficit.length} kategori defisit disembunyikan
      </span>
    ) : undefined;

  return (
    <ChartCard
      title={`Per Kategori — ${metricName}`}
      badge={deficitBadge}
      note={<FilterHint active={active} />}
      control={
        <div className="flex flex-wrap items-center gap-2">
          {typeControl}
          {control}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={280}>
        {chartType === "donut" && showDonut ? (
          <PieChart>
            <Pie
              data={donutChartData}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              onClick={(entry: { name?: string }) => entry?.name && toggle(entry.name)}
              style={{ cursor: "pointer" }}
            >
              {donutChartData.map((d, i) => (
                <Cell key={i} fill={d.value >= 0 ? CHART_COLORS[i % CHART_COLORS.length] : "#dc2626"} opacity={active.length === 0 || active.includes(d.name) ? 1 : 0.35} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip valueFormatter={(v) => `${formatCurrency(v, currency)} (${formatPercent((v / donutTotal) * 100)})`} />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        ) : (
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 45 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={50}
            />
            <YAxis tickFormatter={makeYAxisFormatter(currency)} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={85} />
            <Tooltip content={<ChartTooltip valueFormatter={(v) => formatCurrency(v, currency)} />} cursor={{ fill: "#f1f5f9" }} />
            <Bar
              dataKey="value"
              name={metricName}
              radius={[4, 4, 0, 0]}
              onClick={(entry: { name?: string }) => entry?.name && toggle(entry.name)}
              style={{ cursor: "pointer" }}
            >
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.value >= 0 ? "#2563eb" : "#dc2626"} opacity={active.length === 0 || active.includes(d.name) ? 1 : 0.35} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** 4. Departemen (Horizontal Bar) + switcher metrik — PRD FR-CHR-4 + UI Bagian 5 */
export function DepartmentProfitChart({ data }: { data: DimensionMetricPoint[] }) {
  const currency = useCurrency();
  const { filter, setFilter } = useFinBoardStore();
  const active = filter.departments;
  const { control, pick, metricName } = useMetricSwitch();

  const toggle = (name: string) => {
    const next = active.includes(name)
      ? active.filter((c) => c !== name)
      : [...active, name];
    setFilter({ departments: next });
  };

  const sorted = useMemo(() => [...data].sort((a, b) => pick(b) - pick(a)), [data, pick]);
  const chartData = sorted.map((d) => ({ name: d.name, value: pick(d) }));

  if (data.length === 0) return <ChartCard title="Per Departemen" control={control}><EmptyChart msg="Kolom departemen tidak tersedia." /></ChartCard>;
  return (
    <ChartCard title={`Per Departemen — ${metricName}`} note={<FilterHint active={active} />} control={control}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" tickFormatter={makeYAxisFormatter(currency)} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={170} />
          <Tooltip content={<ChartTooltip valueFormatter={(v) => formatCurrency(v, currency)} />} cursor={{ fill: "#f1f5f9" }} />
          <Bar
            dataKey="value"
            name={metricName}
            radius={[0, 4, 4, 0]}
            barSize={20}
            onClick={(entry: { name?: string }) => entry?.name && toggle(entry.name)}
            style={{ cursor: "pointer" }}
          >
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.value >= 0 ? "#16a34a" : "#dc2626"} opacity={active.length === 0 || active.includes(d.name) ? 1 : 0.35} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** 5. Kanal (Donut) + switcher metrik + klik-filter + badge kanal rugi (UI Bagian 5) */
export function ChannelProfitChart({ data }: { data: DimensionMetricPoint[] }) {
  const currency = useCurrency();
  const { filter, setFilter } = useFinBoardStore();
  const active = filter.channels;
  const { control, pick, metricName } = useMetricSwitch();

  const toggle = (name: string) => {
    const next = active.includes(name)
      ? active.filter((c) => c !== name)
      : [...active, name];
    setFilter({ channels: next });
  };

  // Badge ringkas kanal rugi di header (UI Bagian 5) — menggantikan catatan panjang di bawah.
  const lossChannels = data.filter((d) => d.profit <= 0);
  const badge =
    lossChannels.length > 0 ? (
      <span
        title={`Kanal profit ≤ 0 (tak tampil di donut): ${lossChannels.map((d) => d.name).join(", ")}`}
        className="rounded-full border border-danger-border bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger"
      >
        {lossChannels.length} kanal rugi
      </span>
    ) : undefined;

  // Donut hanya menampilkan nilai > 0 sesuai metrik aktif.
  const all = data.map((d) => ({ name: d.name, value: pick(d) }));
  const positive = all.filter((d) => d.value > 0);
  const total = positive.reduce((s, d) => s + d.value, 0);

  if (positive.length === 0)
    return <ChartCard title="Per Kanal" control={control}><EmptyChart msg="Kolom kanal tidak tersedia." /></ChartCard>;

  return (
    <ChartCard title={`Per Kanal — ${metricName}`} badge={badge} control={control} note={<FilterHint active={active} />}>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={positive}
            dataKey="value"
            nameKey="name"
            innerRadius="60%"
            outerRadius="85%"
            paddingAngle={2}
            onClick={(entry: { name?: string }) => entry?.name && toggle(entry.name)}
            style={{ cursor: "pointer" }}
          >
            {positive.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} opacity={active.length === 0 || active.includes(positive[i].name) ? 1 : 0.35} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip valueFormatter={(v) => `${formatCurrency(v, currency)} (${formatPercent((v / total) * 100)})`} />} />
          <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground" fontSize={14} fontWeight={700}>
            {formatCurrency(total, currency)}
          </text>
          <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground" fontSize={11}>
            Total {metricName}
          </text>
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
