"use client";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Eye, LogIn, ScanLine, Upload, X, Layers } from "lucide-react";
import ScanCamera from "@/components/ScanCamera";
import ResultCard from "@/components/ResultCard";
import { api, type ScanResult, type CurrencyConfig, type UserOut } from "@/lib/api";
import Link from "next/link";

const HINT_OPTIONS: { value: string; label: string }[] = [
  { value: "",    label: "Auto-detect" },
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — Pound Sterling" },
  { value: "JPY", label: "JPY — Japanese Yen" },
  { value: "AED", label: "AED — UAE Dirham" },
];

/** Compress an image file client-side to max 800px, quality 0.85 */
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const MAX = 800;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width: w, height: h } = img;
      const scale = Math.min(1, MAX / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export default function Home() {
  const [results, setResults] = useState<ScanResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string>("");
  const [currencies, setCurrencies] = useState<CurrencyConfig[]>([]);
  const [me, setMe] = useState<UserOut | null | undefined>(undefined);
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchProgress, setBatchProgress] = useState<string>("");
  const batchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.currencies().then(setCurrencies).catch(() => setCurrencies([]));
    api.me().then(setMe).catch(() => setMe(null));
    const onAuth = () => api.me().then(setMe).catch(() => setMe(null));
    window.addEventListener("vc-auth-changed", onAuth);
    return () => window.removeEventListener("vc-auth-changed", onAuth);
  }, []);

  async function handle(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const compressed = await compressImage(file);
      const r = await api.scan(compressed, hint || undefined);
      setResults([r]);
    } catch (e: any) {
      setErr(e.message || "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleBatch() {
    if (!batchFiles.length) return;
    setBusy(true);
    setErr(null);
    setBatchProgress(`Compressing ${batchFiles.length} images…`);
    try {
      const compressed = await Promise.all(batchFiles.map(compressImage));
      setBatchProgress(`Scanning ${compressed.length} notes…`);
      const res = await api.scanBatch(compressed, hint || undefined);
      setResults(res);
      setBatchFiles([]);
      setBatchProgress("");
    } catch (e: any) {
      setErr(e.message || "Batch scan failed");
      setBatchProgress("");
    } finally {
      setBusy(false);
    }
  }

  function addBatchFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const arr = Array.from(newFiles).filter((f) => f.type.startsWith("image/"));
    setBatchFiles((prev) => {
      const combined = [...prev, ...arr];
      return combined.slice(0, 10);
    });
  }

  const enabledHints = HINT_OPTIONS.filter(
    (h) => h.value === "" || currencies.length === 0 ||
           currencies.some((c) => c.code === h.value && c.enabled),
  );

  const authLoading = me === undefined;
  const isViewer = me?.role === "viewer";
  const isAnonymous = me === null;
  const result = results[0] ?? null;

  return (
    <>
      <section className="gov-hero">
        <div className="mx-auto max-w-container px-4 sm:px-6">
          <div className="t-eyebrow mb-1">Currency Authentication Bureau</div>
          <h1 className="t-display">Scan a banknote</h1>
          <p>
            Capture or upload a banknote image. The bureau pipeline applies all
            seven PBL image-processing techniques and a CIE Lab colour-fingerprint
            classifier, then issues a verdict: <strong>authentic</strong>,
            <strong> suspicious</strong>, or <strong>counterfeit</strong>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="chip chip-brand"><ShieldCheck className="h-3 w-3" /> Same backend serves web + APK</span>
            <span className="chip">7 techniques</span>
            <span className="chip">CIE Lab fingerprints</span>
            <span className="chip chip-gold">Heuristic v4 · ML-anchored</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-container px-4 sm:px-6 py-8">

        {/* ── Anonymous ───────────────────────────────────────────────── */}
        {!authLoading && isAnonymous && (
          <div className="card max-w-xl mx-auto flex flex-col items-center text-center py-12 gap-5">
            <div className="h-14 w-14 rounded-full gov-gradient grid place-items-center text-white shadow-md">
              <LogIn className="h-7 w-7" />
            </div>
            <div>
              <h2 className="t-display text-xl mb-2">Sign in to scan</h2>
              <p className="text-fg-secondary text-sm max-w-xs">
                Scanning requires an authenticated account. Sign in with an
                Inspector or Admin account to use the banknote scanner.
              </p>
            </div>
            <Link href="/settings" className="btn btn-primary">
              <LogIn className="h-4 w-4" /> Go to sign in
            </Link>
          </div>
        )}

        {/* ── Viewer ──────────────────────────────────────────────────── */}
        {!authLoading && isViewer && (
          <div className="card max-w-xl mx-auto flex flex-col items-center text-center py-12 gap-5">
            <div className="h-14 w-14 rounded-full flex items-center justify-center text-white shadow-md"
              style={{ background: "var(--gov-navy)" }}>
              <Eye className="h-7 w-7" />
            </div>
            <div>
              <h2 className="t-display text-xl mb-2">View-only account</h2>
              <p className="text-fg-secondary text-sm max-w-xs">
                Your account has the <strong>Viewer</strong> role, which is
                read-only. Scanning banknotes is restricted to{" "}
                <strong>Inspector</strong> and <strong>Admin</strong> accounts.
              </p>
            </div>
            <Link href="/history" className="btn btn-secondary">
              <ScanLine className="h-4 w-4" /> View scan history
            </Link>
          </div>
        )}

        {/* ── Scan UI ─────────────────────────────────────────────────── */}
        {!authLoading && !isViewer && !isAnonymous && (
          <div className="space-y-6">
            {/* Mode toggle + currency selector */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-md border border-token overflow-hidden">
                {(["single", "batch"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setResults([]); setBatchFiles([]); setErr(null); }}
                    className="px-4 py-1.5 text-sm font-medium transition-colors"
                    style={{
                      background: mode === m ? "var(--gov-navy)" : "transparent",
                      color: mode === m ? "#fff" : "var(--fg-secondary)",
                    }}
                  >
                    {m === "single" ? <><ScanLine className="h-3.5 w-3.5 inline mr-1.5" />Single</> : <><Layers className="h-3.5 w-3.5 inline mr-1.5" />Batch</>}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm ml-auto">
                <span className="text-fg-secondary">Currency</span>
                <select
                  className="input py-1.5"
                  style={{ width: "auto", minWidth: "12rem" }}
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  disabled={busy}
                >
                  {enabledHints.map((h) => (
                    <option key={h.value || "auto"} value={h.value}>{h.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Single mode */}
            {mode === "single" && (
              <div className="grid lg:grid-cols-2 gap-6">
                <section className="space-y-4">
                  <div className="t-eyebrow">Capture</div>
                  <ScanCamera onCapture={handle} busy={busy} />
                  {err && <div className="alert danger"><strong>Error.</strong> <span>{err}</span></div>}
                  <p className="text-xs text-fg-tertiary">
                    Images are compressed to 800px before upload. Place the note flat under
                    even lighting, filling most of the frame.
                  </p>
                </section>
                <section className="space-y-4">
                  <div className="t-eyebrow">Result</div>
                  {result ? <ResultCard r={result} /> : (
                    <div className="card flex flex-col items-center text-center py-16">
                      <div className="h-12 w-12 rounded-md gov-gradient grid place-items-center text-white shadow-md">
                        <ShieldCheck className="h-6 w-6" />
                      </div>
                      <h3 className="t-display text-xl mt-4">No scan yet</h3>
                      <p className="text-fg-tertiary text-sm mt-1 max-w-xs">
                        Capture or upload a banknote image to see the verdict.
                      </p>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* Batch mode */}
            {mode === "batch" && (
              <div className="space-y-4">
                {/* Drop zone */}
                <div
                  className="card border-2 border-dashed border-token flex flex-col items-center justify-center py-12 gap-3 cursor-pointer transition-colors hover:border-brand"
                  onClick={() => batchInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); addBatchFiles(e.dataTransfer.files); }}
                >
                  <Upload className="h-8 w-8 text-fg-tertiary" />
                  <div className="text-center">
                    <div className="font-semibold text-fg-secondary">Drop images here or click to browse</div>
                    <div className="text-xs text-fg-tertiary mt-1">Up to 10 images · JPEG / PNG · auto-compressed</div>
                  </div>
                  <input
                    ref={batchInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => addBatchFiles(e.target.files)}
                  />
                </div>

                {/* File list */}
                {batchFiles.length > 0 && (
                  <div className="card !p-3 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-fg-secondary">{batchFiles.length} / 10 images queued</span>
                      <button className="text-xs text-fg-tertiary hover:text-danger" onClick={() => setBatchFiles([])}>Clear all</button>
                    </div>
                    {batchFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 truncate text-fg-secondary">{f.name}</span>
                        <span className="t-mono text-xs text-fg-tertiary">{(f.size / 1024).toFixed(0)} KB</span>
                        <button onClick={() => setBatchFiles((p) => p.filter((_, j) => j !== i))}>
                          <X className="h-3.5 w-3.5 text-fg-tertiary hover:text-danger" />
                        </button>
                      </div>
                    ))}
                    <button
                      className="btn btn-primary w-full mt-2"
                      disabled={busy || batchFiles.length === 0}
                      onClick={handleBatch}
                    >
                      {busy ? (batchProgress || "Scanning…") : `Scan ${batchFiles.length} note${batchFiles.length > 1 ? "s" : ""}`}
                    </button>
                  </div>
                )}

                {err && <div className="alert danger"><strong>Error.</strong> <span>{err}</span></div>}

                {/* Batch results */}
                {results.length > 0 && (
                  <div>
                    <div className="t-eyebrow mb-3">{results.length} results</div>
                    <div className="grid md:grid-cols-2 gap-4">
                      {results.map((r, i) => <ResultCard key={r.id ?? i} r={r} />)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {authLoading && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card space-y-3">
              <div className="shimmer h-4 w-24" />
              <div className="shimmer aspect-[4/3] w-full rounded-md" />
            </div>
            <div className="card space-y-3">
              <div className="shimmer h-4 w-16" />
              <div className="shimmer h-48 w-full rounded-md" />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
