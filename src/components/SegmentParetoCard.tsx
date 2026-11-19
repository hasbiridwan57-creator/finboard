"use client";

import { useMemo, useState } from "react";
import { useFinBoardStore } from "@/store/finBoardStore";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { NormalizedTransaction } from "@/lib/types";

type Dim = "category" | "department" | "channel";

interface SegmentRow {
  name: string;
  count: number;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  profitMargin: number;
  contribution: number;
  cumulative: number;
  isPareto: boolean;
}

const DIM_LABEL: Record<Dim, string> = {
  category: "Kategori",
  department: "Departemen",
  channel: "Kanal",
};

const FILTER_KEY: Record<Dim, "categories" | "departments" | "channels"> = {
  category: "categories",
  department: "departments",
  channel: "channels",
};

export function SegmentParetoCard({ txs }: { txs: NormalizedTransaction[] }) {
  const [dim, setDim] = useState<Dim>("category");
  const currency = useFinBoardStore((s) => s.currency);
  const exchangeRate = useFinBoardStore((s) => s.exchangeRate);
  const filter = useFinBoardStore((s) => s.filter);
  const setFilter = useFinBoardStore((s) => s.setFilter);

  const rows = useMemo<SegmentRow[]>(() => {
    const groups = new Map<string, { count: number; rev: number; exp: number; prof: number }>();
    for (const t of txs) {
      const key = t[dim] || "(kosong)";
      const g = groups.get(key) ?? { count: 0, rev: 0, exp: 0, prof: 0 };
      g.count += 1;
      g.rev += t.revenue;
      g.exp += t.expenses;
      g.prof += t.profit;
      groups.set(key, g);
    }

    const totalRev = Array.from(groups.values()).reduce((s, g) => s + g.rev, 0);

    const sorted = Array.from(groups.entries())
      .map(([name, g]) => ({ name, ...g }))
      .sort((a, b) => b.rev - a.rev);

    let running = 0;
    let paretoMarked = false;
    return sorted.map((g) => {
      const contribution = totalRev > 0 ? (g.rev / totalRev) * 100 : 0;
      running += contribution;
      // Pareto 80/20: tandai sampai kumulatif pertama kali mencapai/melebihi 80%.
      // Guard totalRev > 0 agar dataset kosong/zero-revenue tidak salah tandai.
      const isPareto = totalRev > 0 && !paretoMarked;
      if (running >= 80) paretoMarked = true;
      return {
        name: g.name,
        count: g.count,
        totalRevenue: g.rev,
        totalExpenses: g.exp,
        totalProfit: g.prof,
        profitMargin: g.rev > 0 ? (g.prof / g.rev) * 100 : 0,
        contribution,
        cumulative: running,
        isPareto,
      };
    });
  }, [txs, dim]);

  const activeList = filter[FILTER_KEY[dim]];
  const toggle = (name: string) => {
    const key = FILTER_KEY[dim];
    const cur = filter[key];
    const next = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name];
    setFilter({ [key]: next });
  };

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold">Performa Segmen &amp; Pareto 80/20</h3>
        <div className="inline-flex rounded-md border bg-muted p-0.5">
          {(["category", "department", "channel"] as Dim[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDim(d)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                dim === d
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {DIM_LABEL[d]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">Segmen</th>
              <th className="px-4 py-2 text-right font-medium">Transaksi</th>
              <th className="px-4 py-2 text-right font-medium">Total Revenue</th>
              <th className="px-4 py-2 text-right font-medium">Total Expenses</th>
              <th className="px-4 py-2 text-right font-medium">Total Profit</th>
              <th className="px-4 py-2 text-right font-medium">Margin (%)</th>
              <th className="px-4 py-2 font-medium">Kontribusi (%)</th>
              <th className="px-4 py-2 text-right font-medium">Kumulatif (%)</th>
              <th className="px-4 py-2 font-medium">Pareto</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                  Tidak ada data segmen.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const isActive = activeList.includes(r.name);
                return (
                  <tr
                    key={r.name}
                    onClick={() => toggle(r.name)}
                    className={`cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/50 ${
                      isActive ? "bg-primary/5 ring-1 ring-inset ring-primary/40" : ""
                    }`}
                  >
                    <td className="px-4 py-2 font-medium">{r.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.count}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(r.totalRevenue, currency, true, exchangeRate)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(r.totalExpenses, currency, true, exchangeRate)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums font-medium ${
                        r.totalProfit < 0 ? "text-danger" : "text-success"
                      }`}
                    >
                      {formatCurrency(r.totalProfit, currency, true, exchangeRate)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatPercent(r.profitMargin)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-100">
                          <div
                            className="h-full rounded bg-primary"
                            style={{ width: `${Math.min(100, Math.max(0, r.contribution))}%` }}
                          />
                        </div>
                        <span className="w-12 shrink-0 text-right tabular-nums">
                          {formatPercent(r.contribution)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatPercent(r.cumulative)}
                    </td>
                    <td className="px-4 py-2">
                      {r.isPareto ? (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Top 80% Pareto
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t p-3 text-xs text-muted-foreground">
        Klik baris untuk memfilter {DIM_LABEL[dim].toLowerCase()} di seluruh dashboard.
      </div>
    </div>
  );
}

export default SegmentParetoCard;
