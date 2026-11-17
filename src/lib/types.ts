/**
 * Tipe data inti FinBoard (PRD §7.1).
 */

export type CanonicalField =
  | "date"
  | "revenue"
  | "expenses"
  | "profit"
  | "category"
  | "department"
  | "channel"
  | "budget";

export type ColumnMapping = Record<CanonicalField, string | null>;

export interface NormalizedTransaction {
  id: string;
  date: string; // ISO "YYYY-MM-DD"
  monthKey: string; // "YYYY-MM"
  revenue: number;
  expenses: number;
  profit: number;
  category: string;
  department: string;
  channel: string;
  budget: number | null;
}

export interface GlobalFilterState {
  dateRange: { from: string | null; to: string | null };
  categories: string[];
  departments: string[];
  channels: string[];
}

export interface ParsedDataset {
  fileName: string;
  headers: string[];
  transactions: NormalizedTransaction[];
  mapping: ColumnMapping;
  /** jumlah baris yang dibuang karena tanggal tidak valid */
  invalidDateRows: number;
  /** jumlah sel numerik kosong/tidak valid yang dikonversi ke 0 */
  cleanedNumericCells: number;
}
