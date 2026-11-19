"use client";

/**
 * excelExporter — ekspor laporan .xlsx profesional via exceljs (lazy-load).
 * Modul di-import dinamis agar tidak membebani bundle awal dashboard:
 *   const ExcelJS = (await import("exceljs")).default;
 * Hanya dimuat saat user mengeklik "Ekspor Excel (.xlsx)".
 */
import type {
  NormalizedTransaction,
} from "@/lib/types";
import type { MonthlyPoint } from "@/lib/chartAggregator";
import { computeKpi } from "@/lib/kpiCalculator";
import { generateInsights } from "@/lib/insightGenerator";
import { format } from "date-fns";
import type { CurrencyMode } from "@/store/finBoardStore";

/** Format angka mata uang asli Excel (bukan string, agar bisa dihitung). */
const FMT_IDR = '"Rp "#,##0;-"Rp "#,##0';
const FMT_USD = '"$"#,##0.00;-"$"#,##0.00';
const FMT_PCT = "0.0%";

/** Warna tema Light Clean Bright FinBoard. */
const C = {
  titleBlue: "FF0F172A", // biru tua judul
  headerBlue: "FF2563EB", // header tabel biru
  headerText: "FFFFFFFF", // putih
  borderLight: "FFE2E8F0",
  borderCell: "FFCBD5E1",
  profitGreen: "FF16A34A",
  lossRed: "FFDC2626",
  zebra: "FFF8FAFC",
  totalFill: "FFF1F5F9",
  white: "FFFFFFFF",
} as const;

export interface ExcelExportOptions {
  txs: NormalizedTransaction[];
  monthly: MonthlyPoint[];
  fileName: string;
  currency: CurrencyMode;
  exchangeRate: number;
  filterDesc: string;
  hasBudget: boolean;
}

/** Format angka murni untuk kolom (nilai numerik asli, format via Excel numFmt). */
function rawMoney(value: number, currency: CurrencyMode, exchangeRate: number): number {
  return currency === "USD" ? value / exchangeRate : value;
}

/**
 * Bangun & unduh file .xlsx. Aman dipanggil dari client component.
 * Lazy-load exceljs di dalam fungsi.
 */
