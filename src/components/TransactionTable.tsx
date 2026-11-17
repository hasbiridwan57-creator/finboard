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
  type SortingState,
} from "@tanstack/react-table";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { NormalizedTransaction } from "@/lib/types";
import { formatRupiah } from "@/lib/format";

interface Props {
  data: NormalizedTransaction[];
  hasBudget: boolean;
}

function MoneyCell({ value }: { value: number }) {
  return (
    <span className={`tabular-nums ${value < 0 ? "text-danger" : "text-foreground"}`}>
      {formatRupiah(value, false)}
    </span>
  );
}

export default function TransactionTable({ data, hasBudget }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedFilter, setDebouncedFilter] = useState("");

  // debounce 200ms (PRD FR-TBL-03)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilter(globalFilter), 200);
    return () => clearTimeout(t);
  }, [globalFilter]);

  const columns = useMemo<ColumnDef<NormalizedTransaction>[]>(() => {
    const cols: ColumnDef<NormalizedTransaction>[] = [
      { accessorKey: "date", header: "Tanggal" },
      { accessorKey: "category", header: "Kategori" },
      { accessorKey: "department", header: "Departemen" },
      { accessorKey: "channel", header: "Kanal" },
      {
        accessorKey: "revenue",
        header: "Revenue",
        cell: (info) => <MoneyCell value={info.getValue<number>()} />,
        meta: { align: "right" },
      },
      {
        accessorKey: "expenses",
        header: "Expenses",
        cell: (info) => <MoneyCell value={info.getValue<number>()} />,
        meta: { align: "right" },
      },
      {
        accessorKey: "profit",
        header: "Profit",
        cell: (info) => <MoneyCell value={info.getValue<number>()} />,
        meta: { align: "right" },
      },
    ];
    if (hasBudget) {
      cols.push({
        accessorKey: "budget",
        header: "Budget",
        cell: (info) => {
          const v = info.getValue<number | null>();
          return <span className="tabular-nums text-muted-foreground">{v !== null ? formatRupiah(v, false) : "—"}</span>;
        },
        meta: { align: "right" },
      });
    }
    return cols;
  }, [hasBudget]);

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
    globalFilterFn: "includesString",
  });

  return (
    <div className="rounded-xl border border-surface-border bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground">Data Transaksi Terfilter</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Cari transaksi…"
              className="w-48 rounded-lg border border-surface-border py-2 pl-8 pr-3 text-sm focus:outline focus:outline-2 focus:outline-primary sm:w-64"
            />
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
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border px-5 py-4 text-sm">
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
