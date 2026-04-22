import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../theme";
import type { ScanResult } from "../api/client";

const META: Record<string, { color: string; label: string; icon: any }> = {
  authentic: { color: colors.success, label: "Authentic", icon: "checkmark-circle" },
  suspicious: { color: colors.amber, label: "Suspicious", icon: "warning" },
  counterfeit: { color: colors.danger, label: "Counterfeit", icon: "close-circle" },
};
const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;

export default function ResultCard({ r }: { r: ScanResult }) {
  const m = META[r.verdict] || META.suspicious;
  const sub = (r.breakdown?.subscores || {}) as Record<string, number>;
  return (
    <View style={s.card}>
      {r.demonetized && (
        <View style={{ backgroundColor: "#fff8e6", borderRadius: 6, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "#f0c040", flexDirection: "row", gap: 8 }}>
          <Ionicons name="ban-outline" size={16} color="#7a5c00" style={{ marginTop: 1 }} />
          <Text style={{ color: "#7a5c00", fontSize: 12, flex: 1 }}>
            <Text style={{ fontWeight: "700" }}>Demonetized — </Text>
            This {r.currency} {r.denomination} note has been recalled and may not be accepted.
          </Text>
        </View>
      )}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>DETECTED</Text>
          <Text style={s.title}>{r.currency} <Text style={s.muted}>· {r.denomination}</Text></Text>
        </View>
        <View style={[s.badge, { backgroundColor: `${m.color}22` }]}>
          <Ionicons name={m.icon} size={18} color={m.color} />
          <Text style={[s.badgeTxt, { color: m.color }]}>{m.label}</Text>
        </View>
      </View>

      <View style={s.statsRow}>
        <Stat label="Authenticity" value={pct(r.authenticity_score)} highlight />
        <Stat label="Confidence" value={pct(r.confidence)} />
      </View>

      <Text style={s.section}>Image-processing breakdown</Text>
      {Object.entries(sub).map(([k, v]) => (
        <Bar key={k} label={k.replace(/_/g, " ")} value={Number(v)} />
      ))}
    </View>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[s.stat, highlight && { backgroundColor: `${colors.brand}1A` }]}>
      <Text style={s.muted}>{label}</Text>
      <Text style={[s.statVal, highlight && { color: colors.brand }]}>{value}</Text>
    </View>
  );
}
function Bar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={s.barRow}>
        <Text style={s.barLabel}>{label}</Text>
        <Text style={s.barLabel}>{Math.round(v * 100)}</Text>
      </View>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${v * 100}%` }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, padding: 16, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, marginVertical: 6 },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  label: { fontSize: 10, color: colors.muted, letterSpacing: 1 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 2 },
  muted: { color: colors.muted, fontWeight: "400" },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 6 },
  badgeTxt: { fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  stat: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: "#F1F5F9" },
  statVal: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 2 },
  section: { fontWeight: "600", marginBottom: 8, color: colors.text },
  barRow: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { fontSize: 11, color: colors.muted, textTransform: "capitalize" },
  barTrack: { height: 6, backgroundColor: "#E2E8F0", borderRadius: 999, overflow: "hidden", marginTop: 2 },
  barFill: { height: 6, backgroundColor: colors.brand },
});
