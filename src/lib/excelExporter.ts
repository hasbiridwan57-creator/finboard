"use client";

/**
 * excelExporter — ekspor laporan .xlsx profesional via exceljs (lazy-load).
 * Modul di-import dinamis agar tidak membebani bundle awal dashboard:
 *   const ExcelJS = (await import("exceljs")).default;
 * Hanya dimuat saat user mengeklik "Ekspor Excel (.xlsx)".
 *
 * Laporan 5 worksheet + GRAFIK PNG ASLI (dirender via Canvas API browser):
 *   1. Ringkasan & P&L   — kop + KPI + P&L bulanan + LINE chart profit + BAR revenue vs budget + insight
 *   2. Analisis Segmen   — PIE profit per kategori + tabel Kategori/Departemen/Kanal
 *   3. Realisasi Budget  — BAR aktual vs anggaran + tabel selisih/capaian/status
 *   4. Ringkasan USD     — (muncul saat mode USD) ringkasan USD utk pihak asing
 *   5. Data Transaksi    — data mentah per transaksi (AutoFilter + freeze panes)
 *
 * PENTING: Semua angka ditulis sebagai NILAI HASIL HITUNG (bukan rumus =SUM/=IF),
 * agar langsung tampil saat file dibuka — tidak ada rumus "belum ke-enter".
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

/** Warna tema Light Clean Bright FinBoard (argb, untuk sel Excel). */
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
  barLight: "FF93C5FD",
  statusGreen: "FFDCFCE7",
  statusGreenText: "FF15803D",
  statusRed: "FFFEE2E2",
  warnAmber: "FFB45309",
} as const;

/** Palet warna chart (string CSS hex — tanpa alpha prefix). */
const PALETTE = ["#2563EB", "#16A34A", "#F59E0B", "#DC2626", "#8B5CF6", "#06B6D4", "#EC4899", "#84CC16", "#F97316", "#64748B"];

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
      parts.push({ text: seg.slice(2, -2), font: { bold: true, size, color: { argb: C.titleBlue } } });
    } else {
      parts.push({ text: seg, font: { size, color: { argb: colorArgb } } });
    }
  }
  return { richText: parts };
}

/* ==================================================================
 * CHART RENDERER — dirender ke PNG via Canvas API (built-in browser).
 * Return { base64, extension } untuk ExcelJS.addImage().
 * ================================================================== */
interface ChartRender {
  base64: string;
  extension: "png";
}

/** Setup canvas HiDPI dengan latar putih agar tajam di Excel. */
function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, w, h);
  return { canvas, ctx };
}

function toPng(canvas: HTMLCanvasElement): ChartRender {
  return { base64: canvas.toDataURL("image/png").split(",")[1], extension: "png" };
}

/** Format angka ringkas utk label sumbu. */
function fmtShort(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + "M";
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + "jt";
  if (abs >= 1_000) return (v / 1_000).toFixed(0) + "rb";
  return v.toFixed(0);
}

/** Gambar sumbu + gridlines + judul. Return fungsi konversi nilai→pixel-Y. */
function drawAxes(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  pad: { t: number; r: number; b: number; l: number },
  yMax: number, yMin: number, title: string,
): { plotW: number; plotH: number; yToPx: (v: number) => number } {
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#64748B";
  ctx.font = "10px Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 4; i++) {
    const val = yMin + ((yMax - yMin) * i) / 4;
    const y = pad.t + plotH - (plotH * i) / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + plotW, y); ctx.stroke();
    ctx.fillText(fmtShort(val), pad.l - 6, y);
  }
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(title, 6, 4);
  return { plotW, plotH, yToPx: (v: number) => pad.t + plotH - ((v - yMin) / (yMax - yMin)) * plotH };
}

