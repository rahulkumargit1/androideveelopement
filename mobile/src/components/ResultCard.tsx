/**
 * ResultCard — mobile mirror of web/components/ResultCard.tsx
 *
 * Layout (top→bottom):
 *   1. Verdict band  (full-width strip: bg + icon + label + "heuristic")
 *   2. Demonetized amber warning  (conditional)
 *   3. Detected header  (eyebrow / currency+denomination / authenticity %)
 *   4. Top currencies + top denominations  (mini progress bars)
 *   5. Image-processing breakdown  (subscore bars, 2-column grid)
 *   6. CIE Lab measurement box  (L*, a*, b*, C)
 *   7. Comparison of techniques box  (if present)
 *   8. Footer note
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Share, Linking, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ScanResult } from "../api/client";

/* ── Design tokens ───────────────────────────────────────────────── */
const T = {
  bg:            "#f9f8f6",
  card:          "#ffffff",
  cardBorder:    "#dcdee0",
  navy:          "#162e51",
  navyMid:       "#1a4480",
  blue:          "#2378c3",
  gold:          "#ffbc78",
  text:          "#1b1b1b",
  textSecondary: "#565c65",
  textMuted:     "#71767a",

  success:    "#2e8540",
  successBg:  "#ecf3ec",
  successFg:  "#19381f",

  amber:      "#e5a000",
  amberBg:    "#faf3d1",
  amberFg:    "#5c410a",

  danger:     "#b50909",
  dangerBg:   "#f4e3db",
  dangerFg:   "#5b1212",

  sunken:     "#f9f8f6",
  border:     "#dcdee0",
  borderStrong: "#c9c9c9",
};

/* ── Verdict metadata ────────────────────────────────────────────── */
type VerdictKey = "authentic" | "suspicious" | "counterfeit";

const VERDICT_META: Record<
  VerdictKey,
  { bg: string; fg: string; border: string; iconName: any; label: string; bar: "success" | "warn" | "danger" }
> = {
  authentic:   { bg: T.successBg, fg: T.successFg, border: "#94bfa2", iconName: "checkmark-circle", label: "Authentic",   bar: "success" },
  suspicious:  { bg: T.amberBg,   fg: T.amberFg,   border: "#ddaa01", iconName: "warning",          label: "Suspicious",  bar: "warn"    },
  counterfeit: { bg: T.dangerBg,  fg: T.dangerFg,  border: "#d83933", iconName: "close-circle",     label: "Counterfeit", bar: "danger"  },
};

/* ── Label map (mirrors web) ─────────────────────────────────────── */
const LABELS: Record<string, string> = {
  exposure:            "Image Enhancement (exposure)",
  histogram_match:     "Histogram Processing",
  noise_quality:       "Noise Removal (quality)",
  sharpness:           "Spatial Filtering (sharpness)",
  texture_detail:      "Spatial Filtering (sharpness)",
  microprint_fft:      "Frequency Domain (micro-print)",
  microprint_presence: "Frequency Domain (micro-print)",
  thread_continuity:   "Morphology (security thread)",
  thread_detection:    "Morphology (security thread)",
  color_chroma:        "Colour Space (Lab chroma)",
  color_consistency:   "Colour Space",
  profile_match:       "Colour Space",
  ml_confidence:       "Classifier confidence",
};

