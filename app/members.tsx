import React, { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, TeamMember } from "../src/api/client";

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
  danger:        "#b50909",
};

function avatarUrl(m: TeamMember): string {
  if (m.photo_url) return m.photo_url;
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(m.name)}&backgroundColor=1a4480&textColor=ffffff&fontSize=38`;
}

export default function MembersScreen() {
  const [items, setItems]         = useState<TeamMember[]>([]);
  const [err, setErr]             = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  function load() {
    api
      .members()
      .then(setItems)
      .catch((e) => setErr(e.message || "Failed to load team members."))
      .finally(() => setRefreshing(false));
  }

  useEffect(() => { load(); }, []);

  function onRefresh() {
    setRefreshing(true);
    setErr(null);
    load();
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
        <Text style={s.heroEyebrow}>VeriCash · PBL Project</Text>
        <Text style={s.heroTitle}>Project Team</Text>
        <Text style={s.heroDesc}>
          Meet the developers and researchers who built the VeriCash
          currency-authentication platform.
        </Text>
        <View style={s.heroBadge}>
          <Ionicons name="people-outline" size={13} color="#8a96b2" />
          <Text style={s.heroBadgeText}>
            {items.length > 0 ? `${items.length} member${items.length !== 1 ? "s" : ""}` : "Loading…"}
          </Text>
        </View>
      </View>

      {/* ── Error ────────────────────────────────────────────── */}
      {err && (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={T.danger} style={{ marginTop: 1 }} />
          <Text style={s.errorText}>{err}</Text>
        </View>
      )}

      {/* ── Section label ────────────────────────────────────── */}
      {items.length > 0 && (
        <Text style={s.sectionLabel}>Team members</Text>
      )}

      {/* ── Member cards ─────────────────────────────────────── */}
      <View style={s.list}>
        {items.map((m) => (
          <MemberCard key={m.id ?? m.name} m={m} />
        ))}
      </View>

      {/* ── Empty ────────────────────────────────────────────── */}
      {!err && items.length === 0 && !refreshing && (
        <View style={s.empty}>
          <Ionicons name="people-outline" size={48} color="#c9c9c9" />
          <Text style={s.emptyTitle}>No team members</Text>
          <Text style={s.emptyDesc}>
            Team member data could not be loaded. Check your connection and
            pull down to retry.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function MemberCard({ m }: { m: TeamMember }) {
  return (
    <View style={c.card}>
      {/* Avatar */}
      <Image
        source={{ uri: avatarUrl(m) }}
        style={c.avatar}
        defaultSource={{ uri: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(m.name)}` }}
      />

      {/* Body */}
      <View style={c.body}>
        <Text style={c.name}>{m.name}</Text>
        <View style={c.roleRow}>
          <View style={c.roleBadge}>
            <Text style={c.roleText}>{m.role}</Text>
          </View>
        </View>
        {m.contribution ? (
          <Text style={c.contrib}>{m.contribution}</Text>
        ) : null}

        {/* GitHub link */}
        {m.github ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(m.github!)}
            style={c.githubRow}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-github" size={14} color="#565c65" />
            <Text style={c.githubText}>GitHub profile</Text>
            <Ionicons name="open-outline" size={12} color="#71767a" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page:        { flex: 1, backgroundColor: T.bg },
  pageContent: { paddingBottom: 48 },

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
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  heroDesc: {
    fontSize: 14,
    color: "#c5cee0",
    lineHeight: 20,
    marginBottom: 14,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  heroBadgeText: { color: "#c5cee0", fontSize: 12, fontWeight: "600" },

  /* Error */
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    margin: 16,
    backgroundColor: "#f4e3db",
    borderLeftWidth: 4,
    borderLeftColor: T.danger,
    borderRadius: 3,
    padding: 12,
  },
  errorText: { flex: 1, color: T.danger, fontSize: 13, lineHeight: 18 },

  /* Section label */
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: T.textMuted,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },

  /* List */
  list: { paddingHorizontal: 16, gap: 12 },

  /* Empty */
  empty: {
    alignItems: "center",
    paddingTop: 60,
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
});

const c = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.cardBorder,
    borderRadius: 4,
    padding: 16,
    alignItems: "flex-start",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: T.navyMid,
    flexShrink: 0,
  },
  body: { flex: 1 },
  name: {
    fontSize: 17,
    fontWeight: "700",
    color: T.text,
    marginBottom: 5,
    letterSpacing: -0.2,
  },
  roleRow: { flexDirection: "row", marginBottom: 6 },
  roleBadge: {
    backgroundColor: "#eff6fb",
    borderWidth: 1,
    borderColor: "#d9e8f6",
    borderRadius: 9999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  roleText: {
    fontSize: 11,
    fontWeight: "700",
    color: T.navyMid,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  contrib: {
    fontSize: 13,
    color: T.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  githubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  githubText: {
    fontSize: 12,
    color: T.textSecondary,
    flex: 1,
  },
});
