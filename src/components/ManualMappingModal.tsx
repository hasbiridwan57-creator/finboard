"use client";

/**
 * ManualMappingModal (PRD FR-PRS-06, US-03).
 * Fallback ketika heuristik gagal mendeteksi kolom wajib.
 * Dibangun di atas komponen Dialog shadcn/ui.
 */
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
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
  const [applyError, setApplyError] = useState<string | null>(null);
  const { setDataset } = useFinBoardStore();

  // 3 baris pertama untuk pratinjau (PRD US-03).
  // Dependency [mapping]: pratinjau ikut ter-update saat user mengubah pilihan dropdown.
  // reparseWithMapping dibungkus try-catch agar tidak crash ketika kombinasi pemetaan
  // sementara belum valid (mis. kolom tanggal masih kosong).
  const preview = useMemo(() => {
    try {
      const raw = reparseWithMapping(mapping);
      return raw ? raw.transactions.slice(0, 3) : [];
    } catch {
      return [];
    }
  }, [mapping]);

  const sufficient = isMappingSufficient(mapping);

  const handleApply = () => {
    try {
      const raw = reparseWithMapping(mapping);
      if (raw) {
        setApplyError(null);
        setDataset(raw);
        onClose();
      } else {
        setApplyError("Gagal membaca data. Pastikan kolom tanggal valid dan kolom wajib sudah dipilih.");
        toast.error("Gagal memproses pemetaan", {
          description: "Periksa kembali pilihan kolom Tanggal dan kolom keuangan.",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Terjadi kesalahan saat membaca CSV.";
      setApplyError(msg);
      toast.error("Gagal memproses pemetaan", { description: msg });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sesuaikan Pemetaan Kolom</DialogTitle>
          <DialogDescription>
            Pilih kolom CSV yang sesuai untuk setiap field di bawah.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
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
                    className="mt-1.5 w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-foreground focus:outline focus:outline-2 focus:outline-ring"
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
                      <tr key={i} className={i % 2 ? "bg-secondary" : ""}>
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

        {applyError && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-xs text-danger">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{applyError}</span>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-3 sm:justify-between">
          <p className={`text-sm ${sufficient ? "text-success" : "text-danger"}`}>
            {sufficient
              ? "Kolom wajib sudah lengkap ✓"
              : "Kolom Tanggal + Pendapatan + (Pengeluaran atau Laba) wajib diisi."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button onClick={handleApply} disabled={!sufficient}>
              Terapkan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