export async function exportExcel(opts: ExcelExportOptions): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const { txs, monthly, fileName, currency, exchangeRate, filterDesc, hasBudget } = opts;

  const moneyFmt = currency === "USD" ? FMT_USD : FMT_IDR;
  const currencyLabel =
    currency === "USD"
      ? `USD (kurs 1 USD = Rp ${exchangeRate.toFixed(0)})`
      : "IDR";
  const today = new Date();

  const wb = new ExcelJS.Workbook();
  wb.creator = "FinBoard";
  wb.created = today;

  /* ==================================================================
   * SHEET 1 — "Ringkasan & P&L"
   * ================================================================== */
  const s1 = wb.addWorksheet("Ringkasan & P&L", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    properties: { defaultRowHeight: 18 },
  });
  s1.columns = [
    { width: 34 }, // A
    { width: 20 }, // B
    { width: 20 }, // C
    { width: 20 }, // D
    { width: 16 }, // E
    { width: 18 }, // F
    { width: 6 },  // G
  ];

  // --- Kop laporan (merged) ---
  const spacerRow = s1.addRow([]);
  spacerRow.height = 6;
  const titleRow = s1.addRow(["LAPORAN ANALITIK KEUANGAN - FINBOARD"]);
  s1.mergeCells(titleRow.number, 1, titleRow.number, 7);
  const titleCell = titleRow.getCell(1);
  titleCell.font = { bold: true, size: 16, color: { argb: C.titleBlue } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  titleRow.height = 28;

  const infoRows: [string, string][] = [
    ["Sumber Data", fileName],
    ["Tanggal Ekspor", format(today, "dd MMM yyyy")],
    ["Mata Uang", currencyLabel],
    ["Filter Aktif", filterDesc],
  ];
  for (const [label, val] of infoRows) {
    const r = s1.addRow([label, val]);
    r.getCell(1).font = { bold: true, color: { argb: "FF64748B" } };
    r.getCell(1).alignment = { vertical: "middle" };
    r.getCell(2).alignment = { vertical: "middle", wrapText: true };
  }
  s1.addRow([]); // spacer

  // --- Ringkasan Eksekutif (KPI) ---
  const kpi = computeKpi(txs);
  const kpiHeader = s1.addRow(["RINGKASAN EKSEKUTIF"]);
  s1.mergeCells(kpiHeader.number, 1, kpiHeader.number, 2);
  kpiHeader.getCell(1).font = { bold: true, size: 12, color: { argb: C.titleBlue } };

  const kpiTableHeader = s1.addRow(["Metrik", "Nilai"]);
  for (const c of [1, 2]) {
    const cell = kpiTableHeader.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBlue } };
    cell.font = { bold: true, color: { argb: C.headerText } };
    cell.border = {
      top: { style: "thin", color: { argb: C.borderLight } },
      left: { style: "thin", color: { argb: C.borderLight } },
      bottom: { style: "thin", color: { argb: C.borderLight } },
      right: { style: "thin", color: { argb: C.borderLight } },
    };
  }
  const kpiRows: [string, number, "money" | "pct"][] = [
    ["Total Revenue", kpi.totalRevenue, "money"],
    ["Total Expenses", kpi.totalExpenses, "money"],
    ["Total Profit", kpi.totalProfit, "money"],
    ["Profit Margin", kpi.profitMargin / 100, "pct"],
  ];
  for (const [label, val, kind] of kpiRows) {
    const r = s1.addRow([label, val]);
    r.getCell(1).border = {
      top: { style: "thin", color: { argb: C.borderLight } },
      left: { style: "thin", color: { argb: C.borderLight } },
      bottom: { style: "thin", color: { argb: C.borderLight } },
      right: { style: "thin", color: { argb: C.borderLight } },
    };
    const vc = r.getCell(2);
    vc.numFmt = kind === "pct" ? FMT_PCT : moneyFmt;
    vc.border = {
      top: { style: "thin", color: { argb: C.borderLight } },
      left: { style: "thin", color: { argb: C.borderLight } },
      bottom: { style: "thin", color: { argb: C.borderLight } },
      right: { style: "thin", color: { argb: C.borderLight } },
    };
    if (label === "Total Profit") {
      vc.font = { bold: true, color: { argb: val < 0 ? C.lossRed : C.profitGreen } };
    }
  }
  s1.addRow([]);

  // --- Laporan Laba Rugi Bulanan (Monthly P&L) ---
  const pnlHeader = s1.addRow(["LAPORAN LABA RUGI BULANAN"]);
  s1.mergeCells(pnlHeader.number, 1, pnlHeader.number, hasBudget ? 6 : 5);
  pnlHeader.getCell(1).font = { bold: true, size: 12, color: { argb: C.titleBlue } };

  const pnlCols: string[] = ["Bulan", "Revenue", "Expenses", "Net Profit", "Margin (%)"];
  if (hasBudget) pnlCols.push("Budget");
  const pnlTableHeader = s1.addRow(pnlCols);
  for (let i = 1; i <= pnlCols.length; i++) {
    const cell = pnlTableHeader.getCell(i);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBlue } };
    cell.font = { bold: true, color: { argb: C.headerText } };
    cell.alignment = { horizontal: "right" };
    cell.border = {
      top: { style: "thin", color: { argb: C.borderLight } },
      left: { style: "thin", color: { argb: C.borderLight } },
      bottom: { style: "thin", color: { argb: C.borderLight } },
      right: { style: "thin", color: { argb: C.borderLight } },
    };
  }
  pnlTableHeader.getCell(1).alignment = { horizontal: "left" };

  const pnlStartRow = pnlTableHeader.number + 1;
  for (const m of monthly) {
    const marginPct = m.revenue > 0 ? m.profit / m.revenue : 0;
    const values: (string | number)[] = [
      m.label,
      rawMoney(m.revenue, currency, exchangeRate),
      rawMoney(m.expenses, currency, exchangeRate),
      rawMoney(m.profit, currency, exchangeRate),
      marginPct,
    ];
    if (hasBudget) {
      values.push(m.budget !== null ? rawMoney(m.budget, currency, exchangeRate) : 0);
    }
    const r = s1.addRow(values);
    r.getCell(1).border = thinBorder();
    r.getCell(2).numFmt = moneyFmt;
    r.getCell(3).numFmt = moneyFmt;
    const profitCell = r.getCell(4);
    profitCell.numFmt = moneyFmt;
    profitCell.font = { color: { argb: m.profit < 0 ? C.lossRed : C.profitGreen } };
    r.getCell(5).numFmt = FMT_PCT;
    if (hasBudget) r.getCell(6).numFmt = moneyFmt;
    // Border semua sel data
    const colCount = hasBudget ? 6 : 5;
    for (let i = 1; i <= colCount; i++) {
      r.getCell(i).border = thinBorder();
    }
  }
  const pnlEndRow = s1.rowCount;

  // Baris Total dengan rumus Excel aktif =SUM(...)
  const totalCols: string[] = ["Total"];
  const colLetter = (n: number): string => {
    let s = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  const sumFormula = (col: number) => `=SUM(${colLetter(col)}${pnlStartRow}:${colLetter(col)}${pnlEndRow})`;
  totalCols.push(sumFormula(2), sumFormula(3), sumFormula(4));
  // Margin total = totalProfit / totalRevenue (rasio, bukan sum)
  const totalRow = s1.addRow([
    "Total",
    sumFormula(2),
    sumFormula(3),
    sumFormula(4),
    `=IF(${colLetter(2)}${pnlEndRow + 1}>0,${colLetter(4)}${pnlEndRow + 1}/${colLetter(2)}${pnlEndRow + 1},0)`,
  ]);
  if (hasBudget) totalRow.getCell(6).value = sumFormula(6);
  for (let i = 1; i <= (hasBudget ? 6 : 5); i++) {
    const cell = totalRow.getCell(i);
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.totalFill } };
    cell.border = thinBorder(true);
    if (i === 2 || i === 3 || i === 4 || (hasBudget && i === 6)) cell.numFmt = moneyFmt;
    if (i === 5) cell.numFmt = FMT_PCT;
  }
  s1.addRow([]);

  // --- Ringkasan Insight Bisnis Otomatis ---
  const insights = generateInsights(txs, currency, exchangeRate);
  if (insights.length > 0) {
    const insHeader = s1.addRow(["RINGKASAN INSIGHT BISNIS OTOMATIS"]);
    s1.mergeCells(insHeader.number, 1, insHeader.number, 7);
    insHeader.getCell(1).font = { bold: true, size: 12, color: { argb: C.titleBlue } };
    for (const ins of insights) {
      const r = s1.addRow([`• ${ins.text}`]);
      s1.mergeCells(r.number, 1, r.number, 7);
      r.getCell(1).alignment = { wrapText: true, vertical: "middle" };
      // Pewarnaan tone
      const color =
        ins.tone === "positive" ? C.profitGreen : ins.tone === "warning" ? C.lossRed : C.titleBlue;
      r.getCell(1).font = { color: { argb: color }, size: 10 };
    }
  }

  /* ==================================================================
   * SHEET 2 — "Data Transaksi"
   * ================================================================== */
  const s2 = wb.addWorksheet("Data Transaksi", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const txCols: string[] = [
    "No",
    "Tanggal",
    "Kategori",
    "Departemen",
    "Kanal Penjualan",
    "Revenue",
    "Expenses",
    "Profit",
    "Margin (%)",
  ];
  if (hasBudget) txCols.push("Budget");
  s2.columns = txCols.map((header) => ({ header }));

  // Header styling
  const txHeader = s2.getRow(1);
  for (let i = 1; i <= txCols.length; i++) {
    const cell = txHeader.getCell(i);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBlue } };
    cell.font = { bold: true, color: { argb: C.headerText } };
    cell.alignment = { vertical: "middle", horizontal: i <= 5 ? "left" : "right" };
    cell.border = {
      top: { style: "thin", color: { argb: C.borderCell } },
      left: { style: "thin", color: { argb: C.borderCell } },
      bottom: { style: "thin", color: { argb: C.borderCell } },
      right: { style: "thin", color: { argb: C.borderCell } },
    };
  }
  txHeader.height = 22;

  // AutoFilter seluruh kolom
  s2.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: txCols.length } };

  // Data rows + zebra striping
  txs.forEach((t, idx) => {
    const marginPct = t.revenue > 0 ? t.profit / t.revenue : 0;
    const values: (string | number)[] = [
      idx + 1,
      t.date,
      t.category,
      t.department,
      t.channel,
      rawMoney(t.revenue, currency, exchangeRate),
      rawMoney(t.expenses, currency, exchangeRate),
      rawMoney(t.profit, currency, exchangeRate),
      marginPct,
    ];
    if (hasBudget) {
      values.push(t.budget !== null ? rawMoney(t.budget, currency, exchangeRate) : 0);
    }
    const r = s2.addRow(values);
    const isEven = idx % 2 === 0;
    const colCount = hasBudget ? 10 : 9;
    for (let i = 1; i <= colCount; i++) {
      const cell = r.getCell(i);
      cell.border = thinCellBorder();
      if (isEven) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
      }
    }
    // Format angka
    for (const col of [6, 7]) r.getCell(col).numFmt = moneyFmt;
    const profitCell = r.getCell(8);
    profitCell.numFmt = moneyFmt;
    profitCell.font = { color: { argb: t.profit < 0 ? C.lossRed : C.profitGreen } };
    r.getCell(9).numFmt = FMT_PCT;
    if (hasBudget) r.getCell(10).numFmt = moneyFmt;
    r.getCell(1).alignment = { horizontal: "right" };
    for (const col of [2, 3, 4, 5]) r.getCell(col).alignment = { horizontal: "left" };
    for (const col of [6, 7, 8, 9]) r.getCell(col).alignment = { horizontal: "right" };
    if (hasBudget) r.getCell(10).alignment = { horizontal: "right" };
  });

  // TOTAL KESELURUHAN dengan rumus hidup
  const dataStart = 2;
  const dataEnd = s2.rowCount;
  const totalVals: (string | number)[] = [
    "",
    "TOTAL KESELURUHAN",
    "",
    "",
    "",
    `=SUM(F${dataStart}:F${dataEnd})`,
    `=SUM(G${dataStart}:G${dataEnd})`,
    `=SUM(H${dataStart}:H${dataEnd})`,
    `=IF(F${dataEnd + 1}>0,H${dataEnd + 1}/F${dataEnd + 1},0)`,
  ];
  if (hasBudget) totalVals.push(`=SUM(J${dataStart}:J${dataEnd})`);
  const txTotalRow = s2.addRow(totalVals);
  for (let i = 1; i <= (hasBudget ? 10 : 9); i++) {
    const cell = txTotalRow.getCell(i);
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.totalFill } };
    cell.border = thinCellBorder();
    if (i === 6 || i === 7 || i === 8 || (hasBudget && i === 10)) cell.numFmt = moneyFmt;
    if (i === 9) cell.numFmt = FMT_PCT;
  }
  txTotalRow.getCell(2).alignment = { horizontal: "left" };

  // Auto width (panjang konten terpanjang + padding) agar tak ada ###/teks terpotong
  autoWidth(s2);
  autoWidth(s1);

  // Tulis ke buffer & unduh
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finboard-laporan-${format(today, "yyyy-MM-dd")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Border tipis warna terang (untuk tabel KPI / P&L). */
function thinBorder(strong = false) {
  const color = strong ? { argb: C.borderCell } : { argb: C.borderLight };
  return {
    top: { style: "thin" as const, color },
    left: { style: "thin" as const, color },
    bottom: { style: "thin" as const, color },
    right: { style: "thin" as const, color },
  };
}

/** Border tipis untuk sel data tabel transaksi. */
function thinCellBorder() {
  const color = { argb: C.borderCell };
  return {
    top: { style: "thin" as const, color },
    left: { style: "thin" as const, color },
    bottom: { style: "thin" as const, color },
    right: { style: "thin" as const, color },
  };
}

/** Atur lebar kolom otomatis sesuai panjang konten terpanjang + padding. */
function autoWidth(ws: import("exceljs").Worksheet): void {
  ws.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const val = cell.value;
      let text = "";
      if (val === null || val === undefined) text = "";
      else if (typeof val === "object" && "formula" in val) {
        // Rumus: pakai perkiraan panjang hasil (angka besar)
        text = "999,999,999";
      } else {
        text = String(val);
      }
      // Untuk sel berformat mata uang, tambahkan ruang simbol & pemisah ribuan
      if (cell.numFmt && cell.numFmt.includes("#,##0")) text = "  " + text;
      if (text.length > maxLen) maxLen = text.length;
    });
    column.width = Math.min(Math.max(maxLen + 3, 10), 60);
  });
}
