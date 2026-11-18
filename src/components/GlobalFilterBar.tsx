"use client";

/**
 * GlobalFilterBar (PRD FR-FLT-01 s.d. FR-FLT-04).
 * Date range + preset + 3 multi-select (Kategori, Departemen, Channel) + Reset.
 * Dibangun di atas komponen shadcn/ui: Popover, Command, Checkbox, Button.
 * Perubahan apa pun → store → seluruh komponen ikut berubah.
 */
import { useMemo } from "react";
import { CalendarIcon, Check, ChevronDown, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useFinBoardStore } from "@/store/finBoardStore";
import { uniqueValues } from "@/lib/chartAggregator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  const from = filter.dateRange.from ?? min;
  const to = filter.dateRange.to ?? max;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 tabular-nums"
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          {formatDate(from)} – {formatDate(to)}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3">
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => {
            const r = p.compute(min, max);
            const active = r && r.from === from && r.to === to;
            return (
              <Button
                key={p.label}
                size="sm"
                variant={active ? "default" : "secondary"}
                onClick={() => {
                  if (r) setFilter({ dateRange: { from: r.from, to: r.to } });
                }}
                className="justify-start"
              >
                {p.label}
              </Button>
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
            className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm tabular-nums focus:outline focus:outline-2 focus:outline-ring"
          />
          <label className="block text-xs font-medium text-muted-foreground">Sampai</label>
          <input
            type="date"
            value={to}
            min={min}
            max={max}
            onChange={(e) => setFilter({ dateRange: { ...filter.dateRange, to: e.target.value } })}
            className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm tabular-nums focus:outline focus:outline-2 focus:outline-ring"
          />
        </div>
      </PopoverContent>
    </Popover>
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
  const allSelected = selected.length === values.length;

  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <span className="text-muted-foreground">{label}:</span>
          <span className="font-medium">
            {selected.length === 0 ? "Semua" : selected.length === 1 ? selected[0] : `${selected.length} dipilih`}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0">
        <Command>
          <CommandInput placeholder="Cari…" />
          <div className="flex items-center justify-between border-b border-surface-border px-3 py-2 text-xs">
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-primary"
              onClick={() => onChange(allSelected ? [] : [...values])}
            >
              {allSelected ? "Hapus Semua" : "Pilih Semua"}
            </Button>
            <span className="text-muted-foreground">{values.length} opsi</span>
          </div>
          <CommandList className="max-h-48">
            <CommandEmpty>Tidak ditemukan</CommandEmpty>
            <CommandGroup>
              {values.map((v) => {
                const checked = selected.includes(v);
                return (
                  <CommandItem key={v} onSelect={() => toggle(v)}>
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border",
                        checked ? "border-primary bg-primary text-white" : "border-surface-border"
                      )}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    {v}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function GlobalFilterBar() {
  const { dataset, filter, setFilter, resetFilter } = useFinBoardStore();
  const txs = dataset?.transactions;

  // uniqueValues + batas tanggal dibungkus useMemo agar tak dihitung ulang tiap render
  // (PRD §9: hindari kerja berat di jalur render).
  const categories = useMemo(() => (txs ? uniqueValues(txs, "category") : []), [txs]);
  const departments = useMemo(() => (txs ? uniqueValues(txs, "department") : []), [txs]);
  const channels = useMemo(() => (txs ? uniqueValues(txs, "channel") : []), [txs]);

  const { min, max } = useMemo(() => {
    if (!txs || txs.length === 0) return { min: "", max: "" };
    const dates = txs.map((t) => t.date).sort();
    return { min: dates[0], max: dates[dates.length - 1] };
  }, [txs]);

  if (!dataset) return null;

  const isFiltered =
    filter.categories.length > 0 ||
    filter.departments.length > 0 ||
    filter.channels.length > 0 ||
    filter.dateRange.from !== null ||
    filter.dateRange.to !== null;

  /** Susun daftar chip filter aktif (label + nilai + aksi hapus satuan) (UI Bagian 3). */
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (filter.dateRange.from && filter.dateRange.to) {
    const from = filter.dateRange.from;
    const to = filter.dateRange.to;
    chips.push({
      key: `date-${from}-${to}`,
      label: `${formatDate(from)} – ${formatDate(to)}`,
      onRemove: () => setFilter({ dateRange: { from: null, to: null } }),
    });
  }
  for (const c of filter.categories) {
    chips.push({
      key: `cat-${c}`,
      label: c,
      onRemove: () => setFilter({ categories: filter.categories.filter((x) => x !== c) }),
    });
  }
  for (const d of filter.departments) {
    chips.push({
      key: `dept-${d}`,
      label: d,
      onRemove: () => setFilter({ departments: filter.departments.filter((x) => x !== d) }),
    });
  }
  for (const ch of filter.channels) {
    chips.push({
      key: `ch-${ch}`,
      label: ch,
      onRemove: () => setFilter({ channels: filter.channels.filter((x) => x !== ch) }),
    });
  }

  return (
    <div className="sticky top-[57px] z-30 border-b border-surface-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <DateRangeControl min={min} max={max} />
        {categories.length > 1 && (
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
          <Button
            variant="outline"
            onClick={resetFilter}
            className="ml-auto gap-1.5 text-danger hover:bg-danger-soft hover:text-danger"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Filter
          </Button>
        )}
      </div>

      {/* Active Filter Chips (UI Bagian 3): pill tiap filter aktif + tombol × satuan */}
      {chips.length > 0 && (
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-1.5 px-4 pb-3 sm:px-6">
          <span className="mr-1 text-xs text-muted-foreground">Filter aktif:</span>
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full border border-surface-border bg-white px-2.5 py-0.5 text-xs font-medium text-foreground"
            >
              {chip.label}
              <button
                onClick={chip.onRemove}
                aria-label={`Hapus filter ${chip.label}`}
                className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-danger cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