/** LINE chart — tren profit bulanan. */
function renderLineChart(data: { label: string; value: number }[], title: string, color: string): ChartRender {
  const w = 600, h = 230;
  const pad = { t: 24, r: 16, b: 28, l: 56 };
  const { canvas, ctx } = makeCanvas(w, h);
  const vals = data.map((d) => d.value);
  const rawMax = Math.max(...vals, 0), rawMin = Math.min(...vals, 0);
  const range = rawMax - rawMin || 1;
  const yMax = rawMax + range * 0.12, yMin = rawMin - range * 0.12;
  const { plotW, plotH, yToPx } = drawAxes(ctx, w, h, pad, yMax, yMin, title);
  const xStep = data.length > 1 ? plotW / (data.length - 1) : 0;

  if (rawMin < 0) {
    const zy = yToPx(0);
    ctx.strokeStyle = "#94A3B8"; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(pad.l, zy); ctx.lineTo(pad.l + plotW, zy); ctx.stroke();
    ctx.setLineDash([]);
  }
  const pts = data.map((d, i) => ({ x: pad.l + i * xStep, y: yToPx(d.value) }));
  // area
  ctx.beginPath();
  ctx.moveTo(pts[0].x, yToPx(Math.max(rawMin, 0)));
  pts.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, yToPx(Math.max(rawMin, 0)));
  ctx.closePath();
  ctx.fillStyle = color + "1F";
  ctx.fill();
  // garis
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.stroke();
  // titik
  pts.forEach((p, i) => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = data[i].value < 0 ? "#DC2626" : color;
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 1; ctx.stroke();
  });
  // label X
  ctx.fillStyle = "#64748B"; ctx.font = "9px Arial";
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  const skip = Math.ceil(data.length / 6);
  data.forEach((d, i) => {
    if (i % skip === 0 || i === data.length - 1) ctx.fillText(d.label, pts[i].x, pad.t + plotH + 6);
  });
  return toPng(canvas);
}

/** GROUPED BAR — 2 seri (Revenue vs Anggaran / Aktual vs Anggaran). */
function renderGroupedBar(
  data: { label: string; a: number; b: number }[],
  title: string, labelA: string, labelB: string,
  colorA: string, colorB: string,
): ChartRender {
  const w = 600, h = 230;
  const pad = { t: 24, r: 16, b: 28, l: 56 };
  const { canvas, ctx } = makeCanvas(w, h);
  const maxVal = Math.max(...data.flatMap((d) => [d.a, d.b]), 1);
  const { plotW, plotH, yToPx } = drawAxes(ctx, w, h, pad, maxVal * 1.15, 0, title);
  const groupW = plotW / data.length;
  const barW = Math.min(groupW * 0.32, 26);
  const zeroY = yToPx(0);
  data.forEach((d, i) => {
    const cx = pad.l + groupW * i + groupW / 2;
    const yA = yToPx(d.a);
    ctx.fillStyle = colorA; ctx.fillRect(cx - barW - 1, yA, barW, zeroY - yA);
    const yB = yToPx(d.b);
    ctx.fillStyle = colorB; ctx.fillRect(cx + 1, yB, barW, zeroY - yB);
  });
  ctx.fillStyle = "#64748B"; ctx.font = "9px Arial";
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  const skip = Math.ceil(data.length / 6);
  data.forEach((d, i) => {
    if (i % skip === 0 || i === data.length - 1) ctx.fillText(d.label, pad.l + groupW * i + groupW / 2, pad.t + plotH + 6);
  });
  // legend
  ctx.font = "10px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  const lx = pad.l + plotW - 150, ly = pad.t + 4;
  ctx.fillStyle = colorA; ctx.fillRect(lx, ly, 10, 10);
  ctx.fillStyle = "#0F172A"; ctx.fillText(labelA, lx + 14, ly + 5);
  ctx.fillStyle = colorB; ctx.fillRect(lx + 84, ly, 10, 10);
  ctx.fillStyle = "#0F172A"; ctx.fillText(labelB, lx + 98, ly + 5);
  return toPng(canvas);
}

