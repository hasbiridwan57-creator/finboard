"use client";

/**
 * excelExporter — ekspor laporan .xlsx profesional via exceljs (lazy-load).
 * Modul di-import dinamis agar tidak membebani bundle awal dashboard:
 *   const ExcelJS = (await import("exceljs")).default;
 * Hanya dimuat saat user mengeklik "Ekspor Excel (.xlsx)".
 *
 * Laporan 5 worksheet:
 *   1. Ringkasan & P&L   — kop + KPI + P&L bulanan + grafik cell-bar + insight
 *   2. Analisis Segmen   — profit/revenue/margin per Kategori/Departemen/Kanal
 *   3. Realisasi Budget  — revenue aktual vs anggaran + selisih + status
 *   4. Ringkasan USD     — (muncul saat mode USD) ringkasan USD utk pihak asing
 *   5. Data Transaksi    — data mentah per transaksi (AutoFilter + freeze panes)
 */
import type {
  NormalizedTransaction,
} from "@/lib/types";
import type { MonthlyPoint } from "@/lib/chartAggregator";
import { aggregateByDimension2 } from "@/lib/chartAggregator";
import { computeKpi } from "@/lib/kpiCalculator";
import { generateInsights } from "@/lib/insightGenerator";
import { format } from "date-fns";
import type { CurrencyMode } from "@/store/finBoardStore";
import type ExcelJSNS from "exceljs";

/** Format angka mata uang asli Excel (bukan string, agar bisa dihitung). */
const FMT_IDR = '"Rp "#,##0;-"Rp "#,##0';
const FMT_USD = '"$"#,##0.00;-"$"#,##0.00';
const FMT_PCT = "0.0%";
const FMT_VARIANCE = '"Rp "#,##0;[Red]-"Rp "#,##0';
const BAR_CHAR = "\u2588"; // █

