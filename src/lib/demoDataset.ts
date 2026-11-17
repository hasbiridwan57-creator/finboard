/**
 * Generator dataset demo FinBoard (PRD FR-UPL-03, US-02).
 * Deterministik (seeded PRNG) agar demo konsisten antar-reload.
 * 360 transaksi, 12 bulan, 4 kategori, 4 departemen, 3 kanal, + kolom Budget.
 */
import type { NormalizedTransaction } from "./types";

/** PRNG mulberry32 — deterministik. */
function seededRandom(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORIES = ["Technology", "Layanan Konsultasi", "Produk Fisik", "Langganan SaaS"];
const DEPARTMENTS = ["Engineering & Product", "Sales & Marketing", "Operations", "Customer Success"];
const CHANNELS = ["B2B Direct", "Marketplace", "Kemitraan"];

/** Bobot kontribusi revenue per kategori (Technology dominan untuk insight #1). */
const CATEGORY_WEIGHT: Record<string, number> = {
  Technology: 0.4,
  "Layanan Konsultasi": 0.28,
  "Produk Fisik": 0.2,
  "Langganan SaaS": 0.12,
};

/** Faktor margin per kategori. Customer Success akan menghasilkan defisit (insight anomali). */
const CATEGORY_MARGIN: Record<string, number> = {
  Technology: 0.42,
  "Layanan Konsultasi": 0.35,
  "Produk Fisik": 0.22,
  "Langganan SaaS": 0.5,
};

const DEPARTMENT_MARGIN: Record<string, number> = {
  "Engineering & Product": 0.4,
  "Sales & Marketing": 0.3,
  Operations: 0.25,
  "Customer Success": 0.05, // margin tipis → sering defisit di bulan tertentu
};

const CHANNEL_WEIGHT: Record<string, number> = {
  "B2B Direct": 0.5,
  Marketplace: 0.3,
  Kemitraan: 0.2,
};

function pickWeighted<K extends string>(keys: K[], weights: Record<string, number>, r: number): K {
  const total = keys.reduce((s, k) => s + weights[k], 0);
  let x = r * total;
  for (const k of keys) {
    x -= weights[k];
    if (x <= 0) return k;
  }
  return keys[keys.length - 1];
}

export function generateDemoDataset(scenarioId: DemoScenarioId = "saas"): NormalizedTransaction[] {
  const isRetail = scenarioId === "retail";
  // Seed & config berbeda per skenario agar pola data berbeda namun tetap deterministik.
  const rand = seededRandom(isRetail ? 20260214 : 20260117);
  const transactions: NormalizedTransaction[] = [];
  const year = 2026;
  let id = 0;

  // Skenario Retail: kategori menu F&B, departemen operasional outlet, kanal jual.
  const categories = isRetail
    ? ["Kopi & Minuman", "Makanan Ringan", "Merchandise", "Katering"]
    : CATEGORIES;
  const departments = isRetail
    ? ["Operasional Outlet", "Pemasaran", "Riset & Pengembangan", "Layanan Pelanggan"]
    : DEPARTMENTS;
  const channels = isRetail
    ? ["Gerai Fisik", "Marketplace", "Pesanan Online"]
    : CHANNELS;
  const categoryWeights = isRetail
    ? { "Kopi & Minuman": 0.5, "Makanan Ringan": 0.25, Merchandise: 0.15, Katering: 0.1 }
    : CATEGORY_WEIGHT;
  const categoryMargins = isRetail
    ? { "Kopi & Minuman": 0.55, "Makanan Ringan": 0.4, Merchandise: 0.5, Katering: 0.3 }
    : CATEGORY_MARGIN;
  const departmentMargins = isRetail
    ? { "Operasional Outlet": 0.32, Pemasaran: 0.2, "Riset & Pengembangan": 0.15, "Layanan Pelanggan": 0.05 }
    : DEPARTMENT_MARGIN;
  const channelWeights = isRetail
    ? { "Gerai Fisik": 0.55, Marketplace: 0.3, "Pesanan Online": 0.15 }
    : CHANNEL_WEIGHT;

  for (let month = 1; month <= 12; month++) {
    // Transaksi per bulan: 30 baris
    for (let d = 0; d < 30; d++) {
      const category = pickWeighted(categories, categoryWeights, rand());
      const department = pickWeighted(departments, { ...departmentMargins }, rand());
      const channel = pickWeighted(channels, channelWeights, rand());

      // Base revenue tumbuh sepanjang tahun + musiman (Q4 naik)
      const growth = 1 + (month - 1) * 0.035;
      const seasonal = month >= 10 ? 1.15 : month <= 2 ? 0.9 : 1.0;
      const categoryFactor = categoryWeights[category] / 0.25; // rata 1
      const day = 1 + Math.floor(rand() * 28);

      const baseRevenue = (8_000_000 + rand() * 30_000_000) * growth * seasonal * categoryFactor;
      const revenue = Math.max(1_000_000, Math.round(baseRevenue / 1000) * 1000);

      // Margin efektif = kombinasi margin kategori & departemen + noise + faktor kanal
      let margin =
        categoryMargins[category] * 0.6 +
        departmentMargins[department] * 0.4 -
        (channel === "Marketplace" ? 0.05 : 0) +
        (rand() - 0.5) * 0.08;

      // Defisit periodik: SaaS di Customer Success; Retail di Layanan Pelanggan.
      const deficitDept = isRetail ? "Layanan Pelanggan" : "Customer Success";
      const isDeficit =
        department === deficitDept && rand() < 0.18 && month % 3 === 0;
      if (isDeficit) margin = -0.05 - rand() * 0.15;

      const expenses = Math.round((revenue * (1 - margin)) / 1000) * 1000;
      const profit = revenue - expenses;

      // Budget ≈ revenue target bulan itu (±10%) untuk chart Revenue vs Budget
      const budgetTarget =
        Math.round((revenue * (0.9 + rand() * 0.2)) / 1_000_000) * 1_000_000;

      const pad = (n: number) => String(n).padStart(2, "0");
      transactions.push({
        id: `demo_${id++}`,
        date: `${year}-${pad(month)}-${pad(day)}`,
        monthKey: `${year}-${pad(month)}`,
        revenue,
        expenses,
        profit,
        category,
        department,
        channel,
        budget: budgetTarget,
      });
    }
  }

  return transactions;
}

export const DEMO_HEADERS = [
  "Tanggal",
  "Revenue",
  "Expenses",
  "Profit",
  "Kategori",
  "Departemen",
  "Channel",
  "Budget",
];

/** Pilihan skenario demo (audit Bagian B1). */
export type DemoScenarioId = "saas" | "retail";

export interface DemoScenario {
  id: DemoScenarioId;
  /** Judul singkat di tombol. */
  title: string;
  /** Deskripsi 1 baris untuk tooltip/helper text. */
  description: string;
  /** Nama file CSV yang akan tampil di header dashboard. */
  fileName: string;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "saas",
    title: "PT Nusantara Digital (SaaS & Tech)",
    description: "Perusahaan SaaS: revenue tumbuh + seasonality Q4, margin tipis di Customer Success.",
    fileName: "Dataset Demo — PT Nusantara Digital.csv",
  },
  {
    id: "retail",
    title: "Kopi Nusantara (Retail F&B)",
    description: "Jaringan kopi retail: volume tinggi, margin tipis, ada defisit di kanal Marketplace.",
    fileName: "Dataset Demo — Kopi Nusantara.csv",
  },
];

/**
 * Dataset demo sebagai teks CSV (agar mengalir lewat pipeline parsing yang sama).
 * @param scenarioId Skenario yang dipilih (default "saas" untuk backward-compat).
 */
export function generateDemoCsv(scenarioId: DemoScenarioId = "saas"): string {
  const rows = generateDemoDataset(scenarioId);
  const header = DEMO_HEADERS.join(",");
  const lines = rows.map((t) =>
    [
      t.date,
      t.revenue,
      t.expenses,
      t.profit,
      t.category,
      t.department,
      t.channel,
      t.budget,
    ].join(","),
  );
  return [header, ...lines].join("\n");
}
