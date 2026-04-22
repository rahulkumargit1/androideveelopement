import React, { useEffect, useState } from "react";
import { ScrollView, Text, View, ActivityIndicator, StyleSheet } from "react-native";
import { api, ScanResult } from "../src/api/client";
import ResultCard from "../src/components/ResultCard";
import { colors } from "../src/theme";

export default function HistoryScreen() {
  const [items, setItems] = useState<ScanResult[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.history(50).then(setItems).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={s.h1}>Recent scans</Text>
      {loading && <ActivityIndicator color={colors.brand} style={{ marginTop: 20 }} />}
      {err && <Text style={{ color: colors.danger }}>{err}</Text>}
      {!loading && !err && items.length === 0 && <Text style={{ color: colors.muted }}>No scans yet.</Text>}
      {items.map((r) => <ResultCard key={r.id} r={r} />)}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: 12 },
});
