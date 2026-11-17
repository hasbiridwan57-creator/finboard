/**
 * Parsing tanggal fleksibel (PRD FR-PRS-04, §13).
 *
 * Mendukung: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, YYYY/MM/DD.
 * Ambiguitas DD/MM vs MM/DD diselesaikan lewat pemindaian kolom (lihat parseDateColumn).
 */

const ISO_RE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function buildIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2999) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null; // invalid day
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Hapus bagian jam/timestamp di belakang tanggal (mis. "2026-01-15 14:30:00" → "2026-01-15"). */
function stripTime(raw: string): string {
  // Pisahkan pada spasi atau huruf 'T' (pemisah tanggal-waktu ISO).
  const m = raw.match(/^([^ T]+)/);
  return m ? m[1] : raw;
}

/** Coba parse satu string tanggal. Mengembalikan ISO "YYYY-MM-DD" atau null. */
export function parseDate(raw: string, preferDayFirst = false): string | null {
  if (!raw) return null;
  const s = stripTime(raw.trim());
  if (!s) return null;

  // ISO: YYYY-MM-DD atau YYYY/MM/DD
  const iso = s.match(ISO_RE);
  if (iso) {
    return buildIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  // D/M/YYYY atau D-M-YYYY
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    const y = Number(dmy[3]);
    // Jika a > 12, pasti DD/MM. Jika b > 12, pasti MM/DD.
    if (a > 12) return buildIso(y, b, a);
    if (b > 12) return buildIso(y, a, b);
    // Ambigu: gunakan preferensi kolom
    return preferDayFirst ? buildIso(y, b, a) : buildIso(y, a, b);
  }

  return null;
}

/**
 * Deteksi preferensi format kolom tanggal (PRD §13 mitigasi ambiguitas).
 * Jika ada sel dengan angka pertama > 12 → seluruh kolom DD/MM/YYYY.
 */
export function detectDayFirst(samples: string[]): boolean {
  for (const raw of samples) {
    const m = stripTime(raw?.trim() ?? "").match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (a > 12) return true; // DD/MM
      if (b > 12) return false; // MM/DD
    }
  }
  return false; // default: coba MM/DD dulu (US), fallback aman
}

/** Bulan agregasi "YYYY-MM" dari tanggal ISO. */
export function toMonthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}
