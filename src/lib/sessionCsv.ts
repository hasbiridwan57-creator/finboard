/**
 * Re-parse teks CSV mentah dengan mapping eksplisit (PRD FR-PRS-06).
 * Dipakai modal mapping manual setelah user memilih kolom.
 * Juga menyimpan snapshot raw CSV ke sessionStorage agar data tidak hilang
 * saat halaman di-refresh (Gemini M1.3).
 */
import { parseCsv } from "@/lib/csvParser";
import type { ColumnMapping, ParsedDataset } from "@/lib/types";

/** Simpan teks CSV mentah di memori sesi (module-level, bukan localStorage). */
let rawCsvText: string | null = null;
let rawFileName = "";

const SESSION_KEY = "finboard.rawCsv";

function persistToSession(text: string, fileName: string) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ text, fileName }));
  } catch {
    /* kuota penuh (CSV bisa ~5MB, sessionStorage ~5MB) — abaikan */
  }
}

export function setRawCsv(text: string, fileName: string) {
  rawCsvText = text;
  rawFileName = fileName;
  persistToSession(text, fileName);
}

export function getRawCsv(): { text: string; fileName: string } | null {
  if (rawCsvText === null) {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { text: string; fileName: string };
        rawCsvText = parsed.text;
        rawFileName = parsed.fileName ?? "";
      }
    } catch {
      /* data korup / sessionStorage tak tersedia — abaikan */
    }
  }
  if (rawCsvText === null) return null;
  return { text: rawCsvText, fileName: rawFileName };
}

/** Bersihkan raw CSV dari memori & sessionStorage (dipakai clearSession). */
export function clearRawCsv() {
  rawCsvText = null;
  rawFileName = "";
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function reparseWithMapping(mapping: ColumnMapping): ParsedDataset | null {
  const raw = getRawCsv();
  if (!raw) return null;
  return parseCsv(raw.text, raw.fileName, { mapping });
}
