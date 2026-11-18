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

/** ID skenario demo yang tersedia. */
export type DemoScenarioId = "saas" | "retail" | "ecom";

/** Konfigurasi lengkap per skenario — menggantikan branching boolean isRetail. */
interface ScenarioConfig {
  categories: string[];
  departments: string[];
  channels: string[];
  categoryWeights: Record<string, number>;
  categoryMargins: Record<string, number>;
  departmentMargins: Record<string, number>;
  channelWeights: Record<string, number>;
  /** Departemen yang akan mengalami defisit periodik (insight anomali). */
  deficitDept: string;
  seed: number;
}

const SAAS_CONFIG: ScenarioConfig = {
  categories: ["Technology", "Layanan Konsultasi", "Produk Fisik", "Langganan SaaS"],
  departments: ["Engineering & Product", "Sales & Marketing", "Operations", "Customer Success"],
  channels: ["B2B Direct", "Marketplace", "Kemitraan"],
  // Bobot kontribusi revenue per kategori (Technology dominan untuk insight #1).
  categoryWeights: {
    Technology: 0.4,
    "Layanan Konsultasi": 0.28,
    "Produk Fisik": 0.2,
    "Langganan SaaS": 0.12,
  },
  // Faktor margin per kategori. Customer Success akan menghasilkan defisit (insight anomali).
  categoryMargins: {
    Technology: 0.42,
    "Layanan Konsultasi": 0.35,
    "Produk Fisik": 0.22,
    "Langganan SaaS": 0.5,
  },
  departmentMargins: {
    "Engineering & Product": 0.4,
    "Sales & Marketing": 0.3,
    Operations: 0.25,
    "Customer Success": 0.05, // margin tipis → sering defisit di bulan tertentu
  },
  channelWeights: {
    "B2B Direct": 0.5,
    Marketplace: 0.3,
    Kemitraan: 0.2,
  },
  deficitDept: "Customer Success",
  seed: 20260117,
};

const RETAIL_CONFIG: ScenarioConfig = {
  categories: ["Kopi & Minuman", "Makanan Ringan", "Merchandise", "Katering"],
  departments: ["Operasional Outlet", "Pemasaran", "Riset & Pengembangan", "Layanan Pelanggan"],
  channels: ["Gerai Fisik", "Marketplace", "Pesanan Online"],
  categoryWeights: {
    "Kopi & Minuman": 0.5,
    "Makanan Ringan": 0.25,
    Merchandise: 0.15,
    Katering: 0.1,
  },
  categoryMargins: {
    "Kopi & Minuman": 0.55,
    "Makanan Ringan": 0.4,
    Merchandise: 0.5,
    Katering: 0.3,
  },
  departmentMargins: {
    "Operasional Outlet": 0.32,
    Pemasaran: 0.2,
    "Riset & Pengembangan": 0.15,
    "Layanan Pelanggan": 0.05,
  },
  channelWeights: {
    "Gerai Fisik": 0.55,
    Marketplace: 0.3,
    "Pesanan Online": 0.15,
  },
  deficitDept: "Layanan Pelanggan",
  seed: 20260214,
};

const ECOM_CONFIG: ScenarioConfig = {
  categories: ["Fashion", "Elektronik", "FMCG", "Rumah Tangga"],
  departments: ["Merchandising", "Fulfillment", "Growth & Promo", "CS & Retensi"],
  channels: ["Marketplace", "Aplikasi", "Website", "TikTok Shop"],
  categoryWeights: {
    Fashion: 0.35,
    Elektronik: 0.25,
    FMCG: 0.28,
    "Rumah Tangga": 0.12,
  },
  categoryMargins: {
    Fashion: 0.45,
    Elektronik: 0.18,
    FMCG: 0.28,
    "Rumah Tangga": 0.32,
  },
  departmentMargins: {
    Merchandising: 0.35,
    Fulfillment: 0.15,
    "Growth & Promo": 0.22,
    "CS & Retensi": 0.18,
  },
  channelWeights: {
    Marketplace: 0.4,
    Aplikasi: 0.3,
    Website: 0.15,
    "TikTok Shop": 0.15,
  },
  deficitDept: "Growth & Promo",
  seed: 20260301,
};

/** Registry config per skenario — sumber kebenaran tunggal untuk generateDemoDataset. */
const SCENARIO_CONFIGS: Record<DemoScenarioId, ScenarioConfig> = {
  saas: SAAS_CONFIG,
  retail: RETAIL_CONFIG,
  ecom: ECOM_CONFIG,
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
  const config = SCENARIO_CONFIGS[scenarioId];
  const rand = seededRandom(config.seed);
  const transactions: NormalizedTransaction[] = [];
  const year = 2026;
  let id = 0;

  const { categories, departments, channels, categoryWeights, categoryMargins, departmentMargins, channelWeights, deficitDept } = config;

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
      // Kanal promo-heavy (Marketplace, TikTok Shop) mendapat potongan margin -0.05.
      let margin =
        categoryMargins[category] * 0.6 +
        departmentMargins[department] * 0.4 -
        (channel === "Marketplace" || channel === "TikTok Shop" ? 0.05 : 0) +
        (rand() - 0.5) * 0.08;

      // Defisit periodik pada departemen yang ditandai di config skenario.
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
  {
    id: "ecom",
    title: "NusaMart E-Commerce (Omnichannel)",
    description: "Omnichannel e-commerce: kanal Marketplace & Aplikasi dominan, volume tinggi, kategori Fashion/Elektronik/FMCG, margin promo bervariasi.",
    fileName: "Dataset Demo — NusaMart E-Commerce.csv",
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
