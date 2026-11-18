/**
 * Zustand store — single source of truth (PRD FR-FLT-01).
 * Dataset penuh disimpan di memori (bukan localStorage agar aman kuota, PRD §13);
 * hanya metadata ringan yang dipersist.
 */
import { create } from "zustand";
import type { ColumnMapping, GlobalFilterState, ParsedDataset } from "@/lib/types";
import { clearRawCsv } from "@/lib/sessionCsv";

/** Mode tampilan mata uang (PRD/audit Bagian B4). */
export type CurrencyMode = "IDR" | "USD";

/** Kurs default IDR→USD (dapat diubah user; konversi client-side, tanpa API). */
export const DEFAULT_USD_RATE = 15750;
const RATE_KEY = "finboard.usdRate";

/** Baca kurs tersimpan dari localStorage (fallback default). */
function loadRate(): number {
  try {
    const raw = localStorage.getItem(RATE_KEY);
    if (raw) {
      const n = parseFloat(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_USD_RATE;
}

/** Simpan kurs ke localStorage (ringan, bukan data transaksi). */
function saveRate(rate: number) {
  try {
    localStorage.setItem(RATE_KEY, String(rate));
  } catch {
    /* ignore */
  }
}

interface FinBoardState {
  dataset: ParsedDataset | null;
  filter: GlobalFilterState;
  /** flag agar komponen tahu kapan perlu membuka modal mapping manual */
  needsManualMapping: boolean;
  /** mode tampilan mata uang untuk format angka (default IDR) */
  currency: CurrencyMode;
  /** kurs IDR→USD yang dipakai saat mode USD (angka diubah = nilai / rate) */
  exchangeRate: number;

  setDataset: (ds: ParsedDataset) => void;
  setMapping: (mapping: ColumnMapping) => void;
  /** update pemetaan & re-normalize dataset (dipakai modal mapping manual) */
  setFilter: (patch: Partial<GlobalFilterState>) => void;
  resetFilter: () => void;
  clearSession: () => void;
  setNeedsManualMapping: (v: boolean) => void;
  setCurrency: (c: CurrencyMode) => void;
  /** ubah kurs IDR→USD; validasi > 0 */
  setExchangeRate: (rate: number) => void;
}

export const emptyFilter: GlobalFilterState = {
  dateRange: { from: null, to: null },
  categories: [],
  departments: [],
  channels: [],
};

export const useFinBoardStore = create<FinBoardState>((set) => ({
  dataset: null,
  filter: emptyFilter,
  needsManualMapping: false,
  currency: "IDR",
  exchangeRate: loadRate(),

  setDataset: (ds) => {
    set({ dataset: ds, filter: emptyFilter, needsManualMapping: false });
    persistMeta(ds.fileName);
  },

  setMapping: () => {
    // dipakai bersama re-parse di komponen; di sini hanya menyimpan flag
    set({ needsManualMapping: false });
  },

  setFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),

  resetFilter: () => set({ filter: emptyFilter }),

  clearSession: () => {
    set({ dataset: null, filter: emptyFilter, needsManualMapping: false });
    clearRawCsv();
    try {
      localStorage.removeItem("finboard.meta");
    } catch {
      /* ignore */
    }
  },

  setNeedsManualMapping: (v) => set({ needsManualMapping: v }),

  setCurrency: (c) => set({ currency: c }),

  setExchangeRate: (rate) => {
    if (!Number.isFinite(rate) || rate <= 0) return; // validasi: tolak nilai tak valid
    set({ exchangeRate: rate });
    saveRate(rate);
  },
}));

/** Simpan hanya metadata ringan (PRD §13). */
function persistMeta(fileName: string) {
  try {
    localStorage.setItem("finboard.meta", JSON.stringify({ fileName, at: Date.now() }));
  } catch {
    /* kuota penuh — abaikan */
  }
}