/** Warna tema Light Clean Bright FinBoard. */
const C = {
  titleBlue: "FF0F172A",
  headerBlue: "FF2563EB",
  headerText: "FFFFFFFF",
  borderLight: "FFE2E8F0",
  borderCell: "FFCBD5E1",
  profitGreen: "FF16A34A",
  lossRed: "FFDC2626",
  zebra: "FFF8FAFC",
  totalFill: "FFF1F5F9",
  white: "FFFFFFFF",
  barBlue: "FF93C5FD",
  statusGreen: "FFDCFCE7",
  statusGreenText: "FF15803D",
  statusRed: "FFFEE2E2",
  warnAmber: "FFB45309",
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

/** Konversi string insight ber-markdown `**bold**` menjadi richText bold asli Excel. */
function insightToRichText(
  text: string,
  colorArgb: string,
  size: number,
): ExcelJSNS.CellRichTextValue {
  const parts: ExcelJSNS.RichText[] = [];
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  for (const seg of segments) {
    if (!seg) continue;
    if (seg.startsWith("**") && seg.endsWith("**")) {
      parts.push({
        text: seg.slice(2, -2),
        font: { bold: true, size, color: { argb: C.titleBlue } },
      });
    } else {
      parts.push({ text: seg, font: { size, color: { argb: colorArgb } } });
    }
  }
  return { richText: parts };
}

/** Bangun & unduh file .xlsx. Aman dipanggil dari client component. Lazy-load exceljs. */
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

  // Header/footer print (dipakai semua sheet)
  const headerFooter = {
    oddHeader: `&L&"Arial,Bold"FinBoard — Laporan Keuangan&R&"Arial"Diekspor ${format(today, "dd MMM yyyy")}`,
    oddFooter: `&L${fileName}&RHalaman &P dari &N`,
  };

  /* ==================================================================
   * SHEET 1 — "Ringkasan & P&L"
   * ================================================================== */
  const s1 = wb.addWorksheet("Ringkasan & P&L", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true },
    headerFooter,
    properties: { defaultRowHeight: 18 },
  });
  s1.columns = [
    { width: 34 }, { width: 20 }, { width: 20 }, { width: 20 },
    { width: 16 }, { width: 18 }, { width: 40 },
  ];

  const spacerRow = s1.addRow([]);
  spacerRow.height = 6;
  const titleRow = s1.addRow(["LAPORAN ANALITIK KEUANGAN - FINBOARD"]);
  s1.mergeCells(titleRow.number, 1, titleRow.number, 7);
  const titleCell = titleRow.getCell(1);
  titleCell.font = { bold: true, size: 16, color: { argb: C.titleBlue } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  titleRow.height = 28;

  // Ringkasan periode
  const periodStart = txs.length > 0 ? txs[txs.length - 1].date : "-";
  const periodEnd = txs.length > 0 ? txs[0].date : "-";
  const infoRows: [string, string][] = [
    ["Sumber Data", fileName],
    ["Tanggal Ekspor", format(today, "dd MMM yyyy")],
    ["Mata Uang", currencyLabel],
    ["Periode Data", `${periodStart} s.d. ${periodEnd} (${txs.length} transaksi)`],
    ["Filter Aktif", filterDesc],
  ];
  for (const [label, val] of infoRows) {
    const r = s1.addRow([label, val]);
    r.getCell(1).font = { bold: true, color: { argb: "FF64748B" } };
    r.getCell(1).alignment = { vertical: "middle" };
    r.getCell(2).alignment = { vertical: "middle", wrapText: true };
  }
  s1.addRow([]);

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
    cell.border = thinBorder();
  }
  const kpiRows: [string, number, "money" | "pct"][] = [
    ["Total Revenue", kpi.totalRevenue, "money"],
    ["Total Expenses", kpi.totalExpenses, "money"],
    ["Total Profit", kpi.totalProfit, "money"],
    ["Profit Margin", kpi.profitMargin / 100, "pct"],
  ];
  for (const [label, val, kind] of kpiRows) {
    const r = s1.addRow([label, val]);
    r.getCell(1).border = thinBorder();
    const vc = r.getCell(2);
    vc.numFmt = kind === "pct" ? FMT_PCT : moneyFmt;
    vc.border = thinBorder();
    if (label === "Total Profit") {
      vc.font = { bold: true, color: { argb: val < 0 ? C.lossRed : C.profitGreen } };
    }
  }
  s1.addRow([]);

  // --- Laporan Laba Rugi Bulanan (Monthly P&L) + cell-bar revenue ---
  const pnlHeader = s1.addRow(["LAPORAN LABA RUGI BULANAN"]);
  s1.mergeCells(pnlHeader.number, 1, pnlHeader.number, 7);
  pnlHeader.getCell(1).font = { bold: true, size: 12, color: { argb: C.titleBlue } };

  const pnlCols: string[] = ["Bulan", "Revenue", "Expenses", "Net Profit", "Margin (%)"];
  if (hasBudget) pnlCols.push("Budget");
  pnlCols.push("Grafik Revenue");
  const pnlTableHeader = s1.addRow(pnlCols);
  const pnlColCount = pnlCols.length;
  for (let i = 1; i <= pnlColCount; i++) {
    const cell = pnlTableHeader.getCell(i);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBlue } };
    cell.font = { bold: true, color: { argb: C.headerText } };
    cell.alignment = { horizontal: i === 1 ? "left" : "right" };
    cell.border = thinBorder();
  }

  const pnlStartRow = pnlTableHeader.number + 1;
  const maxMonthlyRevenue = Math.max(...monthly.map((m) => m.revenue), 1);
  for (const m of monthly) {
    const marginPct = m.revenue > 0 ? m.profit / m.revenue : 0;
    const barLen = Math.round((m.revenue / maxMonthlyRevenue) * 20);
    const bar = BAR_CHAR.repeat(Math.max(barLen, 1));
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
    values.push(bar);
    const r = s1.addRow(values);
    r.getCell(1).border = thinBorder();
    r.getCell(2).numFmt = moneyFmt;
    r.getCell(3).numFmt = moneyFmt;
    const profitCell = r.getCell(4);
    profitCell.numFmt = moneyFmt;
    profitCell.font = { color: { argb: m.profit < 0 ? C.lossRed : C.profitGreen } };
    r.getCell(5).numFmt = FMT_PCT;
    if (hasBudget) r.getCell(6).numFmt = moneyFmt;
    const barCell = r.getCell(pnlColCount);
    barCell.font = { color: { argb: C.barBlue } };
    for (let i = 1; i <= pnlColCount; i++) r.getCell(i).border = thinBorder();
  }
  const pnlEndRow = s1.rowCount;

  // Baris Total dengan rumus Excel aktif =SUM(...)
  const sumFormula = (col: number) =>
    `=SUM(${colLetter(col)}${pnlStartRow}:${colLetter(col)}${pnlEndRow})`;
  const totalRow = s1.addRow([
    "Total",
    sumFormula(2),
    sumFormula(3),
    sumFormula(4),
    `=IF(${colLetter(2)}${pnlEndRow + 1}>0,${colLetter(4)}${pnlEndRow + 1}/${colLetter(2)}${pnlEndRow + 1},0)`,
    ...(hasBudget ? [sumFormula(6)] : []),
    "",
  ]);
  for (let i = 1; i <= pnlColCount; i++) {
    const cell = totalRow.getCell(i);
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.totalFill } };
    cell.border = thinBorder(true);
    if (i === 2 || i === 3 || i === 4 || (hasBudget && i === 6)) cell.numFmt = moneyFmt;
    if (i === 5) cell.numFmt = FMT_PCT;
  }

  // Conditional formatting: profit negatif merah, margin rendah highlight
  s1.addConditionalFormatting({
    ref: `D${pnlStartRow}:D${pnlEndRow}`,
    rules: [{
      type: "cellIs", operator: "lessThan", formulae: [0], priority: 1,
      style: { font: { color: { argb: C.lossRed }, bold: true } },
    }],
  });
  s1.addConditionalFormatting({
    ref: `E${pnlStartRow}:E${pnlEndRow}`,
    rules: [{
      type: "cellIs", operator: "lessThan", formulae: [0.2], priority: 2,
      style: { font: { color: { argb: C.warnAmber }, bold: true } },
    }],
  });
  s1.addRow([]);

  // --- Ringkasan Insight Bisnis Otomatis (rich text, tanpa ** nyasar) ---
  const insights = generateInsights(txs, currency, exchangeRate);
  if (insights.length > 0) {
    const insHeader = s1.addRow(["RINGKASAN INSIGHT BISNIS OTOMATIS"]);
    s1.mergeCells(insHeader.number, 1, insHeader.number, 7);
    insHeader.getCell(1).font = { bold: true, size: 12, color: { argb: C.titleBlue } };
    for (const ins of insights) {
      const color =
        ins.tone === "positive" ? C.profitGreen : ins.tone === "warning" ? C.lossRed : C.titleBlue;
      const rich = insightToRichText(`• ${ins.text}`, color, 10);
      const r = s1.addRow([rich]);
      s1.mergeCells(r.number, 1, r.number, 7);
      r.getCell(1).alignment = { wrapText: true, vertical: "middle" };
    }
  }

  /* ==================================================================
   * SHEET 2 — "Analisis Segmen"
   * ================================================================== */
  const s2 = wb.addWorksheet("Analisis Segmen", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    headerFooter,
  });
  s2.columns = [{ width: 24 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 32 }];

  const segTitle = s2.addRow(["ANALISIS PROFIT & MARGIN PER SEGMEN"]);
  s2.mergeCells(segTitle.number, 1, segTitle.number, 6);
  segTitle.getCell(1).font = { bold: true, size: 14, color: { argb: C.titleBlue } };
  s2.addRow([]);

  const segCols = ["Nama", "Revenue", "Expenses", "Profit", "Margin (%)", "Grafik Profit"];
  for (const dim of [
    { key: "category" as const, label: "KATEGORI" },
    { key: "department" as const, label: "DEPARTEMEN" },
    { key: "channel" as const, label: "KANAL PENJUALAN" },
  ]) {
    const h = s2.addRow([segCols.join("") && dim.label]);
    s2.mergeCells(h.number, 1, h.number, 6);
    h.getCell(1).font = { bold: true, size: 12, color: { argb: C.headerBlue } };
    const th = s2.addRow(segCols);
    for (let i = 1; i <= 6; i++) {
      const cell = th.getCell(i);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBlue } };
      cell.font = { bold: true, color: { argb: C.headerText } };
      cell.alignment = { horizontal: i === 1 ? "left" : "right" };
      cell.border = thinBorder();
    }
    const pts = aggregateByDimension2(txs, dim.key, 10);
    const startRow = th.number + 1;
    const maxProfit = Math.max(...pts.map((p) => Math.abs(p.profit)), 1);
    for (const p of pts) {
      const margin = p.revenue > 0 ? p.profit / p.revenue : 0;
      const barLen = Math.round((Math.abs(p.profit) / maxProfit) * 18);
      const bar = p.profit >= 0 ? BAR_CHAR.repeat(Math.max(barLen, 1)) : "";
      const r = s2.addRow([
        p.name,
        rawMoney(p.revenue, currency, exchangeRate),
        rawMoney(p.revenue - p.profit, currency, exchangeRate),
        rawMoney(p.profit, currency, exchangeRate),
        margin,
        bar,
      ]);
      r.getCell(2).numFmt = moneyFmt;
      r.getCell(3).numFmt = moneyFmt;
      r.getCell(4).numFmt = moneyFmt;
      r.getCell(4).font = { color: { argb: p.profit < 0 ? C.lossRed : C.profitGreen } };
      r.getCell(5).numFmt = FMT_PCT;
      r.getCell(6).font = { color: { argb: p.profit < 0 ? C.lossRed : C.barBlue } };
      for (let i = 1; i <= 6; i++) r.getCell(i).border = thinBorder();
    }
    const endRow = s2.rowCount;
    // CF: profit negatif merah + margin rendah amber
    s2.addConditionalFormatting({
      ref: `D${startRow}:D${endRow}`,
      rules: [{ type: "cellIs", operator: "lessThan", formulae: [0], priority: 3, style: { font: { color: { argb: C.lossRed }, bold: true } } }],
    });
    s2.addConditionalFormatting({
      ref: `E${startRow}:E${endRow}`,
      rules: [{ type: "cellIs", operator: "lessThan", formulae: [0.2], priority: 4, style: { font: { color: { argb: C.warnAmber } } } }],
    });
    s2.addRow([]);
  }

  /* ==================================================================
   * SHEET 3 — "Realisasi Budget" (hanya jika ada data budget)
   * ================================================================== */
  if (hasBudget) {
    const s3 = wb.addWorksheet("Realisasi Budget", {
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      headerFooter,
    });
    s3.columns = [{ width: 16 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 14 }, { width: 18 }];

    const t3 = s3.addRow(["REALISASI REVENUE vs ANGGARAN"]);
    s3.mergeCells(t3.number, 1, t3.number, 6);
    t3.getCell(1).font = { bold: true, size: 14, color: { argb: C.titleBlue } };
    s3.addRow([]);

    const cols3 = ["Bulan", "Revenue Aktual", "Anggaran", "Selisih", "Capaian (%)", "Status"];
    const th3 = s3.addRow(cols3);
    for (let i = 1; i <= 6; i++) {
      const cell = th3.getCell(i);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBlue } };
      cell.font = { bold: true, color: { argb: C.headerText } };
      cell.alignment = { horizontal: i === 1 || i === 6 ? "left" : "right" };
      cell.border = thinBorder();
    }
    const start3 = th3.number + 1;
    const bRows = monthly.filter((m) => m.budget !== null);
    for (const m of bRows) {
      const budgetV = m.budget !== null ? rawMoney(m.budget, currency, exchangeRate) : 0;
      const actualV = rawMoney(m.revenue, currency, exchangeRate);
      const r = s3.addRow([
        m.label,
        actualV,
        budgetV,
        `=B${s3.rowCount + 1}-C${s3.rowCount + 1}`,
        `=IF(C${s3.rowCount + 1}>0,B${s3.rowCount + 1}/C${s3.rowCount + 1},0)`,
        "",
      ]);
      r.getCell(2).numFmt = moneyFmt;
      r.getCell(3).numFmt = moneyFmt;
      r.getCell(4).numFmt = FMT_VARIANCE;
      r.getCell(5).numFmt = FMT_PCT;
      for (let i = 1; i <= 6; i++) r.getCell(i).border = thinBorder();
    }
    const end3 = s3.rowCount;
    // Status: tercapai / meleset (formula, agar hidup)
    for (let r = start3; r <= end3; r++) {
      s3.getCell(r, 6).value = `=IF(B${r}>=C${r},"Tercapai","Meleset")`;
      s3.getCell(r, 6).alignment = { horizontal: "left" };
    }
    // CF status: hijau jika "Tercapai", merah jika "Meleset"
    s3.addConditionalFormatting({
      ref: `F${start3}:F${end3}`,
      rules: [
        { type: "containsText", operator: "containsText", text: "Tercapai", priority: 5, style: { font: { color: { argb: C.statusGreenText }, bold: true }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: C.statusGreen } } } },
        { type: "containsText", operator: "containsText", text: "Meleset", priority: 6, style: { font: { color: { argb: C.lossRed }, bold: true }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: C.statusRed } } } },
      ],
    });
    // Baris total realisasi
    const tr3 = s3.addRow([
      "Total",
      `=SUM(B${start3}:B${end3})`,
      `=SUM(C${start3}:C${end3})`,
      `=SUM(D${start3}:D${end3})`,
      `=IF(C${end3 + 1}>0,B${end3 + 1}/C${end3 + 1},0)`,
      `=IF(B${end3 + 1}>=C${end3 + 1},"Tercapai","Meleset")`,
    ]);
    for (let i = 1; i <= 6; i++) {
      const cell = tr3.getCell(i);
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.totalFill } };
      cell.border = thinBorder(true);
      if (i >= 2 && i <= 4) cell.numFmt = i === 4 ? FMT_VARIANCE : moneyFmt;
      if (i === 5) cell.numFmt = FMT_PCT;
    }
    // Data bar pada kolom capaian
    s3.addConditionalFormatting({
      ref: `E${start3}:E${end3}`,
      rules: [{
        type: "dataBar", priority: 7,
        cfvo: [{ type: "num", value: 0 }, { type: "num", value: 1.5 }],
        // Runtime exceljs mendukung 'color' untuk dataBar; .d.ts belum mendeklarasikan → cast.
        ...({ color: { argb: C.barBlue }, gradient: false } as Record<string, unknown>),
      }],
    });
  }

  /* ==================================================================
   * SHEET 4 — "Ringkasan USD" (hanya saat mode USD — untuk pihak asing)
   * ================================================================== */
  if (currency === "USD") {
    const su = wb.addWorksheet("Ringkasan USD", {
      pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      headerFooter,
    });
    su.columns = [{ width: 28 }, { width: 18 }];
    const tu = su.addRow(["RINGKASAN EKSEKUTIF (USD)"]);
    su.mergeCells(tu.number, 1, tu.number, 2);
    tu.getCell(1).font = { bold: true, size: 14, color: { argb: C.titleBlue } };
    su.addRow([`Konversi indikatif 1 USD = Rp ${exchangeRate.toFixed(0)}`]).getCell(1).font = { italic: true, color: { argb: "FF64748B" } };
    su.addRow([]);
    const thu = su.addRow(["Metrik", "Nilai (USD)"]);
    for (const c of [1, 2]) {
      const cell = thu.getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBlue } };
      cell.font = { bold: true, color: { argb: C.headerText } };
      cell.border = thinBorder();
    }
    const rowsU: [string, number, "money" | "pct"][] = [
      ["Total Revenue", kpi.totalRevenue / exchangeRate, "money"],
      ["Total Expenses", kpi.totalExpenses / exchangeRate, "money"],
      ["Total Profit", kpi.totalProfit / exchangeRate, "money"],
      ["Profit Margin", kpi.profitMargin / 100, "pct"],
    ];
    for (const [label, val, kind] of rowsU) {
      const r = su.addRow([label, val]);
      r.getCell(1).border = thinBorder();
      r.getCell(2).numFmt = kind === "pct" ? FMT_PCT : FMT_USD;
      r.getCell(2).border = thinBorder();
    }
  }

  /* ==================================================================
   * SHEET 5 — "Data Transaksi"
   * ================================================================== */
  const s5 = wb.addWorksheet("Data Transaksi", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1" },
    headerFooter,
  });

  const txCols: string[] = ["No", "Tanggal", "Kategori", "Departemen", "Kanal Penjualan", "Revenue", "Expenses", "Profit", "Margin (%)"];
  if (hasBudget) txCols.push("Budget");
  s5.columns = txCols.map((header) => ({ header }));

  const txHeader = s5.getRow(1);
  for (let i = 1; i <= txCols.length; i++) {
    const cell = txHeader.getCell(i);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBlue } };
    cell.font = { bold: true, color: { argb: C.headerText } };
    cell.alignment = { vertical: "middle", horizontal: i <= 5 ? "left" : "right" };
    cell.border = thinCellBorder();
  }
  txHeader.height = 22;
  s5.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: txCols.length } };

  txs.forEach((t, idx) => {
    const marginPct = t.revenue > 0 ? t.profit / t.revenue : 0;
    const values: (string | number)[] = [
      idx + 1, t.date, t.category, t.department, t.channel,
      rawMoney(t.revenue, currency, exchangeRate),
      rawMoney(t.expenses, currency, exchangeRate),
      rawMoney(t.profit, currency, exchangeRate),
      marginPct,
    ];
    if (hasBudget) values.push(t.budget !== null ? rawMoney(t.budget, currency, exchangeRate) : 0);
    const r = s5.addRow(values);
    const isEven = idx % 2 === 0;
    const colCount = hasBudget ? 10 : 9;
    for (let i = 1; i <= colCount; i++) {
      const cell = r.getCell(i);
      cell.border = thinCellBorder();
      if (isEven) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
    }
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

  const dataStart = 2;
  const dataEnd = s5.rowCount;
  const totalVals: (string | number)[] = [
    "", "TOTAL KESELURUHAN", "", "", "",
    `=SUM(F${dataStart}:F${dataEnd})`,
    `=SUM(G${dataStart}:G${dataEnd})`,
    `=SUM(H${dataStart}:H${dataEnd})`,
    `=IF(F${dataEnd + 1}>0,H${dataEnd + 1}/F${dataEnd + 1},0)`,
  ];
  if (hasBudget) totalVals.push(`=SUM(J${dataStart}:J${dataEnd})`);
  const txTotalRow = s5.addRow(totalVals);
  for (let i = 1; i <= (hasBudget ? 10 : 9); i++) {
    const cell = txTotalRow.getCell(i);
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.totalFill } };
    cell.border = thinCellBorder();
    if (i === 6 || i === 7 || i === 8 || (hasBudget && i === 10)) cell.numFmt = moneyFmt;
    if (i === 9) cell.numFmt = FMT_PCT;
  }
  txTotalRow.getCell(2).alignment = { horizontal: "left" };

  autoWidth(s5);
  autoWidth(s2);
  autoWidth(s1);

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

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function thinBorder(strong = false) {
  const color = strong ? { argb: C.borderCell } : { argb: C.borderLight };
  return {
    top: { style: "thin" as const, color },
    left: { style: "thin" as const, color },
    bottom: { style: "thin" as const, color },
    right: { style: "thin" as const, color },
  };
}

function thinCellBorder() {
  const color = { argb: C.borderCell };
  return {
    top: { style: "thin" as const, color },
    left: { style: "thin" as const, color },
    bottom: { style: "thin" as const, color },
    right: { style: "thin" as const, color },
  };
}

function autoWidth(ws: import("exceljs").Worksheet): void {
  ws.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const val = cell.value;
      let text = "";
      if (val === null || val === undefined) text = "";
      else if (typeof val === "object" && "formula" in val) text = "999,999,999";
      else if (typeof val === "object" && "richText" in val) {
        text = (val as ExcelJSNS.CellRichTextValue).richText.map((p) => p.text).join("");
      } else text = String(val);
      if (cell.numFmt && cell.numFmt.includes("#,##0")) text = "  " + text;
      if (text.length > maxLen) maxLen = text.length;
    });
    column.width = Math.min(Math.max(maxLen + 3, 10), 60);
  });
}
