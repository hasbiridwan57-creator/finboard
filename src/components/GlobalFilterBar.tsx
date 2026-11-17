"use client";

/**
 * GlobalFilterBar (PRD FR-FLT-01 s.d. FR-FLT-04).
 * Date range + preset + 3 multi-select (Kategori, Departemen, Channel) + Reset.
 * Perubahan apa pun → store → seluruh komponen ikut berubah.
 */
import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown, Check, X, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useFinBoardStore } from "@/store/finBoardStore";
import { uniqueValues } from "@/lib/chartAggregator";
import { formatRupiah } from "@/lib/format";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

interface Preset {
  label: string;
  compute: (min: string, max: string) => { from: string; to: string } | null;
}

const PRESETS: Preset[] = [
  { label: "Semua Waktu", compute: (min, max) => ({ from: min, to: max }) },
  {
    label: "30 Hari Terakhir",
    compute: (_min, max) => {
      const d = new Date(max);
      d.setUTCDate(d.getUTCDate() - 29);
      return { from: d.toISOString().slice(0, 10), to: max };
    },
  },
  {
    label: "Kuartal Terakhir",
    compute: (_min, max) => {
      const d = new Date(max);
      d.setUTCMonth(d.getUTCMonth() - 2);
      d.setUTCDate(1);
      return { from: d.toISOString().slice(0, 10), to: max };
    },
  },
  {
    label: "YTD",
    compute: (min, max) => {
      const y = max.slice(0, 4);
      const from = `${y}-01-01`;
      return { from: from < min ? min : from, to: max };
    },
  },
];

function DateRangeControl({ min, max }: { min: string; max: string }) {
  const { filter, setFilter } = useFinBoardStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const from = filter.dateRange.from ?? min;
  const to = filter.dateRange.to ?? max;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-foreground hover:border-primary/50 cursor-pointer"
      >
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="tabular-nums">
          {formatDate(from)} – {formatDate(to)}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-72 rounded-xl border border-surface-border bg-white p-3 shadow-lg">
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => {
              const r = p.compute(min, max);
              const active = r && r.from === from && r.to === to;
              return (
                <button
                  key={p.label}
                  onClick={() => {
                    if (r) setFilter({ dateRange: { from: r.from, to: r.to } });
                    setOpen(false);
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-medium text-left cursor-pointer ${
                    active ? "bg-primary text-white" : "bg-slate-50 text-foreground hover:bg-blue-50"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 space-y-2 border-t border-surface-border pt-3">
            <label className="block text-xs font-medium text-muted-foreground">Dari</label>
            <input
              type="date"
              value={from}
              min={min}
              max={max}
              onChange={(e) => setFilter({ dateRange: { ...filter.dateRange, from: e.target.value } })}
              className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm tabular-nums focus:outline focus:outline-2 focus:outline-primary"
            />
            <label className="block text-xs font-medium text-muted-foreground">Sampai</label>
            <input
              type="date"
              value={to}
              min={min}
              max={max}
              onChange={(e) => setFilter({ dateRange: { ...filter.dateRange, to: e.target.value } })}
              className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm tabular-nums focus:outline focus:outline-2 focus:outline-primary"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MultiSelect({
  label,
  values,
  selected,
  onChange,
}: {
  label: string;
  values: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = values.filter((v) => v.toLowerCase().includes(search.toLowerCase()));
  const allSelected = selected.length === values.length;

  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-foreground hover:border-primary/50 cursor-pointer"
      >
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-medium">
          {selected.length === 0 ? "Semua" : selected.length === 1 ? selected[0] : `${selected.length} dipilih`}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-56 rounded-xl border border-surface-border bg-white shadow-lg">
          <div className="border-b border-surface-border p-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari…"
              className="w-full rounded-lg border border-surface-border px-3 py-1.5 text-sm focus:outline focus:outline-2 focus:outline-primary"
            />
          </div>
          <div className="flex items-center justify-between border-b border-surface-border px-3 py-2 text-xs">
            <button
              onClick={() => onChange(allSelected ? [] : [...values])}
              className="font-medium text-primary hover:underline cursor-pointer"
            >
              {allSelected ? "Hapus Semua" : "Pilih Semua"}
            </button>
            <span className="text-muted-foreground">{values.length} opsi</span>
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.map((v) => {
              const checked = selected.includes(v);
              return (
                <button
                  key={v}
                  onClick={() => toggle(v)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-slate-50 cursor-pointer"
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
                      checked ? "border-primary bg-primary text-white" : "border-surface-border"
                    }`}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  {v}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">Tidak ditemukan</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GlobalFilterBar() {
  const { dataset, filter, setFilter, resetFilter } = useFinBoardStore();
  if (!dataset) return null;

  const txs = dataset.transactions;
  const categories = uniqueValues(txs, "category");
  const departments = uniqueValues(txs, "department");
  const channels = uniqueValues(txs, "channel");

  const dates = txs.map((t) => t.date).sort();
  const min = dates[0];
  const max = dates[dates.length - 1];

  const isFiltered =
    filter.categories.length > 0 ||
    filter.departments.length > 0 ||
    filter.channels.length > 0 ||
    filter.dateRange.from !== null ||
    filter.dateRange.to !== null;

  const activeCount =
    (filter.categories.length > 0 ? 1 : 0) +
    (filter.departments.length > 0 ? 1 : 0) +
    (filter.channels.length > 0 ? 1 : 0);

  return (
    <div className="sticky top-16 z-30 border-b border-surface-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <DateRangeControl min={min} max={max} />
        {categories.length > 0 && (
          <MultiSelect
            label="Kategori"
            values={categories}
            selected={filter.categories}
            onChange={(v) => setFilter({ categories: v })}
          />
        )}
        {departments.length > 1 && (
          <MultiSelect
            label="Departemen"
            values={departments}
            selected={filter.departments}
            onChange={(v) => setFilter({ departments: v })}
          />
        )}
        {channels.length > 1 && (
          <MultiSelect
            label="Kanal"
            values={channels}
            selected={filter.channels}
            onChange={(v) => setFilter({ channels: v })}
          />
        )}
        {isFiltered && (
          <button
            onClick={resetFilter}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-surface-border bg-white px-3 py-2 text-sm font-medium text-danger hover:bg-danger-soft cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Filter
          </button>
        )}
      </div>
    </div>
  );
}