/** PIE/DOUGHNUT — proporsi profit per kategori + legend persentase. */
function renderPieChart(data: { label: string; value: number }[], title: string): ChartRender {
  const w = 600, h = 250;
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 12px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText(title, 6, 4);
  const pos = data.filter((d) => d.value > 0);
  const total = pos.reduce((s, d) => s + d.value, 0) || 1;
  const cx = 180, cy = 145, r = 95, inner = 50;
  let start = -Math.PI / 2;
  pos.forEach((d, i) => {
    const slice = (d.value / total) * Math.PI * 2;
    const end = start + slice;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(start) * inner, cy + Math.sin(start) * inner);
    ctx.arc(cx, cy, r, start, end);
    ctx.arc(cx, cy, inner, end, start, true);
    ctx.closePath();
    ctx.fillStyle = PALETTE[i % PALETTE.length];
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 1.5; ctx.stroke();
    start = end;
  });
  // legend
  const lx = 320; let ly = 44;
  ctx.font = "10px Arial"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
  pos.forEach((d, i) => {
    const pct = ((d.value / total) * 100).toFixed(1);
    ctx.fillStyle = PALETTE[i % PALETTE.length];
    ctx.fillRect(lx, ly - 5, 11, 11);
    ctx.fillStyle = "#0F172A";
    const name = d.label.length > 20 ? d.label.slice(0, 19) + "…" : d.label;
    ctx.fillText(`${name}  ${pct}%`, lx + 16, ly);
    ly += 21;
  });
  return toPng(canvas);
}

/**
 * Bangun & unduh file .xlsx. Aman dipanggil dari client component. Lazy-load exceljs.
 */
