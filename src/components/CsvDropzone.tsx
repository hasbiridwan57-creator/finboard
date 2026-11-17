"use client";

/**
 * CsvDropzone (PRD FR-UPL-01, FR-UPL-02, US-01).
 * Drag & drop / klik, validasi ukuran & ekstensi, lalu parse via pipeline.
 */
import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileWarning, Loader2 } from "lucide-react";
import { parseCsv, validateFile, MAX_FILE_SIZE } from "@/lib/csvParser";
import { isMappingSufficient } from "@/lib/columnMapper";
import { setRawCsv } from "@/lib/sessionCsv";
import { useFinBoardStore } from "@/store/finBoardStore";

interface Props {
  onParsed: () => void;
}

export default function CsvDropzone({ onParsed }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setDataset, setNeedsManualMapping } = useFinBoardStore();

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      try {
        validateFile(file);
      } catch (e) {
        setError(e instanceof Error ? e.message : "File tidak valid.");
        return;
      }
      setLoading(true);
      try {
        const text = await file.text();
        const ds = parseCsv(text, file.name);
        setRawCsv(text, file.name);
        setDataset(ds);
        if (!isMappingSufficient(ds.mapping)) {
          setNeedsManualMapping(true);
        }
        onParsed();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memproses file CSV.");
      } finally {
        setLoading(false);
      }
    },
    [onParsed, setDataset, setNeedsManualMapping],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Unggah file CSV"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setIsDragging(false)}
        className={`group flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed bg-white px-6 py-12 text-center cursor-pointer transition-colors shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
          isDragging ? "border-primary bg-blue-50/50" : "border-surface-border hover:border-primary/50"
        }`}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-primary transition-transform group-hover:scale-105">
          {loading ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <UploadCloud className="h-7 w-7" />
          )}
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">
            {loading ? "Memproses file…" : "Tarik & lepas file CSV di sini"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            atau klik untuk memilih file
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Mendukung file .csv hingga 5 MB • 100% diproses di browser Anda
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = ""; // reset agar file sama bisa diunggah ulang
          }}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          <FileWarning className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-medium">Gagal memuat file</p>
            <p className="mt-0.5 text-danger/90">{error}</p>
          </div>
        </div>
      )}

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Maksimal {Math.round(MAX_FILE_SIZE / 1_048_576)} MB per file
      </p>
    </div>
  );
}
