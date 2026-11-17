"use client";

/**
 * ManualMappingModal (PRD FR-PRS-06, US-03).
 * Fallback ketika heuristik gagal mendeteksi kolom wajib.
 */
import { useMemo, useState } from "react";
import Papa from "papaparse";
import { AlertTriangle, Check, X } from "lucide-react";
import type { CanonicalField, ColumnMapping } from "@/lib/types";
import { isMappingSufficient } from "@/lib/columnMapper";
import { reparseWithMapping } from "@/lib/sessionCsv";
import { useFinBoardStore } from "@/store/finBoardStore";

const FIELD_LABELS: Record<CanonicalField, { label: string; required: boolean; hint: string }> = {
  date: { label: "Tanggal", required: true, hint: "Wajib" },
  revenue: { label: "Pendapatan (Revenue)", required: true, hint: "Wajib" },
  expenses: { label: "Pengeluaran (Expenses)", required: false, hint: "Wajib jika tidak ada Profit" },
  profit: { label: "Laba (Profit)", required: false, hint: "Opsional — dihitung otomatis" },
  category: { label: "Kategori", required: false, hint: "Opsional" },
  department: { label: "Departemen", required: false, hint: "Opsional" },
  channel: { label: "Kanal Penjualan", required: false, hint: "Opsional" },
  budget: { label: "Anggaran (Budget)", required: false, hint: "Opsional" },
};

const FIELD_ORDER: CanonicalField[] = [
  "date", "revenue", "expenses", "profit",
  "category", "department", "channel", "budget",
];

interface Props {
  open: boolean;
  headers: string[];
  initialMapping: ColumnMapping;
  onClose: () => void;
}

export default function ManualMappingModal({ open, headers, initialMapping, onClose }: Props) {
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping);
  const { setDataset } = useFinBoardStore();

  // 3 baris pertama untuk pratinjau (PRD US-03)
  const preview = useMemo(() => {
    const raw = reparseWithMapping(mapping);
    return raw ? raw.transactions.slice(0, 3) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  const sufficient = isMappingSufficient(mapping);

  const handleApply = () => {
    const raw = reparseWithMapping(mapping);
    if (raw) {
      setDataset(raw);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sesuaikan Pemetaan Kolom"
        className="w-full max-w-2xl rounded-xl border border-surface-border bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Sesuaikan Pemetaan Kolom</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Pilih kolom CSV yang sesuai untuk setiap field di bawah.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg p-2 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELD_ORDER.map((field) => {
              const meta = FIELD_LABELS[field];
              const ok = Boolean(mapping[field]);
              return (
                <div key={field}>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    {meta.label}
                    {ok ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : meta.required ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    ) : null}
                  </label>
                  <select
                    value={mapping[field] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [field]: e.target.value || null }))
                    }
                    className="mt-1.5 w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-foreground focus:outline focus:outline-2 focus:outline-primary"
                  >
                    <option value="">— Tidak dipakai —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">{meta.hint}</p>
                </div>
              );
            })}
          </div>

          {preview.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-foreground">Pratinjau 3 baris pertama:</p>
              <div className="overflow-x-auto rounded-lg border border-surface-border">
                <table className="w-full text-xs">
                  <tbody>
                    {preview.map((t, i) => (
                      <tr key={i} className={i % 2 ? "bg-slate-50" : ""}>
                        <td className="px-3 py-2 tabular-nums">{t.date}</td>
                        <td className="px-3 py-2 tabular-nums">Rp {t.revenue.toLocaleString("id-ID")}</td>
                        <td className="px-3 py-2 tabular-nums">Rp {t.expenses.toLocaleString("id-ID")}</td>
                        <td className="px-3 py-2 tabular-nums">Rp {t.profit.toLocaleString("id-ID")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-surface-border px-6 py-4">
          <p className={`text-sm ${sufficient ? "text-success" : "text-danger"}`}>
            {sufficient
              ? "Kolom wajib sudah lengkap ✓"
              : "Kolom Tanggal + Pendapatan + (Pengeluaran atau Laba) wajib diisi."}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-surface-border px-4 py-2 text-sm font-medium text-foreground hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              onClick={handleApply}
              disabled={!sufficient}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Terapkan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
