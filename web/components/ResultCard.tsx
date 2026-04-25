"use client";
import { ScanResult } from "@/lib/api";
import { CheckCircle2, AlertTriangle, XCircle, Ban } from "lucide-react";
import clsx from "clsx";

const META: Record<
  string,
  { chip: string; bar: string; Icon: any; label: string; band: string }
> = {
  authentic:   { chip: "chip-authentic",   bar: "success", Icon: CheckCircle2,  label: "Authentic",   band: "bg-authentic-bg text-authentic-fg" },
  suspicious:  { chip: "chip-suspicious",  bar: "warn",    Icon: AlertTriangle, label: "Suspicious",  band: "bg-suspicious-bg text-suspicious-fg" },
  counterfeit: { chip: "chip-counterfeit", bar: "danger",  Icon: XCircle,       label: "Counterfeit", band: "bg-counterfeit-bg text-counterfeit-fg" },
};

const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;

export default function ResultCard({ r }: { r: ScanResult }) {
  const meta = META[r.verdict] ?? META.suspicious;
  const Icon = meta.Icon;
  const breakdown = (r.breakdown || {}) as Record<string, any>;
  const subscores = (breakdown.subscores || {}) as Record<string, number>;
  const comparison = (breakdown.comparison_of_techniques || {}) as Record<string, number>;
  const topCur = (breakdown.top_currencies || []) as [string, number][];
  const topDen = (breakdown.top_denominations || []) as [string, string, number][];
  const lab = (breakdown.lab || {}) as { L?: number; a?: number; b?: number; chroma?: number };

  return (
    <article className="card !p-0 overflow-hidden">
      {/* Verdict band */}
      <div className={clsx("flex items-center gap-3 px-6 py-3 border-b border-token", meta.band)}>
        <Icon className="h-5 w-5" />
        <div className="font-bold uppercase tracking-wider text-sm">{meta.label}</div>
        <div className="ml-auto t-mono text-xs">
          {breakdown.model || "heuristic"}
        </div>
      </div>

      {/* Demonetized warning */}
      {r.demonetized && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "10px 20px",
          background: "#fff8e6", borderBottom: "1px solid #f0c040",
          color: "#7a5c00",
        }}>
          <Ban style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ fontSize: 13 }}>Demonetized note — </strong>
            <span style={{ fontSize: 13 }}>
              This denomination ({r.currency} {r.denomination}) has been recalled from
              circulation. It may no longer be accepted by banks.
            </span>
          </div>
        </div>
      )}

      <div className="p-6 space-y-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="t-eyebrow">Detected</div>
            <h3 className="t-display text-2xl mt-1">
              {r.currency}{" "}
              {r.denomination && r.denomination !== "unknown" && (
                <span className="text-fg-tertiary font-semibold">· {r.denomination}</span>
              )}
            </h3>
          </div>
          <div className="text-right">
            <div className="t-eyebrow">Authenticity</div>
            <div className="t-display text-3xl text-brand">{pct(r.authenticity_score)}</div>
          </div>
        </header>

        {/* Top currency / denomination probabilities */}
        {topCur.length > 0 && (
          <section className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="t-eyebrow mb-2">Top currencies</div>
              <ul className="space-y-1.5">
                {topCur.map(([code, p], i) => (
                  <li key={code} className="flex items-center gap-2">
                    <span className={clsx("chip", i === 0 ? "chip-brand" : "")}>{code}</span>
                    <div className="flex-1 progress"><div className="progress-bar" style={{ width: `${p * 100}%` }} /></div>
                    <span className="t-mono text-xs w-10 text-right">{Math.round(p * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="t-eyebrow mb-2">Top denominations</div>
              <ul className="space-y-1.5">
                {topDen.slice(0, 5).map(([cur, den, p], i) => (
                  <li key={`${cur}-${den}`} className="flex items-center gap-2">
                    <span className={clsx("chip shrink-0", i === 0 ? "chip-brand" : "")}
                          style={{ minWidth: "5.5rem", justifyContent: "center" }}>
                      {cur}&thinsp;{den}
                    </span>
                    <div className="flex-1 progress"><div className="progress-bar" style={{ width: `${p * 100}%` }} /></div>
                    <span className="t-mono text-xs w-8 text-right shrink-0">{Math.round(p * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Image-processing technique scores */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="font-semibold text-fg-primary">Image-processing breakdown</h4>
            <span className="t-mono text-xs text-fg-tertiary">
              {Math.max(0, Object.keys(subscores).length - 1)} PBL techniques + classifier
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            {Object.entries(subscores).map(([k, v]) => (
              <Bar key={k} label={prettyLabel(k)} value={Number(v)} bar={meta.bar} />
            ))}
          </div>
        </section>

        {/* Lab measurement + comparison-of-techniques */}
        <section className="grid sm:grid-cols-2 gap-4">
          {lab.L !== undefined && (
            <div className="rounded-md bg-sunken border border-token p-4">
              <div className="t-eyebrow mb-2">Color measurement (CIE Lab)</div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[["L*", lab.L], ["a*", lab.a], ["b*", lab.b], ["C", lab.chroma]].map(([k, v]) => (
                  <div key={String(k)}>
                    <div className="t-mono text-xs text-fg-tertiary">{k}</div>
                    <div className="t-mono font-semibold">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Object.keys(comparison).length > 0 && (
            <div className="rounded-md bg-sunken border border-token p-4">
              <div className="t-eyebrow mb-2">Comparison of techniques (sharpness)</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {Object.entries(comparison).map(([k, v]) => (
                  <div key={k} className="rounded-sm bg-canvas border border-token px-2 py-1.5">
                    <div className="t-mono text-[11px] uppercase text-fg-tertiary">{k}</div>
                    <div className="t-mono font-semibold mt-0.5">{Number(v).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <p className="text-xs text-fg-tertiary">
          Verdict combines weighted image-quality scores with the color-fingerprint
          classifier; thresholds are configurable in Settings → Detection.
        </p>
      </div>
    </article>
  );
}

const LABELS: Record<string, string> = {
  exposure:          "Image Enhancement (exposure)",
  histogram_match:   "Histogram Processing",
  noise_quality:     "Noise Removal (quality)",
  sharpness:         "Spatial Filtering (sharpness)",
  microprint_fft:    "Frequency Domain (micro-print)",
  thread_continuity: "Morphology (security thread)",
  color_chroma:      "Colour Space (Lab chroma)",
  ml_confidence:     "Classifier confidence",
};

function prettyLabel(k: string) {
  return LABELS[k] || k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function Bar({ label, value, bar }: { label: string; value: number; bar?: string }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-fg-secondary font-medium">{label}</span>
        <span className="t-mono text-fg-tertiary">{Math.round(v * 100)}</span>
      </div>
      <div className="progress">
        <div className={clsx("progress-bar", bar)} style={{ width: `${v * 100}%` }} />
      </div>
    </div>
  );
}
