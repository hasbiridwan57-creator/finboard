/**
 * Heuristik pemetaan kolom CSV → CanonicalField (PRD §7.2).
 */
import type { CanonicalField, ColumnMapping } from "./types";

const SYNONYMS: Record<CanonicalField, string[]> = {
  date: ["date", "tanggal", "tgl", "transaction date", "tanggal transaksi", "period", "periode", "bulan", "month", "waktu", "created at"],
  revenue: ["revenue", "pendapatan", "sales", "penjualan", "omzet", "omset", "income", "pemasukan", "gross sales", "total sales", "turnover"],
  expenses: ["expense", "expenses", "pengeluaran", "biaya", "cost", "costs", "cogs", "beban", "opex", "spending", "outflow"],
  profit: ["profit", "laba", "net profit", "laba bersih", "gross profit", "laba kotor", "margin", "keuntungan", "net income", "ebitda"],
  category: ["category", "kategori", "product category", "kategori produk", "jenis", "type", "segment", "segmen", "divisi produk", "item"],
  department: ["department", "departemen", "dept", "division", "divisi", "unit", "team", "tim", "bagian", "cost center"],
  channel: ["channel", "sales channel", "kanal", "kanal penjualan", "source", "sumber", "platform", "saluran", "medium", "marketplace"],
  budget: ["budget", "anggaran", "target", "target revenue", "rencana", "plan", "planned", "forecast", "kuota"],
};

const ALL_FIELDS = Object.keys(SYNONYMS) as CanonicalField[];

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[_-]/g, " ").replace(/\s+/g, " ");
}

/**
 * Petakan daftar header CSV ke ColumnMapping.
 * Prioritas: exact match → partial (includes).
 */
export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping = Object.fromEntries(ALL_FIELDS.map((f) => [f, null])) as ColumnMapping;
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const used = new Set<string>();

  // Pass 1: exact match
  for (const field of ALL_FIELDS) {
    const hit = normalized.find((h) => !used.has(h.raw) && SYNONYMS[field].includes(h.norm));
    if (hit) {
      mapping[field] = hit.raw;
      used.add(hit.raw);
    }
  }

  // Pass 2: partial match (includes), hanya untuk field yang belum terpetakan
  for (const field of ALL_FIELDS) {
    if (mapping[field]) continue;
    const hit = normalized.find(
      (h) =>
        !used.has(h.raw) &&
        SYNONYMS[field].some((syn) => h.norm.includes(syn) || syn.includes(h.norm)),
    );
    if (hit) {
      mapping[field] = hit.raw;
      used.add(hit.raw);
    }
  }

  return mapping;
}

/** Cek apakah mapping sudah memenuhi kolom wajib minimum (PRD §7.2). */
export function isMappingSufficient(mapping: ColumnMapping): boolean {
  if (!mapping.date || !mapping.revenue) return false;
  return Boolean(mapping.expenses || mapping.profit);
}

/** Daftar field wajib yang belum terpenuhi (untuk menandai merah di modal mapping). */
export function missingRequiredFields(mapping: ColumnMapping): CanonicalField[] {
  const missing: CanonicalField[] = [];
  if (!mapping.date) missing.push("date");
  if (!mapping.revenue) missing.push("revenue");
  if (!mapping.expenses && !mapping.profit) {
    missing.push("expenses");
  }
  return missing;
}