function prettyLabel(k: string): string {
  return LABELS[k] ?? k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;

/* ── Component ───────────────────────────────────────────────────── */
export default function ResultCard({ r }: { r: ScanResult }) {
  const verdictKey: VerdictKey =
    r.verdict === "authentic" || r.verdict === "counterfeit" ? r.verdict : "suspicious";
  const meta = VERDICT_META[verdictKey];

  const breakdown   = (r.breakdown && typeof r.breakdown === "object" ? r.breakdown : {}) as Record<string, any>;
  const subscores   = (breakdown.subscores && typeof breakdown.subscores === "object" ? breakdown.subscores : {}) as Record<string, number>;
  const comparison  = (breakdown.comparison_of_techniques && typeof breakdown.comparison_of_techniques === "object" ? breakdown.comparison_of_techniques : {}) as Record<string, number>;
  const topCurRaw   = Array.isArray(breakdown.top_currencies) ? breakdown.top_currencies : [];
  const topDenRaw   = Array.isArray(breakdown.top_denominations) ? breakdown.top_denominations : [];
  const topCur      = topCurRaw.filter((t: any) => Array.isArray(t) && t.length >= 2 && typeof t[0] === "string") as [string, number][];
  const topDen      = topDenRaw.filter((t: any) => Array.isArray(t) && t.length >= 3 && typeof t[0] === "string" && typeof t[1] === "string") as [string, string, number][];
  const lab         = (breakdown.lab && typeof breakdown.lab === "object" ? breakdown.lab : {}) as { L?: number; a?: number; b?: number; chroma?: number };
  const model       = typeof breakdown.model === "string" ? breakdown.model : "heuristic";

  const subscopeEntries = Object.entries(subscores);

  return (
    <View style={s.card}>

      {/* ── 1. Verdict band ──────────────────────────────────── */}
      <View style={[s.verdictBand, { backgroundColor: meta.bg, borderBottomColor: meta.border }]}>
        <Ionicons name={meta.iconName} size={18} color={meta.fg} />
        <Text style={[s.verdictLabel, { color: meta.fg }]}>{meta.label}</Text>
        <Text style={[s.verdictModel, { color: meta.fg }]}>{model}</Text>
      </View>

      {/* ── 2. Demonetized warning ────────────────────────────── */}
      {r.demonetized && (
        <View style={s.demoBanner}>
          <Ionicons name="ban-outline" size={15} color="#7a5c00" style={{ marginTop: 1, flexShrink: 0 }} />
          <Text style={s.demoText}>
            <Text style={{ fontWeight: "700" }}>Demonetized note — </Text>
            This denomination ({r.currency} {r.denomination}) has been recalled from
            circulation. It may no longer be accepted by banks.
          </Text>
        </View>
      )}

      {/* ── Body ─────────────────────────────────────────────── */}
      <View style={s.body}>

        {/* ── 3. Header ──────────────────────────────────────── */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>Detected</Text>
            <Text style={s.currency}>
              {r.currency}
              {r.denomination && r.denomination !== "unknown" && (
                <Text style={s.denomination}> · {r.denomination}</Text>
              )}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.eyebrow}>Authenticity</Text>
            <Text style={s.score}>{pct(r.authenticity_score)}</Text>
          </View>
        </View>

        {/* ── 4. Top currencies + denominations ──────────────── */}
        {topCur.length > 0 && (
          <View style={s.topSection}>
            {/* Top currencies */}
            <View style={s.topCol}>
              <Text style={s.eyebrow}>Top currencies</Text>
              {topCur.map(([code, prob], i) => (
                <View key={code} style={s.miniRow}>
                  <View style={[s.miniChip, i === 0 && s.miniChipActive]}>
                    <Text style={[s.miniChipText, i === 0 && s.miniChipTextActive]}>
                      {code}
                    </Text>
                  </View>
                  <View style={s.miniTrack}>
                    <View style={[s.miniFill, { width: `${prob * 100}%` as any }]} />
                  </View>
                  <Text style={s.miniPct}>{Math.round(prob * 100)}%</Text>
                </View>
              ))}
            </View>

            {/* Top denominations */}
            {topDen.length > 0 && (
              <View style={s.topCol}>
                <Text style={s.eyebrow}>Top denominations</Text>
                {topDen.slice(0, 5).map(([cur, den, prob], i) => (
                  <View key={`${cur}-${den}`} style={s.miniRow}>
                    <View style={[s.miniChip, s.miniChipWide, i === 0 && s.miniChipActive]}>
                      <Text
                        style={[s.miniChipText, i === 0 && s.miniChipTextActive]}
                        numberOfLines={1}
                      >
                        {cur} {den}
                      </Text>
                    </View>
                    <View style={s.miniTrack}>
                      <View style={[s.miniFill, { width: `${prob * 100}%` as any }]} />
                    </View>
                    <Text style={s.miniPct}>{Math.round(prob * 100)}%</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── 5. Image-processing breakdown ──────────────────── */}
        {subscopeEntries.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Image-processing breakdown</Text>
              <Text style={s.sectionMeta}>
                {Math.max(0, subscopeEntries.length - 1)} PBL techniques + classifier
              </Text>
            </View>
            <View style={s.barsGrid}>
              {subscopeEntries.map(([k, v]) => (
                <ScoreBar
                  key={k}
                  label={prettyLabel(k)}
                  value={Number(v)}
                  barType={meta.bar}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── 6 + 7. CIE Lab + comparison ────────────────────── */}
        {(lab.L !== undefined || Object.keys(comparison).length > 0) && (
          <View style={s.bottomRow}>
            {lab.L !== undefined && (
              <View style={s.infoBox}>
                <Text style={s.eyebrow}>Color measurement (CIE Lab)</Text>
                <View style={s.labGrid}>
                  {([["L*", lab.L], ["a*", lab.a], ["b*", lab.b], ["C", lab.chroma]] as [string, number | undefined][]).map(
                    ([lbl, val]) => (
                      <View key={lbl} style={s.labCell}>
                        <Text style={s.labKey}>{lbl}</Text>
                        <Text style={s.labVal}>
                          {val !== undefined ? Number(val).toFixed(1) : "—"}
                        </Text>
                      </View>
                    )
                  )}
                </View>
              </View>
            )}
            {Object.keys(comparison).length > 0 && (
              <View style={s.infoBox}>
                <Text style={s.eyebrow}>Technique comparison (sharpness)</Text>
                <View style={s.compGrid}>
                  {Object.entries(comparison).map(([k, v]) => (
                    <View key={k} style={s.compCell}>
                      <Text style={s.compKey}>{k.toUpperCase()}</Text>
                      <Text style={s.compVal}>{Number(v).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── 8. Share buttons ─────────────────────────────────── */}
        <ShareRow r={r} />

        {/* ── 9. Footer note ───────────────────────────────────── */}
        <Text style={s.footerNote}>
          Verdict combines weighted image-quality scores with the colour-fingerprint
          classifier; thresholds are configurable in Settings.
        </Text>
      </View>
    </View>
  );
}

/* ── ShareRow ────────────────────────────────────────────────────── */
function buildShareText(r: ScanResult): string {
  const verdictEmoji =
    r.verdict === "authentic" ? "✅" : r.verdict === "suspicious" ? "⚠️" : "❌";
  const pct = Math.round((r.authenticity_score || 0) * 100);
  const lines = [
    `${verdictEmoji} *VeriCash Currency Scan*`,
    ``,
    `*Verdict:* ${r.verdict.toUpperCase()}`,
    `*Currency:* ${r.currency}${r.denomination && r.denomination !== "unknown" ? ` ${r.denomination}` : ""}`,
    `*Authenticity:* ${pct}%`,
    r.demonetized ? `⚠️ This denomination has been demonetized.` : "",
    ``,
    `_Scanned with VeriCash — https://vericash.duckdns.org_`,
  ];
  return lines.filter(Boolean).join("\n");
}

function ShareRow({ r }: { r: ScanResult }) {
  const text = buildShareText(r);

  async function shareWhatsApp() {
    const encoded = encodeURIComponent(text);
    const url = `whatsapp://send?text=${encoded}`;
    const can = await Linking.canOpenURL(url);
    if (can) {
      await Linking.openURL(url);
    } else {
      Alert.alert("WhatsApp not found", "Please install WhatsApp to share via it.");
    }
  }

  async function shareGeneric() {
    try {
      await Share.share({ message: text, title: "VeriCash Scan Result" });
    } catch (e: any) {
      if (e.message !== "The user did not share") Alert.alert("Share failed", e.message);
    }
  }

  return (
    <View style={sh.row}>
      <TouchableOpacity style={sh.btnWa} onPress={shareWhatsApp} activeOpacity={0.8}>
        <Ionicons name="logo-whatsapp" size={16} color="#fff" />
        <Text style={sh.btnWaText}>Share on WhatsApp</Text>
      </TouchableOpacity>
      <TouchableOpacity style={sh.btnMore} onPress={shareGeneric} activeOpacity={0.8}>
        <Ionicons name="share-social-outline" size={16} color="#162e51" />
        <Text style={sh.btnMoreText}>More</Text>
      </TouchableOpacity>
    </View>
  );
}

const sh = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  btnWa: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    backgroundColor: "#25D366",
    borderRadius: 3,
  },
  btnWaText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  btnMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#162e51",
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  btnMoreText: { color: "#162e51", fontWeight: "600", fontSize: 13 },
});

/* ── ScoreBar ────────────────────────────────────────────────────── */
function ScoreBar({
  label,
  value,
  barType,
}: {
  label: string;
  value: number;
  barType: "success" | "warn" | "danger";
}) {
  const v = Math.max(0, Math.min(1, value || 0));
  const barColor =
    barType === "success" ? T.success : barType === "warn" ? T.amber : T.danger;
  return (
    <View style={b.wrap}>
      <View style={b.labelRow}>
        <Text style={b.label} numberOfLines={1}>{label}</Text>
        <Text style={b.pct}>{Math.round(v * 100)}</Text>
      </View>
      <View style={b.track}>
        <View style={[b.fill, { width: `${v * 100}%` as any, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  card: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.cardBorder,
    borderRadius: 4,
    overflow: "hidden",
    marginVertical: 4,
  },

  /* Verdict band */
  verdictBand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  verdictLabel: {
    fontWeight: "700",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    flex: 1,
  },
  verdictModel: {
    fontSize: 11,
    fontFamily: "Courier New",
    opacity: 0.75,
  },

  /* Demonetized */
  demoBanner: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: "#fff8e6",
    borderBottomWidth: 1,
    borderBottomColor: "#f0c040",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  demoText: { fontSize: 12, color: "#7a5c00", flex: 1, lineHeight: 17 },

  /* Body wrapper */
  body: { padding: 16, gap: 16 },

  /* Header */
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: T.textMuted,
    marginBottom: 2,
  },
  currency: {
    fontSize: 22,
    fontWeight: "700",
    color: T.text,
    letterSpacing: -0.3,
  },
  denomination: {
    fontSize: 18,
    fontWeight: "400",
    color: T.textMuted,
  },
  score: {
    fontSize: 26,
    fontWeight: "700",
    color: T.navyMid,
    letterSpacing: -0.5,
  },

  /* Top currencies/denominations */
  topSection: { gap: 14 },
  topCol:     { gap: 6 },
  miniRow:    { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  miniChip: {
    backgroundColor: T.sunken,
    borderWidth: 1,
    borderColor: T.borderStrong,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 40,
    alignItems: "center",
  },
  miniChipWide: { minWidth: 72 },
  miniChipActive: {
    backgroundColor: "#eff6fb",
    borderColor: T.navyMid,
  },
  miniChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: T.textSecondary,
    fontFamily: "Courier New",
  },
  miniChipTextActive: { color: T.navyMid },
  miniTrack: {
    flex: 1,
    height: 6,
    backgroundColor: T.sunken,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: T.cardBorder,
    overflow: "hidden",
  },
  miniFill: {
    height: "100%",
    backgroundColor: T.navyMid,
    borderRadius: 9999,
  },
  miniPct: {
    fontSize: 11,
    color: T.textMuted,
    fontFamily: "Courier New",
    width: 34,
    textAlign: "right",
  },

  /* Breakdown section */
  section:       { gap: 10 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: T.text, flex: 1 },
  sectionMeta:  { fontSize: 11, color: T.textMuted, fontFamily: "Courier New" },
  barsGrid:     { gap: 10 },

  /* Bottom boxes */
  bottomRow: { gap: 10 },
  infoBox: {
    backgroundColor: T.sunken,
    borderWidth: 1,
    borderColor: T.cardBorder,
    borderRadius: 4,
    padding: 12,
    gap: 8,
  },

  /* CIE Lab grid */
  labGrid: { flexDirection: "row", gap: 4 },
  labCell: {
    flex: 1,
    alignItems: "center",
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.cardBorder,
    borderRadius: 3,
    paddingVertical: 6,
  },
  labKey: {
    fontSize: 10,
    color: T.textMuted,
    fontFamily: "Courier New",
    textTransform: "uppercase",
  },
  labVal: {
    fontSize: 13,
    fontWeight: "700",
    color: T.text,
    fontFamily: "Courier New",
    marginTop: 2,
  },

  /* Comparison grid */
  compGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  compCell: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.cardBorder,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 70,
  },
  compKey: {
    fontSize: 10,
    color: T.textMuted,
    fontFamily: "Courier New",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  compVal: {
    fontSize: 13,
    fontWeight: "700",
    color: T.text,
    fontFamily: "Courier New",
    marginTop: 2,
  },

  /* Footer */
  footerNote: {
    fontSize: 11,
    color: T.textMuted,
    lineHeight: 16,
  },
});

const b = StyleSheet.create({
  wrap: { gap: 2 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 2,
  },
  label: {
    fontSize: 12,
    color: T.textSecondary,
    fontWeight: "500",
    flex: 1,
    marginRight: 8,
  },
  pct: {
    fontSize: 11,
    color: T.textMuted,
    fontFamily: "Courier New",
  },
  track: {
    height: 8,
    backgroundColor: T.sunken,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: T.cardBorder,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 9999,
  },
});
