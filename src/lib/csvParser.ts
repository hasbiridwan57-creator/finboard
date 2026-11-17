/**
 * Parser & normalizer CSV (PRD FR-PRS-01 s.d. FR-PRS-05).
 */
import Papa from "papaparse";
import type { ColumnMapping, NormalizedTransaction, ParsedDataset } from "./types";
import { autoMapColumns } from "./columnMapper";
import { toNumberOrZero } from "./format";
import { parseDate, detectDayFirst, toMonthKey } from "./date";

export const MAX_FILE_SIZE = 5_242_880; // 5 MB (PRD FR-UPL-02)

/** Validasi pra-parsing (ukuran & ekstensi). Melempar Error dengan pesan Indonesia. */
export function validateFile(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Ukuran file melebihi batas maksimal 5 MB. Silakan unggah file yang lebih ringkas.");
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("Format file tidak didukung. Harap unggah file berformat CSV (.csv).");
  }
}

export interface ParseOptions {
  /** mapping kolom eksplisit (jika user mengatur manual). Jika tidak, pakai autoMap. */
  mapping?: ColumnMapping;
}

/**
 * Parse teks CSV menjadi dataset ternormalisasi.
 * Melempar Error jika CSV kosong / mapping kolom wajib belum terpenuhi.
 */
export function parseCsv(
  text: string,
  fileName: string,
  options: ParseOptions = {},
): ParsedDataset {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });

  const headers = (result.meta.fields || []).filter(Boolean);
  if (headers.length === 0 || result.data.length === 0) {
    throw new Error("File CSV kosong atau tidak memiliki baris data.");
  }

  const mapping = options.mapping ?? autoMapColumns(headers);
  const { date, revenue, expenses, profit, category, department, channel, budget } = mapping;

  // Ambil sampel kolom tanggal untuk deteksi DD/MM vs MM/DD
  const dateSamples = date ? result.data.slice(0, 50).map((r) => r[date] ?? "").filter(Boolean) : [];
  const dayFirst = detectDayFirst(dateSamples);

  const transactions: NormalizedTransaction[] = [];
  let invalidDateRows = 0;
  let cleanedNumericCells = 0;

  result.data.forEach((row, idx) => {
    const rawDate = date ? (row[date] ?? "") : "";
    const iso = parseDate(rawDate, dayFirst);
    if (!iso) {
      invalidDateRows++;
      return; // baris tanggal invalid diabaikan dari agregasi (PRD FR-PRS-04)
    }

    // Angka (onCleaned dipanggil hanya sekali per baris untuk menghitung sel dibersihkan)
    let cleanedInRow = false;
    const markClean = () => {
      cleanedNumericCells++;
      cleanedInRow = true;
    };

    const rev = toNumberOrZero(revenue ? row[revenue] : "0", markClean);
    let exp = expenses ? toNumberOrZero(row[expenses], markClean) : 0;
    let prof = profit ? toNumberOrZero(row[profit], markClean) : 0;

    // Derivasi kolom keuangan (PRD FR-PRS-05) — basisnya ada/tidaknya KOLOM dipetakan.
    if (!expenses && profit) {
      // Tidak ada kolom Expenses, tapi ada Profit → Expenses = Revenue - Profit
      exp = rev - prof;
    } else if (!profit && expenses) {
      // Tidak ada kolom Profit, tapi ada Expenses → Profit = Revenue - Expenses
      prof = rev - exp;
    }
    // Catatan: mapping wajib menjamin minimal salah satu dari expenses/profit ada
    // (divalidasi via isMappingSufficient sebelum parse).

    const budgetVal = budget ? toNumberOrZero(row[budget], markClean) : null;

    transactions.push({
      id: `tx_${idx}`,
      date: iso,
      monthKey: toMonthKey(iso),
      revenue: rev,
      expenses: exp,
      profit: prof,
      category: (category && row[category]?.trim()) || "Tidak Dikategorikan",
      department: (department && row[department]?.trim()) || "Umum",
      channel: (channel && row[channel]?.trim()) || "Umum",
      budget: budget ? budgetVal : null,
    });
  });

  if (transactions.length === 0) {
    throw new Error("Tidak ada baris data valid yang dapat dibaca. Periksa format tanggal dan kolom CSV Anda.");
  }

  return {
    fileName,
    headers,
    transactions,
    mapping,
    invalidDateRows,
    cleanedNumericCells,
  };
}
