import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinBoard — Dashboard Analitik Keuangan Interaktif",
  description:
    "Ubah file CSV transaksi menjadi dashboard keuangan eksekutif secara instan. 100% diproses di browser Anda — data tidak pernah dikirim ke server.",
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <main className="flex flex-1 flex-col">{children}</main>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
