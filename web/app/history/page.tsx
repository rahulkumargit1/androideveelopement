"use client";
import { useEffect, useState } from "react";
import { api, type ScanResult, type UserOut } from "@/lib/api";
import ResultCard from "@/components/ResultCard";
import { LogIn, Eye, ShieldCheck, Download, BarChart2, List, Filter, Trash2 } from "lucide-react";
import Link from "next/link";

// ── Tiny SVG chart primitives (no extra deps) ─────────────────────────────────

function VerdictDonut({ verdicts }: { verdicts: { authentic: number; suspicious: number; counterfeit: number } }) {
  const total = verdicts.authentic + verdicts.suspicious + verdicts.counterfeit;
  if (total === 0) return <div className="text-fg-tertiary text-sm text-center py-6">No data</div>;
  const segments = [
    { label: "Authentic",   value: verdicts.authentic,   color: "#2e8540" },
    { label: "Suspicious",  value: verdicts.suspicious,  color: "#e5a000" },
    { label: "Counterfeit", value: verdicts.counterfeit, color: "#b50909" },
  ];
  const R = 40, CX = 60, CY = 60, stroke = 18;
  const circ = 2 * Math.PI * R;
  let offset = 0;
  const arcs = segments.map((s) => {
    const dash = (s.value / total) * circ;
    const arc = { ...s, dash, offset };
    offset += dash;
    return arc;
  });
  return (
    <div className="flex items-center gap-4">
      <svg width="120" height="120" viewBox="0 0 120 120">
        {arcs.map((a) => (
          <circle key={a.label} cx={CX} cy={CY} r={R}
            fill="none" stroke={a.color} strokeWidth={stroke}
            strokeDasharray={`${a.dash} ${circ - a.dash}`}
            strokeDashoffset={circ / 4 - a.offset}
            transform={`rotate(-90 ${CX} ${CY})`} />
        ))}
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize="18" fontWeight="bold" fill="currentColor">{total}</text>
        <text x={CX} y={CY + 12} textAnchor="middle" fontSize="9" fill="var(--fg-tertiary)">scans</text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-fg-secondary">{s.label}</span>
            <span className="ml-auto t-mono font-semibold">{s.value}</span>
            <span className="text-fg-tertiary text-xs">({Math.round(s.value / total * 100)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrendBars({ trend }: { trend: { date: string; authentic: number; suspicious: number; counterfeit: number }[] }) {
  if (!trend.length) return <div className="text-fg-tertiary text-sm text-center py-6">No trend data</div>;
  const maxVal = Math.max(...trend.map((d) => d.authentic + d.suspicious + d.counterfeit), 1);
  const H = 80;
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1 h-24 min-w-max">
        {trend.map((d) => {
          const total = d.authentic + d.suspicious + d.counterfeit;
          const ah = (d.authentic / maxVal) * H;
          const sh = (d.suspicious / maxVal) * H;
          const ch = (d.counterfeit / maxVal) * H;
          const label = d.date.slice(5); // MM-DD
          return (
            <div key={d.date} className="flex flex-col items-center gap-1" style={{ minWidth: 28 }}>
              <div className="flex flex-col-reverse w-5 rounded-sm overflow-hidden" style={{ height: H }}>
                <div style={{ height: ah, background: "#2e8540" }} title={`Authentic: ${d.authentic}`} />
                <div style={{ height: sh, background: "#e5a000" }} title={`Suspicious: ${d.suspicious}`} />
                <div style={{ height: ch, background: "#b50909" }} title={`Counterfeit: ${d.counterfeit}`} />
              </div>
              <span className="text-[9px] text-fg-tertiary t-mono" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 28 }}>{label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-2 text-xs text-fg-tertiary">
        {[["#2e8540","Authentic"],["#e5a000","Suspicious"],["#b50909","Counterfeit"]].map(([c,l]) => (
          <span key={l} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm inline-block" style={{ background: c }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}

function CurrencyBars({ data }: { data: { code: string; count: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.code} className="flex items-center gap-2 text-sm">
          <span className="chip w-12 justify-center shrink-0">{d.code}</span>
          <div className="flex-1 progress">
            <div className="progress-bar" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
          <span className="t-mono text-xs text-fg-tertiary w-6 text-right">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [items, setItems] = useState<ScanResult[]>([]);
  const [me, setMe] = useState<UserOut | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [view, setView] = useState<"list" | "charts">("list");
  const [filterVerdict, setFilterVerdict] = useState<string>("");
  const [filterCurrency, setFilterCurrency] = useState<string>("");
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
    const onAuth = () => api.me().then(setMe).catch(() => setMe(null));
    window.addEventListener("vc-auth-changed", onAuth);
    return () => window.removeEventListener("vc-auth-changed", onAuth);
  }, []);


  useEffect(() => {
    if (me === undefined) return;
    if (me === null) { setLoading(false); return; }
    Promise.all([
      api.history(200).then(setItems),
      api.stats().then(setStats),
    ])
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [me]);

  const authLoading = me === undefined;
  const isAnonymous = me === null;
  const role = me?.role;

  const heroTitle = role === "inspector" ? "My scans" : "All scans";
  const heroDesc =
    role === "admin" ? "Bureau-wide audit log — all scans by all inspectors."
    : role === "viewer" ? "Bureau-wide audit log — read-only oversight access."
    : role === "inspector" ? "Your personal scan history."
    : "Sign in to view scan history.";

  // ── Filter ────────────────────────────────────────────────────────
  const currencies = [...new Set(items.map((i) => i.currency))].sort();
  const filtered = items.filter((r) => {
    if (filterVerdict && r.verdict !== filterVerdict) return false;
    if (filterCurrency && r.currency !== filterCurrency) return false;
    return true;
  });

  // ── Clear history ─────────────────────────────────────────────────
  async function handleClear() {
    if (!confirmClear) { setConfirmClear(true); return; }
    setClearing(true);
    try {
      await api.clearHistory();
      setItems([]);
      setStats(null);
      setConfirmClear(false);
    } catch (e: any) {
      setErr(e.message || "Failed to clear history");
    } finally {
      setClearing(false);
    }
  }

  // ── CSV export (client-side from already-loaded data) ────────────
  function handleExport() {
    const rows = [
      ["id","created_at","currency","denomination","verdict","authenticity_score","demonetized"],
      ...items.map((r) => [
        r.id ?? "",
        r.created_at ?? "",
        r.currency,
        r.denomination,
        r.verdict,
        r.authenticity_score,
        r.demonetized ? "true" : "false",
      ]),
    ];
    const csv = rows.map((r) => r.map(String).map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vericash_scans.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <section className="gov-hero">
        <div className="mx-auto max-w-container px-4 sm:px-6">
          <div className="t-eyebrow mb-1">Audit Log</div>
          <h1 className="t-display">{authLoading ? "Recent scans" : heroTitle}</h1>
          <p>{heroDesc}</p>
          {role && (
            <div className="mt-3 flex flex-wrap gap-2">
              {role === "admin" && <span className="chip chip-gold"><ShieldCheck className="h-3 w-3 inline mr-1" />Admin — full history</span>}
              {role === "viewer" && <span className="chip"><Eye className="h-3 w-3 inline mr-1" />Viewer — read-only</span>}
              {role === "inspector" && <span className="chip chip-brand">Inspector — own scans</span>}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-container px-4 sm:px-6 py-8 space-y-6">

        {/* Not signed in */}
        {!authLoading && isAnonymous && (
          <div className="card max-w-lg flex flex-col items-center text-center py-12 gap-4">
            <div className="h-12 w-12 rounded-full gov-gradient grid place-items-center text-white shadow-md">
              <LogIn className="h-6 w-6" />
            </div>
            <div>
              <h2 className="t-display text-lg mb-1">Sign in to view history</h2>
              <p className="text-fg-secondary text-sm">Scan history is only visible to authenticated users.</p>
            </div>
            <Link href="/settings" className="btn btn-primary"><LogIn className="h-4 w-4" /> Sign in</Link>
          </div>
        )}

        {/* Loading */}
        {(authLoading || (loading && me)) && (
          <div className="grid md:grid-cols-2 gap-4">
            {[0,1,2,3].map((i) => (
              <div key={i} className="card"><div className="shimmer h-5 w-1/3 mb-3" /><div className="shimmer h-3 w-1/2 mb-2" /><div className="shimmer h-3 w-2/3" /></div>
            ))}
          </div>
        )}

        {err && <div className="alert danger"><strong>Error.</strong> <span>{err}</span></div>}

        {!loading && !err && me && (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              {/* View toggle */}
              <div className="flex rounded-md border border-token overflow-hidden">
                {([["list", List, "List"], ["charts", BarChart2, "Analytics"]] as const).map(([v, Icon, label]) => (
                  <button key={v} onClick={() => setView(v as any)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors"
                    style={{ background: view === v ? "var(--gov-navy)" : "transparent", color: view === v ? "#fff" : "var(--fg-secondary)" }}>
                    <Icon className="h-3.5 w-3.5" />{label}
                  </button>
                ))}
              </div>

              {/* Filters (list view only) */}
              {view === "list" && (
                <div className="flex items-center gap-2 ml-2">
                  <Filter className="h-3.5 w-3.5 text-fg-tertiary" />
                  <select className="input py-1 text-sm" style={{ width: "auto" }}
                    value={filterVerdict} onChange={(e) => setFilterVerdict(e.target.value)}>
                    <option value="">All verdicts</option>
                    <option value="authentic">Authentic</option>
                    <option value="suspicious">Suspicious</option>
                    <option value="counterfeit">Counterfeit</option>
                  </select>
                  <select className="input py-1 text-sm" style={{ width: "auto" }}
                    value={filterCurrency} onChange={(e) => setFilterCurrency(e.target.value)}>
                    <option value="">All currencies</option>
                    {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              {/* Export CSV + Clear */}
              <div className="flex items-center gap-2 ml-auto">
                <button className="btn btn-secondary flex items-center gap-1.5" onClick={handleExport} disabled={items.length === 0}>
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
                {role !== "viewer" && (
                  <button
                    className="btn flex items-center gap-1.5"
                    style={{ background: confirmClear ? "#b50909" : undefined, color: confirmClear ? "#fff" : "var(--fg-secondary)", borderColor: confirmClear ? "#b50909" : undefined }}
                    onClick={handleClear}
                    disabled={clearing || items.length === 0}
                    onBlur={() => setConfirmClear(false)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {clearing ? "Clearing…" : confirmClear ? "Confirm clear?" : "Clear history"}
                  </button>
                )}
              </div>
            </div>

            {/* ── Analytics view ─────────────────────────────────────── */}
            {view === "charts" && stats && (
              <div className="grid md:grid-cols-2 gap-4">
                {/* Summary cards */}
                <div className="card">
                  <div className="t-eyebrow mb-4">Verdict breakdown</div>
                  <VerdictDonut verdicts={stats.verdicts} />
                  <div className="mt-4 pt-4 border-t border-token grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="t-eyebrow text-[10px]">Total scans</div>
                      <div className="t-mono text-2xl font-bold">{stats.total}</div>
                    </div>
                    <div>
                      <div className="t-eyebrow text-[10px]">Avg authenticity</div>
                      <div className="t-mono text-2xl font-bold">{Math.round((stats.avg_score || 0) * 100)}%</div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="t-eyebrow mb-4">Top currencies scanned</div>
                  <CurrencyBars data={stats.top_currencies || []} />
                </div>

                <div className="card md:col-span-2">
                  <div className="t-eyebrow mb-4">Scan trend — last 14 days</div>
                  <TrendBars trend={stats.trend || []} />
                </div>
              </div>
            )}

            {/* ── List view ──────────────────────────────────────────── */}
            {view === "list" && (
              <>
                {filtered.length === 0 && (
                  <div className="alert">
                    {items.length === 0
                      ? <>No scans recorded yet{role !== "viewer" && <> — <Link href="/" className="text-link hover:underline">scan one</Link>.</>}</>
                      : "No scans match the current filters."}
                  </div>
                )}
                <div className="grid md:grid-cols-2 gap-4">
                  {filtered.map((r) => <ResultCard key={r.id} r={r} />)}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
