"use client";

/** InsightsPanel (PRD FR-INS, US-07). */
import { Lightbulb, TrendingUp, AlertTriangle, Info } from "lucide-react";
import type { Insight } from "@/lib/insightGenerator";

function renderBold(text: string) {
  // Render **bold** sederhana
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold text-foreground">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

const TONE_STYLE: Record<Insight["tone"], { icon: typeof Info; color: string }> = {
  info: { icon: Info, color: "text-primary" },
  positive: { icon: TrendingUp, color: "text-success" },
  warning: { icon: AlertTriangle, color: "text-danger" },
};

export default function InsightsPanel({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;
  return (
    <div className="rounded-xl border border-surface-border bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-foreground">Ringkasan Insight Bisnis Otomatis</h3>
      </div>
      <ul className="space-y-3">
        {insights.map((ins, i) => {
          const { icon: Icon, color } = TONE_STYLE[ins.tone];
          return (
            <li key={i} className="flex items-start gap-3">
              <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${color}`} />
              <p className="text-sm leading-relaxed text-muted-foreground">{renderBold(ins.text)}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
