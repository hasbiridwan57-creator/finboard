"use client";

/**
 * TransactionTable (PRD FR-TBL). TanStack Table v8 (API stabil).
 * Global search (debounce 200ms), multi-column sort, paginasi 10/25/50.
 */
import { useState, useMemo, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type Row,
  type SortingState,
} from "@tanstack/react-table";
import { Search, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { NormalizedTransaction } from "@/lib/types";
import { formatCurrency, parseFinancialNumber, formatPercent } from "@/lib/format";
import { useFinBoardStore } from "@/store/finBoardStore";
import type { CurrencyMode } from "@/store/finBoardStore";

/**
 * globalFilterFn kustom: cari substring di semua kolom (teks & angka).
 * Pencarian angka toleran terhadap pemisah: input "15.000.000", "15000000",
 * atau "15,000,000" semuanya dinormalisasi lalu dicocokkan ke nilai sel.
 */
function makeMatchGlobalFilter(exchangeRate: number) {
  return function matchGlobalFilter(
    row: Row<NormalizedTransaction>,
    _columnId: string,
    filterValue: unknown,
  ): boolean {
    const q = String(filterValue ?? "").trim().toLowerCase();
    if (!q) return true;
    const t = row.original;
    const textHay = [t.id, t.date, t.category, t.department, t.channel].join(" ").toLowerCase();
    if (textHay.includes(q)) return true;
    // Normalisasi query angka → bandingkan dengan nilai numerik tiap sel keuangan (IDR).
    const qNum = parseFinancialNumber(q);
    const cells = [t.revenue, t.expenses, t.profit, t.budget];

    // 1) Cocokkan sebagai IDR mentah (perilaku lama).
    if (qNum !== null) {
      if (cells.some((v) => v !== null && Math.abs(v - qNum) < 1)) return true;
    }

    // 2) Cabang USD terkonversi: jika query mengandung "$" atau menyerupai angka
    //    desimal US (contoh: $63, 63, $63.42, 63.42), cocokkan terhadap nilai
    //    IDR yang sudah dikonversi ke USD (value / exchangeRate).
    const looksUsd = q.includes("$") || /^\$?\d{1,3}(,\d{3})*(\.\d+)?$|^\$?\d+(\.\d+)?$/.test(q);
    if (looksUsd && typeof qNum === "number" && exchangeRate > 0) {
      const qRound = String(Math.round(qNum));
      const qFixed = qNum.toFixed(2);
      const qFixedTrim = qNum.toFixed(2).replace(/\.00$/, "");
      for (const v of cells) {
        if (v === null) continue;
        const usd = v / exchangeRate;
        const usdRound = String(Math.round(usd));
        const usdFixed = usd.toFixed(2);
        const usdFixedTrim = usd.toFixed(2).replace(/\.00$/, "");
        if (
          usdRound === qRound ||
          usdFixed === qFixed ||
          usdFixedTrim === qFixedTrim ||
          usdFixedTrim === qRound
        ) {
          return true;
        }
      }
    }

    return false;
  };
}
interface Props {
  data: NormalizedTransaction[];
  hasBudget: boolean;
  /** Kontrol pencarian global dari luar (drill-down anomali). Jika tidak dikirim, pakai state internal. */
  externalSearch?: string;
}

function MoneyCell({ value, currency }: { value: number; currency: CurrencyMode }) {
  return (
    <span className={`tabular-nums ${value < 0 ? "text-danger" : "text-foreground"}`}>
      {formatCurrency(value, currency, false)}
    </span>
  );
}

export default function TransactionTable({ data, hasBudget, externalSearch }: Props) {
  const { currency, exchangeRate } = useFinBoardStore();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [internalFilter, setInternalFilter] = useState("");
  const search = externalSearch !== undefined ? externalSearch : internalFilter;
  const [debouncedFilter, setDebouncedFilter] = useState(search);

  // debounce 200ms (PRD FR-TBL-03)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilter(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const columns = useMemo<ColumnDef<NormalizedTransaction>[]>(() => {
    const cols: ColumnDef<NormalizedTransaction>[] = [
      { accessorKey: "date", header: "Tanggal" },
      { accessorKey: "category", header: "Kategori" },
      { accessorKey: "department", header: "Departemen" },
      { accessorKey: "channel", header: "Kanal" },
      {
        accessorKey: "revenue",
        header: "Revenue",
        cell: (info) => <MoneyCell value={info.getValue<number>()} currency={currency} />,
        meta: { align: "right" },
      },
      {
        accessorKey: "expenses",
        header: "Expenses",
        cell: (info) => <MoneyCell value={info.getValue<number>()} currency={currency} />,
        meta: { align: "right" },
      },
      {
        accessorKey: "profit",
        header: "Profit",
        // Profit positif hijau, negatif merah (UI Bagian 6)
        cell: (info) => {
          const v = info.getValue<number>();
          return (
            <span className={`tabular-nums font-medium ${v < 0 ? "text-danger" : "text-success"}`}>
              {formatCurrency(v, currency, false)}
            </span>
          );
        },
        meta: { align: "right" },
      },
      {
        id: "margin",
        header: "Margin (%)",
        accessorFn: (row) =>
          row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0,
        cell: (info) => {
          const v = info.getValue<number>();
          return (
            <span className={`tabular-nums ${v < 0 ? "text-danger" : "text-muted-foreground"}`}>
              {formatPercent(v)}
            </span>
          );
        },
        meta: { align: "right" },
      },
    ];
    if (hasBudget) {
      cols.push({
        accessorKey: "budget",
        header: "Budget",
        cell: (info) => {
          const v = info.getValue<number | null>();
          return (
            <span className="tabular-nums text-muted-foreground">
              {v !== null ? formatCurrency(v, currency, false) : "—"}
            </span>
          );
        },
        meta: { align: "right" },
      });
    }
    return cols;
  }, [hasBudget, currency]);

  const matchGlobalFilter = useMemo(
    () => makeMatchGlobalFilter(exchangeRate),
    [exchangeRate],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: debouncedFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setDebouncedFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: matchGlobalFilter,
  });

  return (
    <div id="transaction-table" className="rounded-xl border border-surface-border bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground">Data Transaksi Terfilter</h3>
        <div className="no-print flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="transaction-search"
              value={search}
              onChange={(e) => setInternalFilter(e.target.value)}
              placeholder="Cari transaksi…"
              className="w-48 rounded-lg border border-surface-border py-2 pl-8 pr-8 text-sm focus:outline focus:outline-2 focus:outline-primary sm:w-64"
            />
            {search && (
              <button
                onClick={() => {
                  setInternalFilter("");
                  setDebouncedFilter("");
                }}
                aria-label="Hapus pencarian"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="rounded-lg border border-surface-border px-2 py-2 text-sm focus:outline focus:outline-2 focus:outline-primary cursor-pointer"
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>{n} / hal</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-surface-border bg-slate-50/50">
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const align = (header.column.columnDef.meta as { align?: string } | undefined)?.align;
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`px-4 py-3 text-xs font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground ${
                        align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      <span className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">
                  Tidak ada transaksi yang cocok dengan filter Anda.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-surface-border/60 last:border-0 hover:bg-slate-50/50">
                  {row.getVisibleCells().map((cell) => {
                    const align = (cell.column.columnDef.meta as { align?: string } | undefined)?.align;
                    return (
                      <td
                        key={cell.id}
                        className={`px-4 py-3 whitespace-nowrap ${align === "right" ? "text-right" : "text-left"}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
          {(() => {
            const rows = table.getFilteredRowModel().rows.map((r) => r.original);
            const totRev = rows.reduce((s, t) => s + t.revenue, 0);
            const totExp = rows.reduce((s, t) => s + t.expenses, 0);
            const totProf = rows.reduce((s, t) => s + t.profit, 0);
            const totBud = rows.reduce((s, t) => s + (t.budget ?? 0), 0);
            const totMargin = totRev > 0 ? (totProf / totRev) * 100 : 0;
            if (rows.length === 0) return null;
            return (
              <tfoot className="border-t-2 border-surface-border bg-slate-50/80 font-semibold">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">
                    Total Keseluruhan ({rows.length} transaksi)
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground whitespace-nowrap">
                    {formatCurrency(totRev, currency, false)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground whitespace-nowrap">
                    {formatCurrency(totExp, currency, false)}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${totProf < 0 ? "text-danger" : "text-success"}`}>
                    {formatCurrency(totProf, currency, false)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground whitespace-nowrap">
                    {formatPercent(totMargin)}
                  </td>
                  {hasBudget && (
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                      {formatCurrency(totBud, currency, false)}
                    </td>
                  )}
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>

      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-surface-border px-5 py-4 text-sm">
        <p className="text-muted-foreground">
          Menampilkan{" "}
          {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length,
          )}{" "}
          dari {table.getFilteredRowModel().rows.length} transaksi
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-lg border border-surface-border p-2 disabled:opacity-30 hover:bg-slate-50 cursor-pointer disabled:cursor-default"
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-3 text-muted-foreground tabular-nums">
            Hal. {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-lg border border-surface-border p-2 disabled:opacity-30 hover:bg-slate-50 cursor-pointer disabled:cursor-default"
            aria-label="Halaman berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
