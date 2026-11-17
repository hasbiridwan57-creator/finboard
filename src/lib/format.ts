/**
 * Normalisasi & parsing angka keuangan (PRD FR-PRS-03, §13).
 *
 * Mendukung:
 * - Simbol mata uang: Rp, IDR, $, USD, €
 * - Kurung akuntansi sebagai negatif: (1.500.000) → -1500000
 * - Pemisah ribuan/desimal Indonesia & US:
 *     "1.250.000,50" → 1250000.5
 *     "1,250,000.50" → 1250000.5
 * - Sel kosong / tidak valid → 0
 */

const CURRENCY_SYMBOLS = /(?:rp|idr|usd|\$|€|£)/gi;

/** Hapus simbol mata uang, spasi, dan karakter non-numerik kecuali pemisah & minus. */
function stripCurrency(raw: string): string {
  return raw
    .replace(CURRENCY_SYMBOLS, "")
    .replace(/\s/g, "")
    .trim();
}

/**
 * Normalisasi satu sel angka keuangan menjadi JavaScript number.
 * Mengembalikan null jika input kosong.
 */
export function parseFinancialNumber(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;

  let s = stripCurrency(raw);
  if (s === "") return null;

  // Tanda kurung akuntansi = negatif
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (s === "") return null;

  const countDots = (s.match(/\./g) || []).length;
  const countCommas = (s.match(/,/g) || []).length;

  let integerPart: string;
  let decimalPart = "";

  if (countDots > 0 && countCommas > 0) {
    // Kedua pemisah ada: yang TERAKHIR adalah desimal, lainnya ribuan.
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      // Format Indonesia: 1.250.000,50
      integerPart = s.slice(0, lastComma).replace(/[.,]/g, "");
      decimalPart = s.slice(lastComma + 1);
    } else {
      // Format US: 1,250,000.50
      integerPart = s.slice(0, lastDot).replace(/[.,]/g, "");
      decimalPart = s.slice(lastDot + 1);
    }
  } else if (countDots > 0) {
    // Hanya titik.
    if (countDots > 1) {
      // Banyak titik = ribuan (ID): 1.500.000
      integerPart = s.replace(/\./g, "");
    } else {
      // Satu titik: 250.000 (ribuan) vs 1.50 (desimal)
      const [int, dec] = s.split(".");
      if (dec.length === 3) {
        integerPart = int + dec; // ribuan
      } else {
        integerPart = int; // desimal
        decimalPart = dec;
      }
    }
  } else if (countCommas > 0) {
    // Hanya koma.
    if (countCommas > 1) {
      // Banyak koma = ribuan (US): 1,250,000
      integerPart = s.replace(/,/g, "");
    } else {
      // Satu koma: 1,500 (ribuan US) vs 1,5 (desimal ID)
      const [int, dec] = s.split(",");
      if (dec.length === 3) {
        integerPart = int + dec; // ribuan
      } else {
        integerPart = int; // desimal
        decimalPart = dec;
      }
    }
  } else {
    // Tidak ada pemisah
    integerPart = s;
  }

  // Buang karakter non-digit yang tersisa
  const cleanInt = integerPart.replace(/\D/g, "");
  const cleanDec = decimalPart.replace(/\D/g, "");

  if (cleanInt === "" && cleanDec === "") return null;

  const numStr = (cleanInt || "0") + (cleanDec ? "." + cleanDec : "");
  const num = Number(numStr);

  if (!Number.isFinite(num)) return null;

  return negative ? -num : num;
}

/** Normalisasi ke number; sel kosong/tidak valid → 0 (dengan flag apakah dibersihkan). */
export function toNumberOrZero(
  raw: string | number | null | undefined,
  onCleaned?: () => void,
): number {
  const n = parseFinancialNumber(raw);
  if (n === null) {
    onCleaned?.();
    return 0;
  }
  return n;
}

/**
 * Format mata uang Rupiah.
 * - compact=true: "Rp 1,45 M" / "Rp 850 jt" (ringkas)
 * - compact=false: "Rp 1.450.200.000" (penuh)
 */
export function formatRupiah(value: number, compact = true): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (compact) {
    if (abs >= 1_000_000_000) {
      return `${sign}Rp ${trimNum(abs / 1_000_000_000)} M`;
    }
    if (abs >= 1_000_000) {
      return `${sign}Rp ${trimNum(abs / 1_000_000)} jt`;
    }
    if (abs >= 1_000) {
      return `${sign}Rp ${trimNum(abs / 1_000)} rb`;
    }
  }

  return `${sign}Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(abs)}`;
}

/** Format angka desimal Indonesia (koma sebagai desimal), maks 2 desimal signifikan. */
function trimNum(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(rounded);
}

/** Format persentase Indonesia, 1 desimal: "24,8%". */
export function formatPercent(value: number, decimals = 1): string {
  return `${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)}%`;
}

/** Format delta dengan tanda: "+12,4%" / "-3,1%". */
export function formatDelta(value: number, decimals = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "" : ""; // minus sudah dari angka
  return `${sign}${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)}%`;
}