export async function exportExcel(opts: ExcelExportOptions): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const { txs, monthly, fileName, currency, exchangeRate, filterDesc, hasBudget } = opts;

  const moneyFmt = currency === "USD" ? FMT_USD : FMT_IDR;
  const currencyLabel =
    currency === "USD" ? `USD (kurs 1 USD = Rp ${exchangeRate.toFixed(0)})` : "IDR";
  const today = new Date();

  const wb = new ExcelJS.Workbook();
  wb.creator = "FinBoard";
  wb.created = today;

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
  s1.columns = [{ width: 34 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 16 }, { width: 18 }];

  const spacerRow = s1.addRow([]);
  spacerRow.height = 6;
  const titleRow = s1.addRow(["LAPORAN ANALITIK KEUANGAN - FINBOARD"]);
  s1.mergeCells(titleRow.number, 1, titleRow.number, 6);
  titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: C.titleBlue } };
  titleRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
  titleRow.height = 28;

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
    if (label === "Total Profit") vc.font = { bold: true, color: { argb: val < 0 ? C.lossRed : C.profitGreen } };
  }
  s1.addRow([]);

  // --- Laporan Laba Rugi Bulanan (nilai langsung) ---
  const pnlHeader = s1.addRow(["LAPORAN LABA RUGI BULANAN"]);
  s1.mergeCells(pnlHeader.number, 1, pnlHeader.number, hasBudget ? 6 : 5);
  pnlHeader.getCell(1).font = { bold: true, size: 12, color: { argb: C.titleBlue } };
  const pnlCols: string[] = ["Bulan", "Revenue", "Expenses", "Net Profit", "Margin (%)"];
  if (hasBudget) pnlCols.push("Budget");
  const pnlTableHeader = s1.addRow(pnlCols);
  const pnlColCount = pnlCols.length;
  for (let i = 1; i <= pnlColCount; i++) {
    const cell = pnlTableHeader.getCell(i);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBlue } };
    cell.font = { bold: true, color: { argb: C.headerText } };
    cell.alignment = { horizontal: i === 1 ? "left" : "right" };
    cell.border = thinBorder();
  }
  let sumRev = 0, sumExp = 0, sumProf = 0, sumBud = 0;
  for (const m of monthly) {
    const marginPct = m.revenue > 0 ? m.profit / m.revenue : 0;
    sumRev += m.revenue; sumExp += m.expenses; sumProf += m.profit;
    const values: (string | number)[] = [
      m.label,
      rawMoney(m.revenue, currency, exchangeRate),
      rawMoney(m.expenses, currency, exchangeRate),
      rawMoney(m.profit, currency, exchangeRate),
      marginPct,
    ];
    if (hasBudget) {
      sumBud += m.budget ?? 0;
      values.push(m.budget !== null ? rawMoney(m.budget, currency, exchangeRate) : 0);
    }
    const r = s1.addRow(values);
    r.getCell(2).numFmt = moneyFmt;
    r.getCell(3).numFmt = moneyFmt;
    const profitCell = r.getCell(4);
    profitCell.numFmt = moneyFmt;
    profitCell.font = { color: { argb: m.profit < 0 ? C.lossRed : C.profitGreen } };
    r.getCell(5).numFmt = FMT_PCT;
    if (hasBudget) r.getCell(6).numFmt = moneyFmt;
    for (let i = 1; i <= pnlColCount; i++) r.getCell(i).border = thinBorder();
  }
  const totalMargin = sumRev > 0 ? sumProf / sumRev : 0;
  const totalVals: (string | number)[] = [
    "Total",
    rawMoney(sumRev, currency, exchangeRate),
    rawMoney(sumExp, currency, exchangeRate),
    rawMoney(sumProf, currency, exchangeRate),
    totalMargin,
  ];
  if (hasBudget) totalVals.push(rawMoney(sumBud, currency, exchangeRate));
  const totalRow = s1.addRow(totalVals);
  for (let i = 1; i <= pnlColCount; i++) {
    const cell = totalRow.getCell(i);
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.totalFill } };
    cell.border = thinBorder(true);
    if (i === 2 || i === 3 || i === 4 || (hasBudget && i === 6)) cell.numFmt = moneyFmt;
    if (i === 5) cell.numFmt = FMT_PCT;
  }
  s1.addRow([]);

  // --- CHART: Line profit bulanan ---
  s1.addRow(["Tren Net Profit Bulanan"]);
  s1.mergeCells(s1.rowCount, 1, s1.rowCount, 6);
  s1.getRow(s1.rowCount).getCell(1).font = { bold: true, size: 12, color: { argb: C.titleBlue } };
  const lineImg = renderLineChart(
    monthly.map((m) => ({ label: m.label.split(" ")[0], value: m.profit })),
    "Tren Net Profit Bulanan", "#2563EB",
  );
  const lineId = wb.addImage(lineImg);
  const lineAnchorRow = s1.rowCount + 1;
  for (let i = 0; i < 12; i++) s1.addRow([]); // ruang gambar
  s1.addImage(lineId, `A${lineAnchorRow}:E${lineAnchorRow + 10}`);
  s1.addRow([]);

  // --- CHART: Bar Revenue vs Budget (jika ada budget) ---
  if (hasBudget) {
    s1.addRow(["Revenue vs Anggaran Bulanan"]);
    s1.mergeCells(s1.rowCount, 1, s1.rowCount, 6);
    s1.getRow(s1.rowCount).getCell(1).font = { bold: true, size: 12, color: { argb: C.titleBlue } };
    const barImg = renderGroupedBar(
      monthly.map((m) => ({ label: m.label.split(" ")[0], a: m.revenue, b: m.budget ?? 0 })),
      "Revenue vs Anggaran", "Revenue", "Anggaran", "#2563EB", "#94A3B8",
    );
    const barId = wb.addImage(barImg);
    const barAnchorRow = s1.rowCount + 1;
    for (let i = 0; i < 12; i++) s1.addRow([]);
    s1.addImage(barId, `A${barAnchorRow}:E${barAnchorRow + 10}`);
    s1.addRow([]);
  }

  // --- Ringkasan Insight ---
  const insights = generateInsights(txs, currency, exchangeRate);
  if (insights.length > 0) {
    const insHeader = s1.addRow(["RINGKASAN INSIGHT BISNIS OTOMATIS"]);
    s1.mergeCells(insHeader.number, 1, insHeader.number, 6);
    insHeader.getCell(1).font = { bold: true, size: 12, color: { argb: C.titleBlue } };
    for (const ins of insights) {
      const color = ins.tone === "positive" ? C.profitGreen : ins.tone === "warning" ? C.lossRed : C.titleBlue;
      const rich = insightToRichText(`• ${ins.text}`, color, 10);
      const r = s1.addRow([rich]);
      s1.mergeCells(r.number, 1, r.number, 6);
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
  s2.columns = [{ width: 26 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 14 }];

  const segTitle = s2.addRow(["ANALISIS PROFIT & MARGIN PER SEGMEN"]);
  s2.mergeCells(segTitle.number, 1, segTitle.number, 5);
  segTitle.getCell(1).font = { bold: true, size: 14, color: { argb: C.titleBlue } };
  s2.addRow([]);

  // PIE chart profit per kategori di atas
  const catPts = aggregateByDimension2(txs, "category", 10);
  if (catPts.length > 0) {
    s2.addRow(["Proporsi Profit per Kategori"]);
    s2.mergeCells(s2.rowCount, 1, s2.rowCount, 5);
    s2.getRow(s2.rowCount).getCell(1).font = { bold: true, size: 12, color: { argb: C.titleBlue } };
    const pieImg = renderPieChart(
      catPts.map((p) => ({ label: p.name, value: p.profit })),
      "Proporsi Profit per Kategori",
    );
    const pieId = wb.addImage(pieImg);
    const pieAnchorRow = s2.rowCount + 1;
    for (let i = 0; i < 13; i++) s2.addRow([]);
    s2.addImage(pieId, `A${pieAnchorRow}:E${pieAnchorRow + 11}`);
    s2.addRow([]);
  }

  const segCols = ["Nama", "Revenue", "Expenses", "Profit", "Margin (%)"];
  for (const dim of [
    { key: "category" as const, label: "KATEGORI" },
    { key: "department" as const, label: "DEPARTEMEN" },
    { key: "channel" as const, label: "KANAL PENJUALAN" },
  ]) {
    const h = s2.addRow([dim.label]);
    s2.mergeCells(h.number, 1, h.number, 5);
    h.getCell(1).font = { bold: true, size: 12, color: { argb: C.headerBlue } };
    const th = s2.addRow(segCols);
    for (let i = 1; i <= 5; i++) {
      const cell = th.getCell(i);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBlue } };
      cell.font = { bold: true, color: { argb: C.headerText } };
      cell.alignment = { horizontal: i === 1 ? "left" : "right" };
      cell.border = thinBorder();
    }
    const pts = aggregateByDimension2(txs, dim.key, 10);
    const startRow = th.number + 1;
    for (const p of pts) {
      const margin = p.revenue > 0 ? p.profit / p.revenue : 0;
      const r = s2.addRow([
        p.name,
        rawMoney(p.revenue, currency, exchangeRate),
        rawMoney(p.revenue - p.profit, currency, exchangeRate),
        rawMoney(p.profit, currency, exchangeRate),
        margin,
      ]);
      r.getCell(2).numFmt = moneyFmt;
      r.getCell(3).numFmt = moneyFmt;
      r.getCell(4).numFmt = moneyFmt;
      r.getCell(4).font = { color: { argb: p.profit < 0 ? C.lossRed : C.profitGreen } };
      r.getCell(5).numFmt = FMT_PCT;
      for (let i = 1; i <= 5; i++) r.getCell(i).border = thinBorder();
    }
    const endRow = s2.rowCount;
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
    s3.columns = [{ width: 16 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 14 }, { width: 16 }];
    const t3 = s3.addRow(["REALISASI REVENUE vs ANGGARAN"]);
    s3.mergeCells(t3.number, 1, t3.number, 6);
    t3.getCell(1).font = { bold: true, size: 14, color: { argb: C.titleBlue } };
    s3.addRow([]);

    // BAR chart aktual vs anggaran di atas
    const budData3 = monthly.filter((m) => m.budget !== null).map((m) => ({ label: m.label.split(" ")[0], a: m.revenue, b: m.budget ?? 0 }));
    if (budData3.length > 0) {
      s3.addRow(["Revenue Aktual vs Anggaran"]);
      s3.mergeCells(s3.rowCount, 1, s3.rowCount, 6);
      s3.getRow(s3.rowCount).getCell(1).font = { bold: true, size: 12, color: { argb: C.titleBlue } };
      const barImg3 = renderGroupedBar(budData3, "Revenue Aktual vs Anggaran", "Aktual", "Anggaran", "#2563EB", "#94A3B8");
      const barId3 = wb.addImage(barImg3);
      const b3AnchorRow = s3.rowCount + 1;
      for (let i = 0; i < 13; i++) s3.addRow([]);
      s3.addImage(barId3, `A${b3AnchorRow}:E${b3AnchorRow + 11}`);
      s3.addRow([]);
    }

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
      const actualV = rawMoney(m.revenue, currency, exchangeRate);
      const budgetV = rawMoney(m.budget ?? 0, currency, exchangeRate);
      const selisih = actualV - budgetV;
      const capaian = budgetV > 0 ? actualV / budgetV : 0;
      const status = m.revenue >= (m.budget ?? 0) ? "Tercapai" : "Meleset";
      const r = s3.addRow([m.label, actualV, budgetV, selisih, capaian, status]);
      r.getCell(2).numFmt = moneyFmt;
      r.getCell(3).numFmt = moneyFmt;
      r.getCell(4).numFmt = FMT_VARIANCE;
      r.getCell(5).numFmt = FMT_PCT;
      r.getCell(6).alignment = { horizontal: "left" };
      for (let i = 1; i <= 6; i++) r.getCell(i).border = thinBorder();
    }
    const end3 = s3.rowCount;
    s3.addConditionalFormatting({
      ref: `F${start3}:F${end3}`,
      rules: [
        { type: "containsText", operator: "containsText", text: "Tercapai", priority: 5, style: { font: { color: { argb: C.statusGreenText }, bold: true }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: C.statusGreen } } } },
        { type: "containsText", operator: "containsText", text: "Meleset", priority: 6, style: { font: { color: { argb: C.lossRed }, bold: true }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: C.statusRed } } } },
      ],
    });
    let tAct = 0, tBud = 0;
    for (const m of bRows) { tAct += m.revenue; tBud += m.budget ?? 0; }
    const tr3 = s3.addRow([
      "Total",
      rawMoney(tAct, currency, exchangeRate),
      rawMoney(tBud, currency, exchangeRate),
      rawMoney(tAct, currency, exchangeRate) - rawMoney(tBud, currency, exchangeRate),
      tBud > 0 ? tAct / tBud : 0,
      tAct >= tBud ? "Tercapai" : "Meleset",
    ]);
    for (let i = 1; i <= 6; i++) {
      const cell = tr3.getCell(i);
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.totalFill } };
      cell.border = thinBorder(true);
      if (i >= 2 && i <= 4) cell.numFmt = i === 4 ? FMT_VARIANCE : moneyFmt;
      if (i === 5) cell.numFmt = FMT_PCT;
    }
    s3.addConditionalFormatting({
      ref: `E${start3}:E${end3}`,
      rules: [{ type: "dataBar", priority: 7, cfvo: [{ type: "num", value: 0 }, { type: "num", value: 1.5 }], ...({ color: { argb: C.barLight }, gradient: false } as Record<string, unknown>) }],
    });
  }

  /* ==================================================================
   * SHEET 4 — "Ringkasan USD" (hanya saat mode USD)
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

  let txRev = 0, txExp = 0, txProf = 0, txBud = 0;
  txs.forEach((t, idx) => {
    txRev += t.revenue; txExp += t.expenses; txProf += t.profit; txBud += t.budget ?? 0;
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

  const txTotalVals: (string | number)[] = [
    "", "TOTAL KESELURUHAN", "", "", "",
    rawMoney(txRev, currency, exchangeRate),
    rawMoney(txExp, currency, exchangeRate),
    rawMoney(txProf, currency, exchangeRate),
    txRev > 0 ? txProf / txRev : 0,
  ];
  if (hasBudget) txTotalVals.push(rawMoney(txBud, currency, exchangeRate));
  const txTotalRow = s5.addRow(txTotalVals);
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
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finboard-laporan-${format(today, "yyyy-MM-dd")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function thinBorder(strong = false) {
  const color = strong ? { argb: C.borderCell } : { argb: C.borderLight };
  return { top: { style: "thin" as const, color }, left: { style: "thin" as const, color }, bottom: { style: "thin" as const, color }, right: { style: "thin" as const, color } };
}

function thinCellBorder() {
  const color = { argb: C.borderCell };
  return { top: { style: "thin" as const, color }, left: { style: "thin" as const, color }, bottom: { style: "thin" as const, color }, right: { style: "thin" as const, color } };
}

function autoWidth(ws: import("exceljs").Worksheet): void {
  ws.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const val = cell.value;
      let text = "";
      if (val === null || val === undefined) text = "";
      else if (typeof val === "object" && "richText" in val) {
        text = (val as ExcelJSNS.CellRichTextValue).richText.map((p) => p.text).join("");
      } else text = String(val);
      if (cell.numFmt && cell.numFmt.includes("#,##0")) text = "  " + text;
      if (text.length > maxLen) maxLen = text.length;
    });
    column.width = Math.min(Math.max(maxLen + 3, 10), 60);
  });
}
