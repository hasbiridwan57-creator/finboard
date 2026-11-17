/**
 * Re-parse teks CSV mentah dengan mapping eksplisit (PRD FR-PRS-06).
 * Dipakai modal mapping manual setelah user memilih kolom.
 */
import { parseCsv } from "@/lib/csvParser";
import type { ColumnMapping, ParsedDataset } from "@/lib/types";

/** Simpan teks CSV mentah di memori sesi (module-level, bukan localStorage). */
let rawCsvText: string | null = null;
let rawFileName = "";

export function setRawCsv(text: string, fileName: string) {
  rawCsvText = text;
  rawFileName = fileName;
}

export function getRawCsv(): { text: string; fileName: string } | null {
  if (rawCsvText === null) return null;
  return { text: rawCsvText, fileName: rawFileName };
}

export function reparseWithMapping(mapping: ColumnMapping): ParsedDataset | null {
  const raw = getRawCsv();
  if (!raw) return null;
  return parseCsv(raw.text, raw.fileName, { mapping });
}
