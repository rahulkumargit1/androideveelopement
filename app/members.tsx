import React, { useEffect, useState } from "react";
import { ScrollView, View, Text, Image, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, TeamMember } from "../src/api/client";
import { colors, radius } from "../src/theme";

export default function MembersScreen() {
  const [items, setItems] = useState<TeamMember[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { api.members().then(setItems).catch((e) => setErr(e.message)); }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={s.h1}>Project Members</Text>
      <Text style={s.sub}>The team behind VeriCash.</Text>
      {err && <Text style={{ color: colors.danger }}>{err}</Text>}
      {items.map((m) => (
        <View key={m.id || m.name} style={s.card}>
          <Image
            source={{ uri: m.photo_url || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(m.name)}` }}
            style={s.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{m.name}</Text>
            <Text style={s.role}>{m.role}</Text>
            {m.contribution ? <Text style={s.contrib}>{m.contribution}</Text> : null}
            {m.github ? (
              <TouchableOpacity onPress={() => Linking.openURL(m.github!)} style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                <Ionicons name="logo-github" size={16} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 12 }}>GitHub</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: "800", color: colors.text },
  sub: { color: colors.muted, marginBottom: 8 },
  card: { flexDirection: "row", gap: 12, padding: 12, backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#E2E8F0" },
  name: { fontWeight: "700", color: colors.text, fontSize: 16 },
  role: { color: colors.brand, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
  contrib: { color: colors.muted, marginTop: 4 },
});
