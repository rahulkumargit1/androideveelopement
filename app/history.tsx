import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, ScanResult } from "../src/api/client";
import ResultCard from "../src/components/ResultCard";

/* ── Design tokens ───────────────────────────────────────────────── */
const T = {
  bg:            "#f9f8f6",
  card:          "#ffffff",
  cardBorder:    "#dcdee0",
  navy:          "#162e51",
  navyMid:       "#1a4480",
  text:          "#1b1b1b",
  textSecondary: "#565c65",
  textMuted:     "#71767a",
  danger:        "#b50909",
  dangerBg:      "#f4e3db",
};

/** Animated shimmer skeleton block */
function Skeleton({ height = 100 }: { height?: number }) {
  const anim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: false })
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const bg = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["#f0efee", "#dcdee0", "#f0efee"],
  });
  return (
    <Animated.View
      style={[
        sk.block,
        { height, backgroundColor: bg as any },
      ]}
    />
  );
}
const sk = StyleSheet.create({
  block: { borderRadius: 4, marginBottom: 12 },
});

export default function HistoryScreen() {
  const [items, setItems]       = useState<ScanResult[]>([]);
  const [err, setErr]           = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setErr(null);
    try {
      const data = await api.history(50);
      setItems(data);
    } catch (e: any) {
      setErr(e.message || "Failed to load history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load(true);
  }

  function confirmClear() {
    Alert.alert(
      "Clear scan history",
      "All scan records will be permanently deleted. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete all",
          style: "destructive",
          onPress: async () => {
            try {
              await api.clearHistory();
              setItems([]);
            } catch (e: any) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.pageContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={T.navyMid}
          colors={[T.navyMid]}
        />
      }
    >
      {/* ── Hero ─────────────────────────────────────────────── */}
      <View style={s.hero}>
        <Text style={s.heroEyebrow}>VeriCash</Text>
        <Text style={s.heroTitle}>Audit Log</Text>
        <Text style={s.heroDesc}>
          A record of every scan performed on this device. Pull down to refresh.
        </Text>
        <View style={s.heroMeta}>
          <View style={s.heroBadge}>
            <Ionicons name="scan-outline" size={13} color="#8a96b2" />
            <Text style={s.heroBadgeText}>
              {loading ? "—" : `${items.length} scan${items.length !== 1 ? "s" : ""}`}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <View style={s.toolbar}>
        <Text style={s.toolbarTitle}>Recent scans</Text>
        {items.length > 0 && !loading && (
          <TouchableOpacity
            style={s.btnDanger}
            onPress={confirmClear}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={14} color="#fff" />
            <Text style={s.btnDangerText}>Clear history</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Error ────────────────────────────────────────────── */}
      {err && (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={T.danger} style={{ marginTop: 1 }} />
          <Text style={s.errorText}>{err}</Text>
        </View>
      )}

      {/* ── Skeletons ────────────────────────────────────────── */}
      {loading && !refreshing && (
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <Skeleton height={110} />
          <Skeleton height={110} />
          <Skeleton height={110} />
        </View>
      )}

      {/* ── Empty state ──────────────────────────────────────── */}
      {!loading && !err && items.length === 0 && (
        <View style={s.empty}>
          <Ionicons name="document-text-outline" size={48} color="#c9c9c9" />
          <Text style={s.emptyTitle}>No scans yet</Text>
          <Text style={s.emptyDesc}>
            Go to the Scan tab and scan your first banknote — the results will
            appear here.
          </Text>
        </View>
      )}

      {/* ── List ─────────────────────────────────────────────── */}
      {!loading && items.length > 0 && (
        <View style={s.list}>
          {items.map((r) => (
            <ResultCard key={r.id ?? r.created_at} r={r} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page:        { flex: 1, backgroundColor: T.bg },
  pageContent: { paddingBottom: 40 },

  /* Hero */
  hero: {
    backgroundColor: T.navy,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#8a96b2",
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  heroDesc: {
    fontSize: 14,
    color: "#c5cee0",
    lineHeight: 20,
    marginBottom: 12,
  },
  heroMeta: { flexDirection: "row", gap: 8 },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  heroBadgeText: { color: "#c5cee0", fontSize: 12, fontWeight: "600" },

  /* Toolbar row */
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
  },
  toolbarTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: T.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  btnDanger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: T.danger,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 3,
  },
  btnDangerText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  /* Error */
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: T.dangerBg,
    borderLeftWidth: 4,
    borderLeftColor: T.danger,
    borderRadius: 3,
    padding: 12,
  },
  errorText: { flex: 1, color: T.danger, fontSize: 13, lineHeight: 18 },

  /* Empty */
  empty: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: T.text,
    marginTop: 14,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 14,
    color: T.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },

  /* List */
  list: { paddingHorizontal: 16, gap: 12 },
});
